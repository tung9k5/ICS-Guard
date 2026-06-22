from pydantic import BaseModel, Field
from datetime import datetime
from models.base import DBModel

class RefreshTokenModel(DBModel):
    user_id: str
    token: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_revoked: bool = False

    class Config:
        populate_by_name = True
