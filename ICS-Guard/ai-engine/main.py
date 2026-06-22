from fastapi import FastAPI, HTTPException
from typing import List
import uvicorn

# Import các models và hàm xử lý của chúng ta
from app.core.models import Incident, Alert, AIAnalysis
from app.assistant.analyzer import analyze_incident

app = FastAPI(
    title="ICS-Guard AI Engine API",
    description="API phân tích sự cố bảo mật tự động bằng AI",
    version="1.0.0"
)

@app.post("/api/v1/analyze", response_model=AIAnalysis, tags=["AI Assistant"])
async def api_analyze_incident(incident: Incident, alerts: List[Alert]):
    """
    Nhận thông tin Incident và danh sách Alerts từ client, 
    sau đó gửi cho AI (Ollama) phân tích và trả về báo cáo JSON.
    """
    try:
        # Gọi hàm AI Analyzer mà chúng ta đã viết
        analysis_result = analyze_incident(
            incident=incident,
            alerts=alerts,
            model_name="llama3.1:latest" # Bạn có thể đặt model name vào tham số hoặc env
        )
        return analysis_result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi gọi AI: {str(e)}")

# Nếu bạn muốn chạy file này trực tiếp
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
