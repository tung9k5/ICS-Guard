import httpx
import json
import re
import logging
from datetime import datetime
from typing import List
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.models import Incident, Alert, AIAnalysis, MitreAttackMapping, RemediationAdvice
from app.core.constants import Severity
from app.assistant.prompts import get_incident_analysis_prompt
from app.core.config import settings

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_json_string(text: str) -> str:
    """Loại bỏ các block markdown có thể sinh ra từ LLM để parse JSON an toàn."""
    text = re.sub(r'```json\n?', '', text)
    text = re.sub(r'```\n?', '', text)
    return text.strip()

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException)),
    reraise=True
)
async def fetch_llm_analysis(payload: dict) -> str:
    """Gọi LLM với cơ chế tự động retry khi gặp lỗi kết nối/timeout."""
    # timeout: connect=10.0s, read=120.0s
    timeout = httpx.Timeout(120.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(settings.OLLAMA_URL, json=payload)
        response.raise_for_status()
        return response.json().get("response", "{}")

async def analyze_incident(incident: Incident, alerts: List[Alert], model_name: str = None) -> AIAnalysis:
    """
    Sử dụng Ollama để phân tích sự cố bảo mật bất đồng bộ.
    """
    model_name = model_name or settings.AI_MODEL_NAME
    prompt = get_incident_analysis_prompt(incident, alerts)

    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }

    try:
        logger.info(f"Đang phân tích Incident {incident.id} với model {model_name}...")
        start_time = datetime.utcnow()
        
        ai_response_text = await fetch_llm_analysis(payload)
        
        latency = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Hoàn thành gọi LLM trong {latency:.2f} giây.")

        cleaned_text = clean_json_string(ai_response_text)
        parsed_data = json.loads(cleaned_text)
        
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
            model_used=model_name,
            generated_at=datetime.utcnow()
        )
        return analysis

    except Exception as e:
        logger.error(f"Lỗi nghiêm trọng khi phân tích AI: {str(e)}", exc_info=True)
        return AIAnalysis(
            incident_id=incident.id,
            log_summary="Lỗi phân tích từ AI do hệ thống.",
            attack_reasoning=f"Ngoại lệ: {str(e)}",
            mitre_attack_mappings=[],
            remediation_advice=[],
            model_used=model_name,
            generated_at=datetime.utcnow()
        )
