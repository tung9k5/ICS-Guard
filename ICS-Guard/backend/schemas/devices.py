from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NetworkInfoBase(BaseModel):
    ip_address: str
    mac_address: str

class DeviceBase(BaseModel):
    device_id: str
    name: str
    type: str
    zone: str
    ip_address: str
    mac_address: str
    status: str = "ONLINE"
    risk_score: float = 0.0
    firmware_version: str
    hardware_model: str

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    zone: Optional[str] = None
    status: Optional[str] = None
    risk_score: Optional[float] = None
    firmware_version: Optional[str] = None

class DeviceResponse(DeviceBase):
    id: str = Field(alias="_id")
    api_key: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
