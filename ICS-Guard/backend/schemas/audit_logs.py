from pydantic import BaseModel, Field
from datetime import datetime

class AuditLogBase(BaseModel):
    user_id: str
    username: str
    action: str
    target_resource: str
    ip_address: str
    user_agent: str
    status: str

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    id: str = Field(alias="_id")
    timestamp: datetime

    class Config:
        populate_by_name = True
