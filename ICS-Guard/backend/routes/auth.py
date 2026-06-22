from fastapi import APIRouter, Depends, status
from typing import Any
from schemas.auth import LoginRequest, RegisterRequest, RefreshTokenRequest, Token
from modules.auth.service import (
    authenticate_user, 
    register_new_user, 
    save_refresh_token, 
    verify_and_rotate_refresh_token,
    revoke_refresh_token
)
from modules.auth.dependencies import get_current_user
from common.security import create_access_token, create_refresh_token
from schemas.users import UserResponse
from common.responses import success_response, ResponseSchema

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=ResponseSchema[dict], status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    user = await register_new_user(request)
    return success_response(
        data={
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"]
        },
        message="Đăng ký tài khoản thành công"
    )

@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    user = await authenticate_user(request)
    
    user_id_str = str(user["_id"])
    access_token = create_access_token(subject=user_id_str)
    refresh_token = create_refresh_token(subject=user_id_str)
    
    # Save refresh token to DB
    await save_refresh_token(user_id=user_id_str, token=refresh_token)
    
    user_info = user.copy()
    user_info["_id"] = str(user_info["_id"])
    user_info.pop("password_hash", None)
    
    token_data = Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_info
    )
    return token_data

@router.post("/refresh", response_model=Token)
async def refresh_token(request: RefreshTokenRequest):
    new_token = await verify_and_rotate_refresh_token(request.refresh_token)
    return new_token

@router.post("/logout", response_model=ResponseSchema[Any])
async def logout(request: RefreshTokenRequest, current_user: dict = Depends(get_current_user)):
    await revoke_refresh_token(request.refresh_token)
    return success_response(message="Đăng xuất thành công")


