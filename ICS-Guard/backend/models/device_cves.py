from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.base import DBModel

class DeviceCVEModel(DBModel):
    device_id: str
    cve_id: str
    cvss_score: float
    description: str
    severity: str
    status: str
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    patched_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
