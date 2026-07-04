import os
import pickle
import time
import numpy as np
from datetime import datetime
from typing import Optional
from app.core.models import IoTTelemetry, NetworkTraffic, Alert, RawEvent
from app.core.constants import Severity, AlertStatus

class AnomalyDetector:
    def __init__(self, cpu_threshold: float = 90.0, traffic_threshold: float = 50000.0):
        self.cpu_threshold = cpu_threshold
        self.traffic_threshold = traffic_threshold
        self.model = None
        self.scaler = None
        
        # Tải mô hình Học máy Random Forest Classifier
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        model_path = os.path.join(base_dir, "telemetry_classifier.pkl")
        scaler_path = os.path.join(base_dir, "scaler.pkl")
        
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            try:
                with open(model_path, "rb") as f:
                    self.model = pickle.load(f)
                with open(scaler_path, "rb") as f:
                    self.scaler = pickle.load(f)
                print("[AnomalyDetector] Đã tải thành công mô hình Random Forest Classifier.")
            except Exception as e:
                print(f"[AnomalyDetector] Không thể tải mô hình Random Forest: {e}")

    def analyze_telemetry(self, telemetry: IoTTelemetry) -> Optional[Alert]:
        """Phát hiện bất thường trên Telemetry bằng Random Forest Classifier (<1ms)."""
        if self.model is None or self.scaler is None:
            # Fallback sang phát hiện theo ngưỡng tĩnh nếu chưa tải được mô hình
            if telemetry.cpu_usage > self.cpu_threshold:
                return Alert(
                    rule_name="AI_ANOMALY_TELEMETRY",
                    device_id=telemetry.device_id,
                    title="Bất thường CPU tăng cao (Threshold)",
                    description=f"CPU usage đạt {telemetry.cpu_usage}%, vượt ngưỡng {self.cpu_threshold}%.",
                    severity=Severity.HIGH,
                    status=AlertStatus.NEW,
                    event_count=1,
                    raw_events_sample=[
                        RawEvent(timestamp=telemetry.timestamp, message=f"CPU: {telemetry.cpu_usage}%")
                    ],
                    detected_at=datetime.utcnow()
                )
            return None

        # Trích xuất các đặc trưng đầu vào cho mô hình:
        # [cpu_usage, memory_usage, bytes_per_second, packet_rate]
        cpu = telemetry.cpu_usage
        mem = telemetry.memory_usage
        
        # Lấy bytes_per_second và packet_rate giả lập tương quan dựa trên metrics tải
        bps = 0.0
        pkt_rate = 0.0
        
        if cpu > 80.0 and mem > 70.0:
            bps = 150000.0
            pkt_rate = 4000.0
        elif cpu > 55.0 and mem > 45.0:
            bps = 8000.0
            pkt_rate = 200.0
        else:
            bps = 1000.0
            pkt_rate = 30.0

        features = np.array([[cpu, mem, bps, pkt_rate]])

        t_start = time.perf_counter()
        
        features_scaled = self.scaler.transform(features)
        prediction = self.model.predict(features_scaled)[0]
        
        t_end = time.perf_counter()
        inference_time_ms = (t_end - t_start) * 1000.0

        print(f"[ML Inference] Device: {telemetry.device_id} | Class: {prediction} | Speed: {inference_time_ms:.4f}ms")

        # Phân loại dựa trên nhãn mô hình ML:
        # 0: Normal, 1: Modbus Flood (Anomaly), 2: Logic Tampering (Anomaly)
        if prediction == 1:
            return Alert(
                rule_name="ML_MODBUS_FLOOD_DETECTED",
                device_id=telemetry.device_id,
                title="Tấn công Modbus Flood (ML)",
                description=f"Học máy phát hiện bất thường trùng khớp hành vi tấn công Modbus Flood (Thời gian suy luận: {inference_time_ms:.3f}ms, CPU: {cpu}%, RAM: {mem}%).",
                severity=Severity.HIGH,
                status=AlertStatus.NEW,
                event_count=1,
                raw_events_sample=[
                    RawEvent(timestamp=telemetry.timestamp, message=f"ML Anomaly score detected. Speed={inference_time_ms:.3f}ms")
                ],
                detected_at=datetime.utcnow()
            )
        elif prediction == 2:
            return Alert(
                rule_name="ML_LOGIC_TAMPERING_DETECTED",
                device_id=telemetry.device_id,
                title="Tấn công sửa đổi Logic PLC (ML)",
                description=f"Học máy phát hiện sửa đổi logic PLC bất hợp pháp (Thời gian suy luận: {inference_time_ms:.3f}ms, CPU: {cpu}%, RAM: {mem}%).",
                severity=Severity.CRITICAL,
                status=AlertStatus.NEW,
                event_count=1,
                raw_events_sample=[
                    RawEvent(timestamp=telemetry.timestamp, message=f"ML Anomaly score detected. Speed={inference_time_ms:.3f}ms")
                ],
                detected_at=datetime.utcnow()
            )

        return None

    def analyze_traffic(self, traffic: NetworkTraffic) -> Optional[Alert]:
        """Phát hiện bất thường trên Network Traffic."""
        if traffic.bytes_per_second > self.traffic_threshold:
            return Alert(
                rule_name="AI_ANOMALY_TRAFFIC",
                device_id=traffic.device_id,
                title="Đột biến lưu lượng mạng (Spike)",
                description=f"Lưu lượng mạng đạt {traffic.bytes_per_second} bytes/s.",
                severity=Severity.HIGH,
                status=AlertStatus.NEW,
                source_ip=None,
                destination_ip=None,
                event_count=1,
                raw_events_sample=[
                    RawEvent(timestamp=traffic.timestamp, message=f"Bytes/sec: {traffic.bytes_per_second}")
                ],
                detected_at=datetime.utcnow()
            )
        return None
