from pydantic import BaseModel, Field
from datetime import datetime

class AIAnalysisBase(BaseModel):
    incident_id: str
    log_summary: str
    attack_reasoning: str
    model_used: str

class AIAnalysisCreate(AIAnalysisBase):
    pass

class AIAnalysisResponse(AIAnalysisBase):
    id: str = Field(alias="_id")
    generated_at: datetime

    class Config:
        populate_by_name = True
