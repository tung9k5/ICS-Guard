from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.base import DBModel

class PlaybookExecutionModel(DBModel):
    playbook_id: str
    incident_id: str
    status: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
