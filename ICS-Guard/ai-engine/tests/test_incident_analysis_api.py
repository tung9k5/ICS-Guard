import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from pydantic import ValidationError

from app.api.routes import analyze, router
from app.models.schemas import IncidentAnalysisRequest


def backend_nested_payload():
    return {
        "evidence": {
            "schema_version": "incident-evidence.v1",
            "incident": {
                "id": "inc-1",
                "title": "Unauthorized register write",
                "description": "FC06 register write outside maintenance window",
                "severity": "CRITICAL",
                "status": "investigating",
                "created_at": "2026-08-04T09:58:00Z",
            },
            "primary_device": {
                "id": "plc-01",
                "name": "PLC-01",
                "ip_address": "10.0.0.5",
                "type": "controller",
                "zone": "Cell-A",
                "security_status": "isolated",
                "baseline_metrics": {"bytes_per_second_max": 25000},
            },
            "devices": [
                {
                    "evidence_id": "device:plc-01",
                    "id": "plc-01",
                    "name": "PLC-01",
                    "ip_address": "10.0.0.5",
                }
            ],
            "alerts": [
                {
                    "evidence_id": "alert:a1",
                    "_id": "a1",
                    "device_id": "plc-01",
                    "title": "FC06 write outside maintenance window",
                    "description": "Register 40001 changed",
                    "severity": "CRITICAL",
                    "source_ip": "10.0.0.99",
                    "destination_ip": "10.0.0.5",
                    "raw_events_sample": [
                        {
                            "evidence_id": "alert:a1:event:0",
                            "timestamp": "2026-08-04T10:00:00Z",
                            "message": "FC06 register write observed",
                        }
                    ],
                }
            ],
            "timeline": [
                {
                    "evidence_id": "timeline:t1",
                    "action_type": "containment_triggered",
                    "actor": "analyst",
                    "description": "PLC-01 isolated",
                    "event_time": "2026-08-04T10:01:00Z",
                }
            ],
            "telemetry": [
                {
                    "device_id": "plc-01",
                    "samples": [
                        {
                            "evidence_id": "telemetry:plc-01:0",
                            "time": "2026-08-04T10:00:00Z",
                            "cpu_usage": 91,
                        }
                    ],
                    "events": [
                        {
                            "evidence_id": "device-event:plc-01:0",
                            "message": "write request",
                        }
                    ],
                }
            ],
            "forensics": [
                {
                    "evidence_id": "forensics:abc123",
                    "name": "capture.pcap",
                    "type": "PCAP",
                    "sha256": "abc123",
                    "captured_at": "2026-08-04T10:02:00Z",
                }
            ],
        },
        "language": "vi",
    }


class IncidentAnalysisApiTests(unittest.IsolatedAsyncioTestCase):
    def test_request_requires_non_empty_title_and_description(self):
        with self.assertRaises(ValidationError):
            IncidentAnalysisRequest.model_validate(
                {"title": "", "description": "", "language": "vi"}
            )

    def test_request_keeps_compatibility_fields_and_allows_future_context(self):
        request = IncidentAnalysisRequest.model_validate(
            {
                "title": "Unauthorized write",
                "description": "Register changed outside maintenance window",
                "device_name": "PLC-01",
                "device_ip": "10.0.0.5",
                "telemetry": [{"_id": "a1", "severity": "CRITICAL"}],
                "language": "vi",
                "forensics": [{"sha256": "abc"}],
            }
        )

        dumped = request.model_dump(mode="json")
        self.assertEqual("PLC-01", dumped["device_name"])
        self.assertEqual("a1", dumped["telemetry"][0]["_id"])
        self.assertEqual([{"sha256": "abc"}], dumped["forensics"])

    async def test_http_api_accepts_backend_nested_contract_and_preserves_identity(self):
        app = FastAPI()
        app.include_router(router)
        transport = httpx.ASGITransport(app=app)
        mock_ollama = AsyncMock(side_effect=httpx.ConnectError("offline in test"))

        with patch(
            "app.services.assistant.ollama_client._request_ollama", new=mock_ollama
        ):
            async with httpx.AsyncClient(
                transport=transport, base_url="http://testserver"
            ) as client:
                response = await client.post(
                    "/analyze/incident", json=backend_nested_payload()
                )

        self.assertEqual(200, response.status_code, response.text)
        analysis = response.json()["analysis"]
        self.assertIn("PLC-01", analysis)
        self.assertIn("10.0.0.5", analysis)
        self.assertIn("[EV-ALERT-1]", analysis)
        self.assertIn("Bằng chứng", analysis)
        self.assertIn("Điều kiện bắt buộc trước khi khôi phục", analysis)

    async def test_route_preserves_analysis_string_response_contract(self):
        request = IncidentAnalysisRequest.model_validate(
            {
                "title": "Unauthorized write",
                "description": "Register changed outside maintenance window",
                "device_name": "PLC-01",
                "device_ip": "10.0.0.5",
                "telemetry": {},
                "language": "vi",
            }
        )
        mock_analyze = AsyncMock(return_value="structured diagnosis rendered as text")

        with patch("app.api.routes.analyze_incident", new=mock_analyze):
            response = await analyze(request)

        self.assertEqual({"analysis": "structured diagnosis rendered as text"}, response)
        payload, language = mock_analyze.await_args.args
        self.assertEqual("vi", language)
        self.assertEqual("Unauthorized write", payload["title"])


if __name__ == "__main__":
    unittest.main()
