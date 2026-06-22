from typing import Optional
from database.mongodb import get_database
from schemas.users import UserCreate
from common.security import get_password_hash
from datetime import datetime
from bson import ObjectId

async def get_user_collection():
    db = get_database()
    return db.users

async def get_user_by_email(email: str) -> Optional[dict]:
    collection = await get_user_collection()
    user = await collection.find_one({"email": email})
    return user

async def get_user_by_username(username: str) -> Optional[dict]:
    collection = await get_user_collection()
    user = await collection.find_one({"username": username})
    return user

async def get_user_by_id(user_id: str) -> Optional[dict]:
    collection = await get_user_collection()
    try:
        user = await collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await collection.find_one({"_id": user_id})
    return user

async def create_user(user_in: UserCreate) -> dict:
    collection = await get_user_collection()
    user_dict = user_in.model_dump()
    
    # Hash password
    hashed_password = get_password_hash(user_dict.pop("password"))
    user_dict["password_hash"] = hashed_password
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    user_dict["login_failures_count"] = 0
    user_dict["last_failed_at"] = None
    user_dict["lockout_until"] = None
    
    result = await collection.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    return user_dict
