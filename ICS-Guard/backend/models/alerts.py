from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.base import DBModel

class AlertModel(DBModel):
    rule_name: str
    device_id: str
    title: str
    description: str
    severity: str
    status: str
    source_ip: str
    destination_ip: str
    event_count: int
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    incident_id: Optional[str] = None

    class Config:
        populate_by_name = True
