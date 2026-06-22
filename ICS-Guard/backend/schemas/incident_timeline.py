from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class IncidentTimelineBase(BaseModel):
    incident_id: str
    actor: str
    action_type: str
    description: str

class IncidentTimelineCreate(IncidentTimelineBase):
    pass

class IncidentTimelineResponse(IncidentTimelineBase):
    id: str = Field(alias="_id")
    event_time: datetime

    class Config:
        populate_by_name = True
