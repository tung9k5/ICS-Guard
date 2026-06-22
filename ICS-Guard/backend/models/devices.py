from pydantic import BaseModel, Field
from typing import Optional
from models.base import DBModel, TimestampModel

class DeviceModel(DBModel, TimestampModel):
    name: str
    type: str
    zone: str
    ip_address: str
    mac_address: str
    status: str
    risk_score: float = 0.0
    api_key: str
    firmware_version: str
    hardware_model: str

    class Config:
        populate_by_name = True
