from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class RuleBase(BaseModel):
    rule_name: str
    description: str
    is_active: bool = True
    severity: str
    time_window_seconds: int
    trigger_count: int

class RuleCreate(RuleBase):
    created_by: str

class RuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    severity: Optional[str] = None
    time_window_seconds: Optional[int] = None
    trigger_count: Optional[int] = None

class RuleResponse(RuleBase):
    id: str = Field(alias="_id")
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
