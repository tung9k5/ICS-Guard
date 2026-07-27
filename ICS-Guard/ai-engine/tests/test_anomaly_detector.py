import unittest

from app.services.anomaly.detector import FEATURE_NAMES, detector


class AnomalyDetectorTests(unittest.TestCase):
    def test_model_artifacts_match_feature_schema(self):
        self.assertEqual(detector.model.n_features_in_, len(FEATURE_NAMES))
        self.assertEqual(detector.scaler.n_features_in_, len(FEATURE_NAMES))

    def test_normal_telemetry_is_classified(self):
        result = detector.classify({
            "cpu_usage": 20,
            "memory_usage": 35,
            "bytes_per_second": 1500,
            "packet_rate": 40,
        })
        self.assertEqual(result["label"], "Normal")
        self.assertEqual(result["label_id"], 0)

    def test_packet_rate_alias_is_supported(self):
        result = detector.classify({
            "cpu_usage": 95,
            "memory_usage": 85,
            "bytes_per_second": 180000,
            "packet_forward_rate": 4000,
        })
        self.assertEqual(result["label"], "Modbus Flood")
        self.assertGreaterEqual(result["confidence"], 0.8)

    def test_non_numeric_metric_is_rejected(self):
        with self.assertRaises(ValueError):
            detector.classify({"cpu_usage": "not-a-number"})


if __name__ == "__main__":
    unittest.main()
