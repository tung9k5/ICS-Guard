import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from app.services.anomaly.detector import AnomalyDetector
from train_model import DatasetValidationError, train_lightweight_anomaly_model


VALID_CSV = """cpu_usage,memory_usage,bytes_per_second,packet_rate,label
10,20,1000,20,0
15,25,1200,25,Normal
20,30,1500,30,0
25,35,1800,35,Normal
90,80,150000,3500,1
92,82,170000,3800,Modbus Flood
94,84,190000,4100,1
96,86,210000,4400,Modbus Flood
65,55,7000,150,2
68,58,8500,180,Logic Tampering
72,62,10000,210,2
76,66,12000,250,Logic Tampering
"""


class ModelLifecycleTests(unittest.TestCase):
    def test_uploaded_csv_creates_versioned_candidate_and_active_pointer(self):
        with tempfile.TemporaryDirectory() as temporary:
            models_root = Path(temporary) / "models"
            provenance = train_lightweight_anomaly_model(
                filename="telemetry.csv",
                csv_text=VALID_CSV,
                activate=True,
                params={"n_estimators": 5},
                models_root=models_root,
            )

            model_id = provenance["model_id"]
            candidate = models_root / model_id
            self.assertTrue((candidate / "model.pkl").is_file())
            self.assertTrue((candidate / "scaler.pkl").is_file())
            self.assertTrue((candidate / "provenance.json").is_file())
            self.assertEqual(
                provenance["dataset"]["sha256"],
                hashlib.sha256(VALID_CSV.encode("utf-8")).hexdigest(),
            )
            self.assertEqual(provenance["feature_order"], [
                "cpu_usage",
                "memory_usage",
                "bytes_per_second",
                "packet_rate",
            ])

            pointer = json.loads((models_root / "active_model.json").read_text("utf-8"))
            self.assertEqual(pointer["active_model_id"], model_id)
            detector = AnomalyDetector(models_root=models_root)
            self.assertEqual(detector.classify({
                "cpu_usage": 10,
                "memory_usage": 20,
                "bytes_per_second": 1000,
                "packet_rate": 20,
            })["model_id"], model_id)

    def test_invalid_pointer_does_not_replace_last_valid_model(self):
        with tempfile.TemporaryDirectory() as temporary:
            models_root = Path(temporary) / "models"
            provenance = train_lightweight_anomaly_model(
                filename="telemetry.csv",
                csv_text=VALID_CSV,
                activate=True,
                params={"n_estimators": 5},
                models_root=models_root,
            )
            detector = AnomalyDetector(models_root=models_root)
            (models_root / "active_model.json").write_text(
                '{"active_model_id":"missing","provenance_sha256":"invalid"}',
                encoding="utf-8",
            )

            self.assertFalse(detector.reload_if_needed())
            self.assertEqual(detector.status()["model_id"], provenance["model_id"])
            self.assertIsNotNone(detector.status()["reload_error"])

    def test_csv_schema_is_strictly_validated(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(DatasetValidationError):
                train_lightweight_anomaly_model(
                    filename="bad.csv",
                    csv_text="cpu_usage,label\n20,0\n",
                    activate=False,
                    models_root=Path(temporary) / "models",
                )


if __name__ == "__main__":
    unittest.main()
