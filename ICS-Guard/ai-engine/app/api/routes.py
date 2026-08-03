from fastapi import APIRouter, HTTPException, Request
from app.services.assistant.ollama_client import analyze_incident
from app.services.anomaly.detector import detector
from app.services.anomaly.model_store import ModelStoreError, activate_candidate
from app.services.risk.scorer import RiskScorer
from app.models.schemas import Device, DeviceCVE, Alert
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from typing import Any, Dict, List, Optional

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "healthy", "service": "ics-guard-ai-engine"}

class RiskCalculationRequest(BaseModel):
    device: Device
    cves: List[DeviceCVE]
    active_alerts: List[Alert]


class TrainModelRequest(BaseModel):
    filename: Optional[str] = None
    csv_text: Optional[str] = None
    activate: bool = True
    params: Optional[Dict[str, Any]] = None

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

@router.post("/internal/ai/analyze")
async def internal_ai_analyze(req: Request):
    data = await req.json()
    metrics = data.get("metrics")
    incident_data = data.get("incident")
    
    classification = None
    if metrics:
        try:
            classification = detector.classify(metrics)
        except Exception:
            pass

    analysis = None
    if incident_data:
        language = data.get("language", "vi")
        try:
            analysis = await analyze_incident(incident_data, language)
        except Exception:
            analysis = "Không thể liên hệ Ollama AI. Đã kích hoạt phương án dự phòng Rule-Based."

    return {
        "status": "success",
        "classification": classification,
        "analysis": analysis
    }

@router.post("/classify/train")
async def train_model_endpoint(payload: Optional[TrainModelRequest] = None):
    try:
        from train_model import DatasetValidationError, train_lightweight_anomaly_model

        request = payload or TrainModelRequest()
        provenance = await run_in_threadpool(
            train_lightweight_anomaly_model,
            filename=request.filename,
            csv_text=request.csv_text,
            activate=request.activate,
            params=request.params,
        )
        if provenance.get("activation", {}).get("status") == "active":
            detector.reload_if_needed(force=True, raise_on_error=True)
        return {
            "status": "success",
            "message": (
                "RandomForest candidate trained and activated"
                if request.activate
                else "RandomForest candidate trained; activation is pending"
            ),
            "provenance": provenance,
            "detector": detector.status(),
        }
    except (DatasetValidationError, ModelStoreError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(exc)}")


@router.get("/classify/model")
async def active_model_status():
    return {"status": "success", "detector": detector.status()}


@router.post("/models/{model_id}/activate")
@router.post("/classify/models/{model_id}/activate", include_in_schema=False)
async def activate_model_endpoint(model_id: str):
    try:
        pointer = await run_in_threadpool(activate_candidate, model_id)
        detector.reload_if_needed(force=True, raise_on_error=True)
        return {
            "status": "success",
            "message": f"Model {model_id} activated",
            "activation": pointer,
            "detector": detector.status(),
        }
    except ModelStoreError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model activation failed: {str(exc)}") from exc
