"""Hot-reloadable telemetry anomaly detector."""

from __future__ import annotations

import json
import math
import pickle
import threading
from pathlib import Path
from typing import Any

from app.services.anomaly.model_store import (
    ACTIVE_POINTER_FILENAME,
    AI_ENGINE_ROOT,
    DEFAULT_MODELS_ROOT,
    FEATURE_NAMES,
    FEATURE_SCHEMA_VERSION,
    PROVENANCE_FILENAME,
    load_candidate,
    sha256_file,
    validate_model_id,
)


LABEL_NAMES = {
    0: "Normal",
    1: "Modbus Flood",
    2: "Logic Tampering",
}


class AnomalyDetector:
    """Keep serving the last valid model while safely checking the active pointer."""

    def __init__(
        self,
        models_root: Path | str = DEFAULT_MODELS_ROOT,
        legacy_root: Path | str = AI_ENGINE_ROOT,
    ):
        self.models_root = Path(models_root)
        self.legacy_root = Path(legacy_root)
        self._lock = threading.RLock()
        self._pointer_signature: str | None = None
        self._reload_error: str | None = None
        self.model: Any | None = None
        self.scaler: Any | None = None
        self.model_id: str | None = None
        self.provenance: dict[str, Any] = {}
        self.reload_if_needed(force=True, raise_on_error=True)

    def _validate_feature_count(self, model: Any, scaler: Any) -> None:
        expected_features = len(FEATURE_NAMES)
        model_features = getattr(model, "n_features_in_", None)
        scaler_features = getattr(scaler, "n_features_in_", None)
        if model_features != expected_features or scaler_features != expected_features:
            raise RuntimeError(
                "Incompatible anomaly model artifacts: "
                f"schema {FEATURE_SCHEMA_VERSION} expects {expected_features} features, "
                f"model has {model_features}, scaler has {scaler_features}."
            )

    def _legacy_signature(self) -> str:
        model_path = self.legacy_root / "telemetry_classifier.pkl"
        scaler_path = self.legacy_root / "scaler.pkl"
        return f"legacy:{sha256_file(model_path)}:{sha256_file(scaler_path)}"

    def _load_legacy(self) -> tuple[Any, Any, str, dict[str, Any], str]:
        model_path = self.legacy_root / "telemetry_classifier.pkl"
        scaler_path = self.legacy_root / "scaler.pkl"
        signature = self._legacy_signature()
        try:
            with model_path.open("rb") as handle:
                model = pickle.load(handle)
            with scaler_path.open("rb") as handle:
                scaler = pickle.load(handle)
        except (OSError, pickle.PickleError, EOFError, AttributeError) as exc:
            raise RuntimeError("No valid active pointer or legacy anomaly artifacts") from exc
        self._validate_feature_count(model, scaler)
        model_hash = signature.split(":")[1]
        model_id = f"legacy-{model_hash[:12]}"
        provenance = {
            "model_id": model_id,
            "lifecycle_state": "legacy_unversioned",
            "algorithm": model.__class__.__name__,
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "feature_order": list(FEATURE_NAMES),
        }
        return model, scaler, model_id, provenance, signature

    def _load_active(self, pointer_bytes: bytes) -> tuple[Any, Any, str, dict[str, Any], str]:
        try:
            pointer = json.loads(pointer_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError("Active model pointer is not valid UTF-8 JSON") from exc
        if not isinstance(pointer, dict):
            raise RuntimeError("Active model pointer must contain a JSON object")
        if pointer.get("schema_version") != "ics-guard-active-model-v1":
            raise RuntimeError("Active model pointer schema is incompatible")
        if pointer.get("feature_schema_version") != FEATURE_SCHEMA_VERSION:
            raise RuntimeError("Active model pointer feature schema is incompatible")
        model_id = validate_model_id(pointer.get("active_model_id"))
        candidate = load_candidate(model_id, self.models_root)
        expected_provenance_hash = pointer.get("provenance_sha256")
        actual_provenance_hash = sha256_file(candidate.directory / PROVENANCE_FILENAME)
        if expected_provenance_hash != actual_provenance_hash:
            raise RuntimeError("Active pointer provenance checksum mismatch")
        signature = f"pointer:{sha256_file(self.models_root / ACTIVE_POINTER_FILENAME)}"
        return (
            candidate.model,
            candidate.scaler,
            candidate.model_id,
            candidate.provenance,
            signature,
        )

    def reload_if_needed(
        self,
        *,
        force: bool = False,
        raise_on_error: bool = False,
    ) -> bool:
        """Reload only after every new artifact validates; otherwise retain the old model."""

        pointer_path = self.models_root / ACTIVE_POINTER_FILENAME
        try:
            if pointer_path.is_file():
                pointer_bytes = pointer_path.read_bytes()
                next_signature = f"pointer:{sha256_file(pointer_path)}"
                if not force and next_signature == self._pointer_signature:
                    return False
                loaded = self._load_active(pointer_bytes)
            else:
                if self.model is not None and self._pointer_signature not in (None, ""):
                    # A versioned pointer disappearing is not a reason to silently
                    # downgrade a live detector to legacy artifacts.
                    if self._pointer_signature.startswith("pointer:"):
                        raise RuntimeError("Active model pointer disappeared; retaining current model")
                next_signature = self._legacy_signature()
                if not force and next_signature == self._pointer_signature:
                    return False
                loaded = self._load_legacy()

            model, scaler, model_id, provenance, signature = loaded
            self._validate_feature_count(model, scaler)
            with self._lock:
                self.model = model
                self.scaler = scaler
                self.model_id = model_id
                self.provenance = provenance
                self._pointer_signature = signature
                self._reload_error = None
            return True
        except Exception as exc:
            with self._lock:
                has_fallback = self.model is not None and self.scaler is not None
                self._reload_error = str(exc)
            if raise_on_error or not has_fallback:
                raise
            return False

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "model_id": self.model_id,
                "algorithm": self.provenance.get(
                    "algorithm",
                    self.model.__class__.__name__ if self.model is not None else None,
                ),
                "feature_schema_version": FEATURE_SCHEMA_VERSION,
                "feature_order": list(FEATURE_NAMES),
                "reload_error": self._reload_error,
            }

    def classify(self, metrics: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(metrics, dict):
            raise ValueError("metrics must be an object")
        self.reload_if_needed()

        packet_rate = metrics.get(
            "packet_rate",
            metrics.get("packets_per_second", metrics.get("packet_forward_rate", 0)),
        )
        features = [
            metrics.get("cpu_usage", 0),
            metrics.get("memory_usage", 0),
            metrics.get("bytes_per_second", 0),
            packet_rate,
        ]
        try:
            features = [float(value) for value in features]
        except (TypeError, ValueError) as exc:
            raise ValueError("anomaly metrics must contain numeric values") from exc
        if not all(math.isfinite(value) for value in features):
            raise ValueError("anomaly metrics must contain finite values")

        with self._lock:
            model = self.model
            scaler = self.scaler
            model_id = self.model_id
            algorithm = self.provenance.get(
                "algorithm",
                model.__class__.__name__ if model is not None else "unknown",
            )
        if model is None or scaler is None or model_id is None:
            raise RuntimeError("anomaly detector has no valid model")

        transformed = scaler.transform([features])
        label_id = int(model.predict(transformed)[0])
        probability = float(model.predict_proba(transformed)[0].max())
        return {
            "is_anomaly": bool(label_id != 0),
            "label": LABEL_NAMES.get(label_id, f"Unknown-{label_id}"),
            "label_id": label_id,
            "score": round(probability, 3),
            "confidence": round(probability, 3),
            "model_id": model_id,
            "algorithm": algorithm,
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
        }


detector = AnomalyDetector()
