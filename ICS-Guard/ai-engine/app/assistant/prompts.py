from typing import List
from app.core.models import Incident, Alert

def get_incident_analysis_prompt(incident: Incident, alerts: List[Alert]) -> str:
    """
    Tạo prompt cho AI model để phân tích Incident và Alerts.
    """
    # Chuẩn bị dữ liệu ngữ cảnh từ alerts
    alerts_context = ""
    for alert in alerts:
        alerts_context += f"- Alert: {alert.title} (Severity: {alert.severity.value})\n"
        alerts_context += f"  Description: {alert.description}\n"
        alerts_context += f"  Source IP: {alert.source_ip}, Dest IP: {alert.destination_ip}\n"
    
    prompt = f"""
You are an expert Cybersecurity ICS/OT Analyst. Analyze the following security incident and alerts.
Provide your response strictly as a JSON object matching this structure EXACTLY (without any markdown formatting like ```json or trailing text):

{{
  "log_summary": "Tóm tắt ngắn gọn sự cố bằng tiếng Việt.",
  "attack_reasoning": "Phân tích kỹ thuật chuyên sâu về phương thức tấn công và mức độ ảnh hưởng bằng tiếng Việt.",
  "mitre_attack_mappings": [
    {{"tactic": "...", "technique_id": "...", "technique_name": "..."}}
  ],
  "remediation_advice": [
    {{"step": "Hành động khắc phục", "priority": "CRITICAL"}}
  ]
}}
Note: priority must be one of: INFO, LOW, MEDIUM, HIGH, CRITICAL.

INCIDENT TITLE: {incident.title}
INCIDENT DESCRIPTION: {incident.description}
RELATED ALERTS:
{alerts_context}
    """
    return prompt
