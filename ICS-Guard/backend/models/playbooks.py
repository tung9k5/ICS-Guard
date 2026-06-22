from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.base import DBModel, TimestampModel

class PlaybookModel(DBModel, TimestampModel):
    name: str
    description: str
    is_active: bool = True

    class Config:
        populate_by_name = True
