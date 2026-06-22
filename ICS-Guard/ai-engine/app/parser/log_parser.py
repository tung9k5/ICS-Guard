import json
from datetime import datetime
from typing import Optional
from app.core.models import RawEvent, IoTTelemetry, NetworkTraffic

class LogParser:
    @staticmethod
    def parse_raw_event(log_message: str) -> RawEvent:
        """Parse raw string into RawEvent."""
        return RawEvent(
            timestamp=datetime.utcnow(),
            message=log_message
        )
    
    @staticmethod
    def parse_telemetry_json(json_str: str) -> Optional[IoTTelemetry]:
        """Parse JSON string into IoTTelemetry object."""
        try:
            data = json.loads(json_str)
            if "timestamp" not in data:
                data["timestamp"] = datetime.utcnow().isoformat()
            # Tự động parse và validate dữ liệu
            return IoTTelemetry(**data)
        except Exception as e:
            print(f"Lỗi parse telemetry: {e}")
            return None

    @staticmethod
    def parse_network_json(json_str: str) -> Optional[NetworkTraffic]:
        """Parse JSON string into NetworkTraffic object."""
        try:
            data = json.loads(json_str)
            if "timestamp" not in data:
                data["timestamp"] = datetime.utcnow().isoformat()
            return NetworkTraffic(**data)
        except Exception as e:
            print(f"Lỗi parse network traffic: {e}")
            return None
