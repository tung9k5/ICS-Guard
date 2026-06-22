from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class DBModel(BaseModel):
    id: Optional[str] = Field(None, alias="_id")

class TimestampModel(BaseModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
