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
    Sử dụng Ollama để phân tích sự cố bảo mật dựa trên Incident và các Alerts liên quan.
    """
    model_name = model_name or settings.AI_MODEL_NAME
    
    # Lấy prompt từ file prompts.py
    prompt = get_incident_analysis_prompt(incident, alerts)

    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "format": "json" # Yêu cầu trả về đúng chuẩn JSON
    }

    try:
        response = requests.post(settings.OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        ai_response_text = result.get("response", "{}")
        
        # Phân tích chuỗi JSON trả về
        parsed_data = json.loads(ai_response_text)
        
        # Mapping dữ liệu sang Pydantic Models để validate
        mitre_mappings = [MitreAttackMapping(**m) for m in parsed_data.get("mitre_attack_mappings", [])]
        
        remediation_steps = []
        for r in parsed_data.get("remediation_advice", []):
            priority_val = str(r.get("priority", "MEDIUM")).upper()
            try:
                priority_enum = Severity(priority_val)
            except ValueError:
                priority_enum = Severity.MEDIUM # Fallback nếu model trả lời sai định dạng
                
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
            model_used=model_name,
            generated_at=datetime.utcnow()
        )
        
        return analysis

    except Exception as e:
        print(f"Lỗi khi gọi model AI: {e}")
        # Fallback an toàn nếu có lỗi
        return AIAnalysis(
            incident_id=incident.id,
            log_summary="Lỗi phân tích từ AI",
            attack_reasoning=str(e),
            mitre_attack_mappings=[],
            remediation_advice=[],
            model_used=model_name,
            generated_at=datetime.utcnow()
        )
