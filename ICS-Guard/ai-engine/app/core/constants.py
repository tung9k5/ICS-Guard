from enum import Enum

class Role(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"

class DeviceType(str, Enum):
    PLC = "plc"
    SMART_METER = "smart_meter"
    SENSOR = "sensor"
    CAMERA = "camera"

class DeviceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    QUARANTINED = "quarantined"

class Severity(str, Enum):
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class CVEStatus(str, Enum):
    VULNERABLE = "vulnerable"
    PATCHED = "patched"
    IGNORED = "ignored"

class AlertStatus(str, Enum):
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"

class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    REMEDIATED = "remediated"
    CLOSED = "closed"

class ActionType(str, Enum):
    INCIDENT_CREATED = "incident_created"
    AUTO_RESPONSE = "auto_response"
    AI_ANALYSIS = "ai_analysis"
    STATUS_CHANGE = "status_change"
    MANUAL_NOTE = "manual_note"
    BLOCK_IP = "block_ip"
    ISOLATE_DEVICE = "isolate_device"
    SEND_TELEGRAM = "send_telegram"
    EMAIL = "email"

class Protocol(str, Enum):
    MQTT = "mqtt"
    REST_API = "rest_api"
    SSH = "ssh"

class StatusInt(int, Enum):
    NORMAL = 1
    ERROR = 0
