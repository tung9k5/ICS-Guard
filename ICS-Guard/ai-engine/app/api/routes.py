from fastapi import APIRouter, HTTPException, Request
from app.services.assistant.ollama_client import analyze_incident
from app.services.anomaly.detector import detector
from app.services.risk.scorer import RiskScorer
from app.models.schemas import Device, DeviceCVE, Alert
from pydantic import BaseModel
from typing import List

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "healthy", "service": "ics-guard-ai-engine"}

class RiskCalculationRequest(BaseModel):
    device: Device
    cves: List[DeviceCVE]
    active_alerts: List[Alert]

@router.post("/analyze/incident")
async def analyze(req: Request):
    data = await req.json()
    language = data.get("language", "vi")
    analysis = await analyze_incident(data, language)
    return {"analysis": analysis}

@router.post("/classify/anomaly")
async def classify(req: Request):
    data = await req.json()
    if "metrics" not in data:
        raise HTTPException(status_code=422, detail="metrics is required")
    try:
        return detector.classify(data["metrics"])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@router.post("/calculate/risk")
async def calculate_risk(req: RiskCalculationRequest):
    risk_score = RiskScorer.calculate_risk(req.device, req.cves, req.active_alerts)
    return {"risk_score": risk_score}
