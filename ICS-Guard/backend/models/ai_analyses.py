from pydantic import BaseModel, Field
from datetime import datetime
from models.base import DBModel

class AIAnalysisModel(DBModel):
    incident_id: str
    log_summary: str
    attack_reasoning: str
    model_used: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
