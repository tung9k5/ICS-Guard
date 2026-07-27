import os
import pickle


FEATURE_SCHEMA_VERSION = "telemetry-v1"
FEATURE_NAMES = (
    "cpu_usage",
    "memory_usage",
    "bytes_per_second",
    "packet_rate",
)
LABEL_NAMES = {
    0: "Normal",
    1: "Modbus Flood",
    2: "Logic Tampering",
}

class AnomalyDetector:
    def __init__(self):
        base = os.path.dirname(__file__)
        with open(os.path.join(base, "../../../telemetry_classifier.pkl"), "rb") as f:
            self.model = pickle.load(f)
        with open(os.path.join(base, "../../../scaler.pkl"), "rb") as f:
            self.scaler = pickle.load(f)

        model_features = getattr(self.model, "n_features_in_", None)
        scaler_features = getattr(self.scaler, "n_features_in_", None)
        expected_features = len(FEATURE_NAMES)
        if model_features != expected_features or scaler_features != expected_features:
            raise RuntimeError(
                "Incompatible anomaly model artifacts: "
                f"schema {FEATURE_SCHEMA_VERSION} expects {expected_features} features, "
                f"model has {model_features}, scaler has {scaler_features}."
            )

    def classify(self, metrics: dict) -> dict:
        if not isinstance(metrics, dict):
            raise ValueError("metrics must be an object")

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

        X = self.scaler.transform([features])
        label_id = int(self.model.predict(X)[0])
        proba = self.model.predict_proba(X)[0].max()
        return {
            "label": LABEL_NAMES.get(label_id, f"Unknown-{label_id}"),
            "label_id": label_id,
            "confidence": round(float(proba), 3),
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
        }

detector = AnomalyDetector()
