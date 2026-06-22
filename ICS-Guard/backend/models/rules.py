from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from models.base import DBModel, TimestampModel

class RuleModel(DBModel, TimestampModel):
    rule_name: str
    description: str
    is_active: bool = True
    severity: str
    time_window_seconds: int
    trigger_count: int
    created_by: str

    class Config:
        populate_by_name = True
