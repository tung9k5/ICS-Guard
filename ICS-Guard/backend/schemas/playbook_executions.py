from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PlaybookExecutionBase(BaseModel):
    playbook_id: str
    incident_id: str
    status: str

class PlaybookExecutionCreate(PlaybookExecutionBase):
    pass

class PlaybookExecutionUpdate(BaseModel):
    status: Optional[str] = None
    completed_at: Optional[datetime] = None

class PlaybookExecutionResponse(PlaybookExecutionBase):
    id: str = Field(alias="_id")
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
