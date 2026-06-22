from pydantic import EmailStr, Field
from typing import Optional
from datetime import datetime
from models.base import DBModel, TimestampModel

class UserModel(DBModel, TimestampModel):
    username: str
    email: EmailStr
    password_hash: str
    full_name: Optional[str] = None
    role: str = "ADMIN"
    is_active: bool = True
    login_failures_count: int = 0
    last_failed_at: Optional[datetime] = None
    lockout_until: Optional[datetime] = None

    class Config:
        populate_by_name = True
