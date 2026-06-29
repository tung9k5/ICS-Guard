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
You are an expert Cybersecurity ICS/OT Analyst. Analyze the following security incident and alerts quickly and accurately.
Output ONLY a valid JSON object matching this exact structure without any markdown formatting, reasoning, or trailing text. 

{{
  "log_summary": "Tóm tắt ngắn gọn sự cố bằng tiếng Việt (tối đa 3 câu).",
  "attack_reasoning": "Phân tích kỹ thuật cốt lõi (tối đa 4 câu).",
  "mitre_attack_mappings": [
    {{"tactic": "...", "technique_id": "...", "technique_name": "..."}}
  ],
  "remediation_advice": [
    {{"step": "Hành động khắc phục thực tế", "priority": "CRITICAL"}}
  ]
}}

Priority enum: INFO, LOW, MEDIUM, HIGH, CRITICAL.

INCIDENT TITLE: {incident.title}
INCIDENT DESCRIPTION: {incident.description}
RELATED ALERTS:
{alerts_context}
    """
    return prompt
