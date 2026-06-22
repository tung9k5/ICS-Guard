from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.base import DBModel, TimestampModel

class IncidentModel(DBModel, TimestampModel):
    title: str
    description: str
    status: str
    severity: str
    assigned_to: Optional[str] = None
    closed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
