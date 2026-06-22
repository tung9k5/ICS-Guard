from datetime import datetime
from typing import List, Optional, Dict, Any, Annotated
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from app.core.constants import (
    Role, DeviceType, DeviceStatus, Severity, CVEStatus,
    AlertStatus, IncidentStatus, ActionType
)

PyObjectId = Annotated[str, BeforeValidator(str)]

class LoginFailures(BaseModel):
    count: int = Field(ge=0)
    last_failed_at: Optional[datetime] = None
    lockout_until: Optional[datetime] = None

class User(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    username: str
    password_hash: str
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool = True
    login_failures: LoginFailures
    created_at: datetime
    updated_at: datetime

class BaselineMetrics(BaseModel):
    bytes_per_second_max: float
    connection_rate_max: float

class Device(BaseModel):
    id: str = Field(alias="_id")
    name: str
    type: DeviceType
    zone: str
    ip_address: str
    mac_address: str
    status: DeviceStatus
    risk_score: float = Field(ge=0, le=100)
    api_key: str
    baseline_metrics: BaselineMetrics
    firmware_version: str
    hardware_model: str
    created_at: datetime
    updated_at: datetime

class DeviceCVE(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    device_id: str
    cve_id: str
    cvss_score: float = Field(ge=0, le=10)
    description: str
    severity: Severity
    status: CVEStatus
    detected_at: datetime
    patched_at: Optional[datetime] = None

class RuleCondition(BaseModel):
    field: str
    operator: str
    value: Any

class RuleAction(BaseModel):
    action_type: str
    config: Dict[str, Any]

class Rule(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    rule_name: str
    description: str
    is_active: bool
    severity: Severity
    conditions: List[RuleCondition]
    time_window_seconds: int
    trigger_count: int
    group_by: List[str]
    actions: List[RuleAction]
    created_by: PyObjectId
    created_at: datetime
    updated_at: datetime

class RawEvent(BaseModel):
    timestamp: datetime
    message: str

class Alert(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    rule_name: Optional[str] = None
    device_id: str
    title: str
    description: str
    severity: Severity
    status: AlertStatus
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    event_count: int
    raw_events_sample: List[RawEvent]
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[PyObjectId] = None
    incident_id: Optional[PyObjectId] = None

class Incident(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    title: str
    description: str
    status: IncidentStatus
    severity: Severity
    assigned_to: Optional[PyObjectId] = None
    alert_ids: List[PyObjectId]
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None

class IncidentTimeline(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    incident_id: PyObjectId
    event_time: datetime
    actor: str
    action_type: ActionType
    description: str
    metadata: Dict[str, Any]

class PlaybookStep(BaseModel):
    step_number: int
    action_type: str
    parameters: Dict[str, Any]

class Playbook(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    description: str
    is_active: bool
    steps: List[PlaybookStep]
    created_at: datetime
    updated_at: datetime

class MitreAttackMapping(BaseModel):
    tactic: str
    technique_id: str
    technique_name: str

class RemediationAdvice(BaseModel):
    step: str
    priority: Severity

class AIAnalysis(BaseModel):
    model_config = {'protected_namespaces': ()}
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    incident_id: PyObjectId
    log_summary: str
    attack_reasoning: str
    mitre_attack_mappings: List[MitreAttackMapping]
    remediation_advice: List[RemediationAdvice]
    model_used: str
    generated_at: datetime

class AuditLog(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId
    username: str
    action: str
    target_resource: str
    details: Dict[str, Any]
    ip_address: str
    user_agent: str
    status: str
    timestamp: datetime

class IoTTelemetry(BaseModel):
    device_id: str
    device_type: DeviceType
    zone: str
    cpu_usage: float
    memory_usage: float
    temperature: float
    pressure: Optional[float] = None
    status: int
    timestamp: datetime

class NetworkTraffic(BaseModel):
    device_id: str
    zone: str
    protocol: str
    bytes_per_second: float
    packets_per_second: float
    connections_count: int
    timestamp: datetime
