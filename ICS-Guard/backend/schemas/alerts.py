from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AlertBase(BaseModel):
    rule_name: str
    device_id: str
    title: str
    description: str
    severity: str
    status: str
    source_ip: str
    destination_ip: str
    event_count: int
    incident_id: Optional[str] = None

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    status: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    incident_id: Optional[str] = None

class AlertResponse(AlertBase):
    id: str = Field(alias="_id")
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

    class Config:
        populate_by_name = True
