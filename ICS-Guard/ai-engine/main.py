from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from typing import List
import uvicorn
import os

from app.core.models import Incident, Alert, AIAnalysis
from app.assistant.analyzer import analyze_incident
from app.core.config import settings

# Setup basic API Key auth for internal microservice communication
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

def verify_api_key(api_key_header: str = Security(api_key_header)):
    # Lấy API Key từ config (nếu không có thì dùng mặc định cho dev)
    expected_api_key = os.getenv("ICS_GUARD_AI_API_KEY", "ics-guard-secret-key")
    if api_key_header != expected_api_key:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid API Key")
    return api_key_header

app = FastAPI(
    title="ICS-Guard AI Engine API",
    description="API phân tích sự cố bảo mật tự động bằng AI (Đã được tối ưu tốc độ & Async)",
    version="1.1.0"
)

@app.post("/api/v1/analyze", response_model=AIAnalysis, tags=["AI Assistant"])
async def api_analyze_incident(
    incident: Incident, 
    alerts: List[Alert]
):
    """
    Nhận thông tin Incident và danh sách Alerts từ client, 
    sau đó gửi cho AI phân tích (Async) và trả về báo cáo JSON.
    """
    try:
        # Sử dụng await do analyzer đã chuyển sang async
        analysis_result = await analyze_incident(
            incident=incident,
            alerts=alerts
            # model_name được tự động lấy từ config trong analyzer.py
        )
        return analysis_result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi gọi AI: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
