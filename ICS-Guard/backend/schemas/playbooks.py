from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PlaybookBase(BaseModel):
    name: str
    description: str
    is_active: bool = True

class PlaybookCreate(PlaybookBase):
    pass

class PlaybookUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class PlaybookResponse(PlaybookBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
