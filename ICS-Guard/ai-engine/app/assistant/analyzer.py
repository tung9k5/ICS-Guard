import requests
import json
from datetime import datetime
from typing import List
from app.core.models import Incident, Alert, AIAnalysis, MitreAttackMapping, RemediationAdvice
from app.core.constants import Severity
from app.assistant.prompts import get_incident_analysis_prompt
from app.core.config import settings

def analyze_incident(incident: Incident, alerts: List[Alert], model_name: str = None) -> AIAnalysis:
    """
    Sử dụng Google Gemini 1.5 Flash API (nếu có key) hoặc Ollama cục bộ để phân tích sự cố bảo mật.
    """
    prompt = get_incident_analysis_prompt(incident, alerts)
    ai_response_text = None
    model_used = "gemini-1.5-flash"
    
    # 1. Gọi Google Gemini 1.5 Flash nếu cấu hình API Key trong file .env
    if settings.GEMINI_API_KEY:
        print("[AI-Engine LLM] Phát hiện Gemini API Key. Đang sử dụng Gemini 1.5 Flash (Cloud Mode)...")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            ai_response_text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            model_used = "gemini-1.5-flash"
            
        except Exception as e:
            print(f"[AI-Engine LLM] Lỗi khi gọi Gemini API (chuyển sang chế độ Fallback Ollama): {e}")
            ai_response_text = None

    # 2. Chế độ Fallback: Gọi Ollama cục bộ nếu không có key hoặc gọi Gemini lỗi
    if not ai_response_text:
        model_used = model_name or settings.AI_MODEL_NAME
        print(f"[AI-Engine LLM] Đang sử dụng Ollama cục bộ (Model: {model_used})...")
        payload = {
            "model": model_used,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        try:
            response = requests.post(settings.OLLAMA_URL, json=payload, timeout=120)
            response.raise_for_status()
            result = response.json()
            ai_response_text = result.get("response", "{}")
        except Exception as e:
            print(f"[AI-Engine LLM] Lỗi khi gọi Ollama: {e}")
            return AIAnalysis(
                incident_id=incident.id,
                log_summary="Lỗi phân tích từ AI Assistant",
                attack_reasoning=f"Không thể kết nối đến cả Gemini API và Ollama local. Chi tiết lỗi: {str(e)}",
                mitre_attack_mappings=[],
                remediation_advice=[],
                model_used="none",
                generated_at=datetime.utcnow()
            )

    # 3. Phân tích chuỗi JSON trả về của mô hình
    try:
        parsed_data = json.loads(ai_response_text)
        
        # Mapping dữ liệu sang Pydantic Models để validate
        mitre_mappings = [MitreAttackMapping(**m) for m in parsed_data.get("mitre_attack_mappings", [])]
        
        remediation_steps = []
        for r in parsed_data.get("remediation_advice", []):
            priority_val = str(r.get("priority", "MEDIUM")).upper()
            try:
                priority_enum = Severity(priority_val)
            except ValueError:
                priority_enum = Severity.MEDIUM
                
            remediation_steps.append(RemediationAdvice(
                step=r.get("step", "Không rõ"),
                priority=priority_enum
            ))
            
        analysis = AIAnalysis(
            incident_id=incident.id,
            log_summary=parsed_data.get("log_summary", "Không có tóm tắt"),
            attack_reasoning=parsed_data.get("attack_reasoning", "Không có lý giải"),
            mitre_attack_mappings=mitre_mappings,
            remediation_advice=remediation_steps,
            model_used=model_used,
            generated_at=datetime.utcnow()
        )
        return analysis

    except Exception as e:
        print(f"[AI-Engine LLM] Lỗi parse JSON từ mô hình: {e}")
        return AIAnalysis(
            incident_id=incident.id,
            log_summary="Lỗi định dạng phản hồi AI",
            attack_reasoning=f"Mô hình AI phản hồi không đúng chuẩn JSON yêu cầu. Chuỗi thô: {ai_response_text}",
            mitre_attack_mappings=[],
            remediation_advice=[],
            model_used=model_used,
            generated_at=datetime.utcnow()
        )
