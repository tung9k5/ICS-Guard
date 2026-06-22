from pydantic import BaseModel, Field
from datetime import datetime
from models.base import DBModel

class AuditLogModel(DBModel):
    user_id: str
    username: str
    action: str
    target_resource: str
    ip_address: str
    user_agent: str
    status: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
