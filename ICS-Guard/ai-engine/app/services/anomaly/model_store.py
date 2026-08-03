"""Versioned anomaly-model storage and activation primitives."""

from __future__ import annotations

import hashlib
import json
import os
import pickle
import re
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


FEATURE_SCHEMA_VERSION = "telemetry-v1"
FEATURE_NAMES = (
    "cpu_usage",
    "memory_usage",
    "bytes_per_second",
    "packet_rate",
)
MODEL_FILENAME = "model.pkl"
SCALER_FILENAME = "scaler.pkl"
PROVENANCE_FILENAME = "provenance.json"
ACTIVE_POINTER_FILENAME = "active_model.json"

AI_ENGINE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MODELS_ROOT = AI_ENGINE_ROOT / "models"
_MODEL_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class ModelStoreError(ValueError):
    """Raised when a candidate or active pointer is invalid."""


@dataclass(frozen=True)
class LoadedCandidate:
    model_id: str
    model: Any
    scaler: Any
    provenance: dict[str, Any]
    directory: Path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_model_id(model_id: str) -> str:
    if not isinstance(model_id, str) or not _MODEL_ID_RE.fullmatch(model_id):
        raise ModelStoreError("model_id contains unsupported characters")
    return model_id


def candidate_directory(model_id: str, models_root: Path | str = DEFAULT_MODELS_ROOT) -> Path:
    safe_id = validate_model_id(model_id)
    root = Path(models_root).resolve()
    path = (root / safe_id).resolve()
    if path.parent != root:
        raise ModelStoreError("model_id resolves outside the model store")
    return path


def _read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ModelStoreError(f"missing model artifact: {path.name}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelStoreError(f"invalid JSON artifact: {path.name}") from exc
    if not isinstance(data, dict):
        raise ModelStoreError(f"{path.name} must contain a JSON object")
    return data


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    """Write JSON beside its target, fsync it, then atomically replace the target."""

    path.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def load_candidate(
    model_id: str,
    models_root: Path | str = DEFAULT_MODELS_ROOT,
) -> LoadedCandidate:
    """Load and fully validate a candidate before it can become active."""

    directory = candidate_directory(model_id, models_root)
    provenance_path = directory / PROVENANCE_FILENAME
    provenance = _read_json(provenance_path)
    if provenance.get("model_id") != model_id:
        raise ModelStoreError("candidate provenance model_id does not match its directory")
    if tuple(provenance.get("feature_order", ())) != FEATURE_NAMES:
        raise ModelStoreError(
            f"candidate feature_order must match {FEATURE_SCHEMA_VERSION}: {list(FEATURE_NAMES)}"
        )
    if provenance.get("feature_schema_version") != FEATURE_SCHEMA_VERSION:
        raise ModelStoreError("candidate feature schema version is incompatible")

    artifacts = provenance.get("artifacts")
    if not isinstance(artifacts, dict):
        raise ModelStoreError("candidate provenance is missing artifact metadata")

    artifact_paths: dict[str, Path] = {}
    for key, expected_name in (("model", MODEL_FILENAME), ("scaler", SCALER_FILENAME)):
        metadata = artifacts.get(key)
        if not isinstance(metadata, dict) or metadata.get("filename") != expected_name:
            raise ModelStoreError(f"candidate provenance has invalid {key} metadata")
        artifact_path = directory / expected_name
        if not artifact_path.is_file():
            raise ModelStoreError(f"candidate is missing {expected_name}")
        if metadata.get("sha256") != sha256_file(artifact_path):
            raise ModelStoreError(f"candidate {expected_name} checksum mismatch")
        if metadata.get("size_bytes") != artifact_path.stat().st_size:
            raise ModelStoreError(f"candidate {expected_name} size mismatch")
        artifact_paths[key] = artifact_path

    try:
        with artifact_paths["model"].open("rb") as handle:
            model = pickle.load(handle)
        with artifact_paths["scaler"].open("rb") as handle:
            scaler = pickle.load(handle)
    except Exception as exc:
        raise ModelStoreError("candidate pickle artifacts cannot be loaded") from exc

    expected_features = len(FEATURE_NAMES)
    if getattr(model, "n_features_in_", None) != expected_features:
        raise ModelStoreError("candidate model feature count is incompatible")
    if getattr(scaler, "n_features_in_", None) != expected_features:
        raise ModelStoreError("candidate scaler feature count is incompatible")
    if not callable(getattr(model, "predict", None)):
        raise ModelStoreError("candidate model does not expose predict()")
    if not callable(getattr(scaler, "transform", None)):
        raise ModelStoreError("candidate scaler does not expose transform()")

    return LoadedCandidate(
        model_id=model_id,
        model=model,
        scaler=scaler,
        provenance=provenance,
        directory=directory,
    )


def read_active_pointer(
    models_root: Path | str = DEFAULT_MODELS_ROOT,
) -> dict[str, Any] | None:
    pointer_path = Path(models_root) / ACTIVE_POINTER_FILENAME
    if not pointer_path.exists():
        return None
    pointer = _read_json(pointer_path)
    model_id = pointer.get("active_model_id")
    validate_model_id(model_id)
    return pointer


def activate_candidate(
    model_id: str,
    models_root: Path | str = DEFAULT_MODELS_ROOT,
) -> dict[str, Any]:
    """Validate a candidate first, then atomically publish its active pointer."""

    root = Path(models_root)
    candidate = load_candidate(model_id, root)
    provenance_path = candidate.directory / PROVENANCE_FILENAME
    pointer = {
        "schema_version": "ics-guard-active-model-v1",
        "active_model_id": candidate.model_id,
        "activated_at": utc_now(),
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "provenance_sha256": sha256_file(provenance_path),
    }
    atomic_write_json(root / ACTIVE_POINTER_FILENAME, pointer)
    return pointer
