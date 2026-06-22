from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DeviceCVEBase(BaseModel):
    device_id: str
    cve_id: str
    cvss_score: float
    description: str
    severity: str
    status: str

class DeviceCVECreate(DeviceCVEBase):
    pass

class DeviceCVEUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    patched_at: Optional[datetime] = None

class DeviceCVEResponse(DeviceCVEBase):
    id: str = Field(alias="_id")
    detected_at: datetime
    patched_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
