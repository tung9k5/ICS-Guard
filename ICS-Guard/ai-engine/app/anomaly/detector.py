from typing import Optional
from datetime import datetime
from app.core.models import IoTTelemetry, NetworkTraffic, Alert, RawEvent
from app.core.constants import Severity, AlertStatus

class AnomalyDetector:
    def __init__(self, cpu_threshold: float = 90.0, traffic_threshold: float = 50000.0):
        self.cpu_threshold = cpu_threshold
        self.traffic_threshold = traffic_threshold

    def analyze_telemetry(self, telemetry: IoTTelemetry) -> Optional[Alert]:
        """Phát hiện bất thường trên Telemetry."""
        if telemetry.cpu_usage > self.cpu_threshold:
            return Alert(
                rule_name="AI_ANOMALY_TELEMETRY",
                device_id=telemetry.device_id,
                title="Bất thường CPU tăng cao (Anomaly)",
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
