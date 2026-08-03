"""Train a versioned RandomForest telemetry classifier from validated CSV data."""

from __future__ import annotations

import csv
import io
import json
import math
import os
import pickle
import platform
import shutil
import sys
import tempfile
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from app.services.anomaly.model_store import (
    DEFAULT_MODELS_ROOT,
    FEATURE_NAMES,
    FEATURE_SCHEMA_VERSION,
    MODEL_FILENAME,
    PROVENANCE_FILENAME,
    SCALER_FILENAME,
    activate_candidate,
    sha256_bytes,
    sha256_file,
)


MAX_DATASET_BYTES = 10 * 1024 * 1024
MAX_DATASET_ROWS = 250_000
MIN_ROWS_PER_CLASS = 3
LABEL_NAMES = {
    0: "Normal",
    1: "Modbus Flood",
    2: "Logic Tampering",
}
LABEL_ALIASES = {
    "0": 0,
    "normal": 0,
    "1": 1,
    "modbus flood": 1,
    "modbus_flood": 1,
    "2": 2,
    "logic tampering": 2,
    "logic_tampering": 2,
}
DEFAULT_PARAMS = {
    "n_estimators": 50,
    "max_depth": 8,
    "test_size": 0.3,
    "split_seed": 42,
    "model_seed": 42,
}


class DatasetValidationError(ValueError):
    """Raised when uploaded training data is unsafe or incompatible."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _validate_params(params: dict[str, Any] | None) -> dict[str, Any]:
    if params is None:
        return dict(DEFAULT_PARAMS)
    if not isinstance(params, dict):
        raise DatasetValidationError("params must be an object")

    unknown = sorted(set(params) - set(DEFAULT_PARAMS))
    if unknown:
        raise DatasetValidationError(f"unsupported training params: {', '.join(unknown)}")

    result = {**DEFAULT_PARAMS, **params}
    for key in ("n_estimators", "split_seed", "model_seed"):
        value = result[key]
        if isinstance(value, bool) or not isinstance(value, int):
            raise DatasetValidationError(f"{key} must be an integer")
    if not 1 <= result["n_estimators"] <= 1_000:
        raise DatasetValidationError("n_estimators must be between 1 and 1000")
    for key in ("split_seed", "model_seed"):
        if not 0 <= result[key] <= 2**32 - 1:
            raise DatasetValidationError(f"{key} must be between 0 and 2^32-1")

    max_depth = result["max_depth"]
    if max_depth is not None:
        if isinstance(max_depth, bool) or not isinstance(max_depth, int):
            raise DatasetValidationError("max_depth must be an integer or null")
        if not 1 <= max_depth <= 100:
            raise DatasetValidationError("max_depth must be between 1 and 100")

    test_size = result["test_size"]
    if isinstance(test_size, bool) or not isinstance(test_size, (int, float)):
        raise DatasetValidationError("test_size must be numeric")
    result["test_size"] = float(test_size)
    if not 0.1 <= result["test_size"] <= 0.5:
        raise DatasetValidationError("test_size must be between 0.1 and 0.5")
    return result


def _parse_label(raw_value: Any, row_number: int) -> int:
    normalized = str(raw_value).strip().lower()
    if normalized not in LABEL_ALIASES:
        raise DatasetValidationError(
            f"row {row_number}: label must be one of 0, 1, 2, "
            "Normal, Modbus Flood, or Logic Tampering"
        )
    return LABEL_ALIASES[normalized]


def parse_training_csv(dataset_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
    """Validate a strict five-column CSV and return features in canonical order."""

    if not isinstance(dataset_bytes, bytes):
        raise DatasetValidationError("csv_text must encode to bytes")
    if not dataset_bytes:
        raise DatasetValidationError("CSV dataset is empty")
    if len(dataset_bytes) > MAX_DATASET_BYTES:
        raise DatasetValidationError(
            f"CSV dataset exceeds the {MAX_DATASET_BYTES // (1024 * 1024)} MiB limit"
        )
    if b"\x00" in dataset_bytes:
        raise DatasetValidationError("CSV dataset contains NUL bytes")

    try:
        text = dataset_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise DatasetValidationError("CSV dataset must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(text, newline=""))
    fieldnames = reader.fieldnames
    expected = [*FEATURE_NAMES, "label"]
    if not fieldnames:
        raise DatasetValidationError("CSV dataset must include a header row")
    normalized_fields = [field.strip() if field is not None else "" for field in fieldnames]
    if len(set(normalized_fields)) != len(normalized_fields):
        raise DatasetValidationError("CSV header contains duplicate columns")
    if normalized_fields != expected:
        raise DatasetValidationError(
            "CSV columns must be in this exact order: " + ", ".join(expected)
        )

    features: list[list[float]] = []
    labels: list[int] = []
    for row_number, row in enumerate(reader, start=2):
        if len(features) >= MAX_DATASET_ROWS:
            raise DatasetValidationError(f"CSV dataset exceeds {MAX_DATASET_ROWS} rows")
        if None in row:
            raise DatasetValidationError(f"row {row_number}: too many CSV values")
        if any(row.get(column) is None for column in expected):
            raise DatasetValidationError(f"row {row_number}: missing CSV value")
        values: list[float] = []
        for feature in FEATURE_NAMES:
            raw_value = row.get(feature)
            try:
                value = float(raw_value)
            except (TypeError, ValueError) as exc:
                raise DatasetValidationError(
                    f"row {row_number}: {feature} must be numeric"
                ) from exc
            if not math.isfinite(value):
                raise DatasetValidationError(f"row {row_number}: {feature} must be finite")
            if feature in {"cpu_usage", "memory_usage"} and not 0 <= value <= 100:
                raise DatasetValidationError(
                    f"row {row_number}: {feature} must be between 0 and 100"
                )
            if feature in {"bytes_per_second", "packet_rate"} and value < 0:
                raise DatasetValidationError(
                    f"row {row_number}: {feature} cannot be negative"
                )
            values.append(value)
        features.append(values)
        labels.append(_parse_label(row.get("label"), row_number))

    if not features:
        raise DatasetValidationError("CSV dataset contains no data rows")
    distribution = Counter(labels)
    missing = sorted(set(LABEL_NAMES) - set(distribution))
    if missing:
        raise DatasetValidationError(
            "CSV dataset must contain all supported labels: 0, 1, and 2"
        )
    sparse = [str(label) for label, count in distribution.items() if count < MIN_ROWS_PER_CLASS]
    if sparse:
        raise DatasetValidationError(
            f"each label needs at least {MIN_ROWS_PER_CLASS} rows; insufficient: {', '.join(sparse)}"
        )

    return np.asarray(features, dtype=np.float64), np.asarray(labels, dtype=np.int64)


def generate_baseline_csv(seed: int = 42, num_samples: int = 2_000) -> bytes:
    """Generate a deterministic, explicitly-labelled development baseline."""

    random = np.random.default_rng(seed)
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow([*FEATURE_NAMES, "label"])
    groups = (
        (0, int(num_samples * 0.5), ((5, 45), (20, 55), (500, 3_000), (10, 80))),
        (1, int(num_samples * 0.25), ((85, 99), (75, 95), (120_000, 260_000), (3_000, 5_200))),
        (2, int(num_samples * 0.25), ((60, 82), (50, 75), (5_000, 16_000), (120, 350))),
    )
    for label, count, ranges in groups:
        for _ in range(count):
            writer.writerow([*(random.uniform(low, high) for low, high in ranges), label])
    return output.getvalue().encode("utf-8")


def _safe_filename(filename: str | None, has_upload: bool) -> str:
    fallback = "generated-baseline-v1.csv" if not has_upload else "uploaded-dataset.csv"
    if filename is None:
        return fallback
    if not has_upload:
        raise DatasetValidationError("filename requires csv_text")
    if not isinstance(filename, str) or not filename.strip():
        raise DatasetValidationError("filename must be a non-empty string")
    name = Path(filename.strip()).name
    if name != filename.strip() or len(name) > 180:
        raise DatasetValidationError("filename must be a plain filename of at most 180 characters")
    if not name.lower().endswith(".csv"):
        raise DatasetValidationError("training dataset filename must end in .csv")
    return name


def _artifact_metadata(path: Path) -> dict[str, Any]:
    return {
        "filename": path.name,
        "sha256": sha256_file(path),
        "size_bytes": path.stat().st_size,
    }


def _persist_candidate(
    model: RandomForestClassifier,
    scaler: StandardScaler,
    provenance: dict[str, Any],
    models_root: Path,
) -> None:
    models_root.mkdir(parents=True, exist_ok=True)
    model_id = provenance["model_id"]
    final_directory = models_root / model_id
    if final_directory.exists():
        raise RuntimeError(f"model candidate already exists: {model_id}")

    temporary_directory = Path(
        tempfile.mkdtemp(prefix=f".candidate-{model_id}-", dir=models_root)
    )
    try:
        model_path = temporary_directory / MODEL_FILENAME
        scaler_path = temporary_directory / SCALER_FILENAME
        with model_path.open("wb") as handle:
            pickle.dump(model, handle, protocol=pickle.HIGHEST_PROTOCOL)
            handle.flush()
            os.fsync(handle.fileno())
        with scaler_path.open("wb") as handle:
            pickle.dump(scaler, handle, protocol=pickle.HIGHEST_PROTOCOL)
            handle.flush()
            os.fsync(handle.fileno())

        provenance["artifacts"] = {
            "model": _artifact_metadata(model_path),
            "scaler": _artifact_metadata(scaler_path),
        }
        provenance_path = temporary_directory / PROVENANCE_FILENAME
        with provenance_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(provenance, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())

        os.replace(temporary_directory, final_directory)
    finally:
        if temporary_directory.exists():
            shutil.rmtree(temporary_directory)


def train_lightweight_anomaly_model(
    *,
    filename: str | None = None,
    csv_text: str | None = None,
    activate: bool = True,
    params: dict[str, Any] | None = None,
    models_root: Path | str = DEFAULT_MODELS_ROOT,
) -> dict[str, Any]:
    """Train, persist, validate, and optionally activate a model candidate."""

    if csv_text is not None and not isinstance(csv_text, str):
        raise DatasetValidationError("csv_text must be a string")
    has_upload = csv_text is not None
    dataset_bytes = (
        csv_text.encode("utf-8")
        if has_upload
        else generate_baseline_csv()
    )
    dataset_filename = _safe_filename(filename, has_upload)
    validated_params = _validate_params(params)
    features, labels = parse_training_csv(dataset_bytes)

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            features,
            labels,
            test_size=validated_params["test_size"],
            random_state=validated_params["split_seed"],
            stratify=labels,
        )
    except ValueError as exc:
        raise DatasetValidationError(
            f"dataset cannot be stratified with the requested test_size: {exc}"
        ) from exc
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    model = RandomForestClassifier(
        n_estimators=validated_params["n_estimators"],
        max_depth=validated_params["max_depth"],
        random_state=validated_params["model_seed"],
        n_jobs=1,
    )
    model.fit(X_train_scaled, y_train)
    predictions = model.predict(X_test_scaled)
    report = classification_report(
        y_test,
        predictions,
        labels=sorted(LABEL_NAMES),
        target_names=[LABEL_NAMES[index] for index in sorted(LABEL_NAMES)],
        output_dict=True,
        zero_division=0,
    )

    trained_at = _utc_now()
    compact_timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    model_id = f"rf-{compact_timestamp}-{uuid.uuid4().hex[:8]}"
    distribution = Counter(int(label) for label in labels)
    provenance: dict[str, Any] = {
        "schema_version": "ics-guard-model-provenance-v1",
        "model_id": model_id,
        "lifecycle_state": "candidate",
        "algorithm": "RandomForestClassifier",
        "trained_at": trained_at,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "feature_order": list(FEATURE_NAMES),
        "label_mapping": {str(key): value for key, value in LABEL_NAMES.items()},
        "dataset": {
            "filename": dataset_filename,
            "source": "uploaded_csv" if has_upload else "generated_baseline",
            "sha256": sha256_bytes(dataset_bytes),
            "size_bytes": len(dataset_bytes),
            "row_count": int(len(labels)),
            "class_distribution": {
                str(label): int(distribution[label]) for label in sorted(LABEL_NAMES)
            },
        },
        "training": {
            "estimator_params": model.get_params(deep=False),
            "split": {
                "test_size": validated_params["test_size"],
                "split_seed": validated_params["split_seed"],
                "stratified": True,
                "train_rows": int(len(y_train)),
                "test_rows": int(len(y_test)),
            },
        },
        "runtime_versions": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "scikit_learn": sklearn.__version__,
        },
        "metrics": {
            "accuracy": round(float(report["accuracy"]), 6),
            "macro_precision": round(float(report["macro avg"]["precision"]), 6),
            "macro_recall": round(float(report["macro avg"]["recall"]), 6),
            "macro_f1": round(float(report["macro avg"]["f1-score"]), 6),
            "per_class": {
                label_name: {
                    "precision": round(float(report[label_name]["precision"]), 6),
                    "recall": round(float(report[label_name]["recall"]), 6),
                    "f1": round(float(report[label_name]["f1-score"]), 6),
                    "support": int(report[label_name]["support"]),
                }
                for label_name in LABEL_NAMES.values()
            },
        },
    }

    root = Path(models_root)
    _persist_candidate(model, scaler, provenance, root)
    result = dict(provenance)
    if activate:
        result["activation"] = {
            "status": "active",
            **activate_candidate(model_id, root),
        }
    else:
        result["activation"] = {"status": "candidate"}
    return result


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    trained = train_lightweight_anomaly_model()
    print(json.dumps(trained, ensure_ascii=False, indent=2))
