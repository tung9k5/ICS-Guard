from datetime import datetime
from fastapi import HTTPException, status
from database.mongodb import get_database
from modules.users.service import get_user_by_email, get_user_by_username, create_user
from schemas.users import UserCreate
from schemas.auth import LoginRequest, RegisterRequest, Token
from common.security import verify_password, create_access_token, create_refresh_token, decode_token

async def get_token_collection():
    db = get_database()
    return db.refresh_tokens

async def authenticate_user(login_data: LoginRequest) -> dict:
    user = await get_user_by_email(login_data.username_or_email)
    if not user:
        user = await get_user_by_username(login_data.username_or_email)
        
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản hoặc mật khẩu không chính xác")
        
    if not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tài khoản đã bị vô hiệu hóa")

    # Check password
    if not verify_password(login_data.password, user["password_hash"]):
        # Implement account lockout logic here if needed
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản hoặc mật khẩu không chính xác")
        
    return user

async def register_new_user(register_data: RegisterRequest) -> dict:
    # Check duplicate
    if await get_user_by_email(register_data.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email này đã được đăng ký")
    if await get_user_by_username(register_data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên đăng nhập đã tồn tại")
        
    # Create user
    user_in = UserCreate(
        username=register_data.username,
        email=register_data.email,
        password=register_data.password,
        full_name=register_data.full_name,
        role="viewer" # default role
    )
    user = await create_user(user_in)
    return user

async def save_refresh_token(user_id: str, token: str):
    collection = await get_token_collection()
    token_data = {
        "user_id": user_id,
        "token": token,
        "created_at": datetime.utcnow(),
        "is_revoked": False
    }
    await collection.insert_one(token_data)

async def verify_and_rotate_refresh_token(old_token: str) -> Token:
    try:
        payload = decode_token(old_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Loại token không hợp lệ")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token không hợp lệ")

    collection = await get_token_collection()
    db_token = await collection.find_one({"token": old_token, "user_id": user_id})
    
    if not db_token or db_token.get("is_revoked"):
        # Token reuse detection / invalid token
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ hoặc đã bị thu hồi")
        
    # Revoke old token
    await collection.update_one({"_id": db_token["_id"]}, {"$set": {"is_revoked": True}})
    
    # Generate new tokens
    access_token = create_access_token(subject=user_id)
    new_refresh_token = create_refresh_token(subject=user_id)
    
    # Save new refresh token
    await save_refresh_token(user_id, new_refresh_token)
    
    return Token(access_token=access_token, refresh_token=new_refresh_token, token_type="bearer")

async def revoke_refresh_token(token: str):
    collection = await get_token_collection()
    await collection.update_one({"token": token}, {"$set": {"is_revoked": True}})
