from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class IncidentBase(BaseModel):
    title: str
    description: str
    status: str
    severity: str
    assigned_to: Optional[str] = None

class IncidentCreate(IncidentBase):
    pass

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    assigned_to: Optional[str] = None
    closed_at: Optional[datetime] = None

class IncidentResponse(IncidentBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
