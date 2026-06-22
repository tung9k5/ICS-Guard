import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="ICS-Guard Backend API")

# Đọc cấu hình từ biến môi trường (Docker hoặc .env)
frontend_url = os.getenv("FRONTEND_URL")

# Cấu hình CORS để cho phép Frontend React gọi API
origins = [frontend_url] if frontend_url else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hàm hỗ trợ trả dữ liệu JSON theo format thống nhất
def success_response(data, message="Success"):
    return {
        "status": "success",
        "message": message,
        "data": data
    }

@app.get("/api/health")
def health_check():
    return success_response({"status": "healthy"}, "Service is running")

class EventPayload(BaseModel):
    device_id: str
    event_type: str
    description: str
