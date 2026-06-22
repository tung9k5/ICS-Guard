from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.base import DBModel

class IncidentTimelineModel(DBModel):
    incident_id: str
    event_time: datetime = Field(default_factory=datetime.utcnow)
    actor: str
    action_type: str
    description: str

    class Config:
        populate_by_name = True
