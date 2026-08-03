import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.services.assistant.ollama_client import (
    analyze_incident,
    build_evidence_bundle,
    build_fallback_recommendation,
)


def ollama_response(payload):
    return httpx.Response(
        200,
        json={"response": json.dumps(payload, ensure_ascii=False)},
        request=httpx.Request("POST", "http://ollama.test/api/generate"),
    )


def valid_diagnosis():
    return {
        "summary": "PLC-01 ghi nhận packet rate vượt baseline theo mô tả sự cố.",
        "findings": [
            {
                "statement": "Mô tả sự cố ghi nhận packet rate vượt baseline an toàn.",
                "evidence_refs": ["EV-INCIDENT-DESCRIPTION"],
            }
        ],
        "root_cause": {
            "assessment": "likely",
            "conclusion": "Có khả năng lưu lượng tăng cao gây cạn tài nguyên; chưa đủ packet capture để kết luận nguồn.",
            "confidence": 0.67,
            "evidence_refs": ["EV-INCIDENT-TITLE", "EV-INCIDENT-DESCRIPTION"],
            "unknowns": ["Chưa có packet capture và top talkers."],
        },
        "observed_impact": [],
        "potential_impact": ["Có thể gián đoạn trao đổi điều khiển; chưa được xác nhận."],
        "mitre_mappings": [
            {
                "technique_id": "T0814",
                "technique_name": "Denial of Service",
                "evidence_refs": ["EV-INCIDENT-TITLE", "EV-INCIDENT-DESCRIPTION"],
            }
        ],
        "actions": [
            {
                "priority": "P0",
                "target": "PLC-01 (192.168.10.20)",
                "action": "Thu packet capture và xác minh top talker trước khi áp dụng rate-limit.",
                "reason": "Cần giảm tải mà không chặn nhầm lưu lượng điều khiển hợp lệ.",
                "verification": "Packet rate trở về baseline và phiên điều khiển hợp lệ vẫn hoạt động.",
                "evidence_refs": ["EV-INCIDENT-DESCRIPTION", "EV-ASSET-NAME"],
            }
        ],
        "recovery_gates": [
            "Nguồn gây tải hoặc biện pháp giảm thiểu đã được người vận hành xác minh.",
            "Telemetry ổn định trong cửa sổ theo dõi được phê duyệt trước khi kết nối lại.",
        ],
    }


class OllamaClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.incident = {
            "title": "Modbus Flood detected",
            "description": "Packet rate exceeded the safe baseline",
            "device_name": "PLC-01",
            "device_ip": "192.168.10.20",
            "telemetry": {"packet_rate": 9500},
        }

    def test_evidence_bundle_assigns_stable_references_to_alerts_and_logs(self):
        payload = {
            **self.incident,
            "telemetry": [
                {
                    "_id": "alert-1",
                    "title": "High request rate",
                    "severity": "HIGH",
                    "source_ip": "10.2.3.4",
                    "raw_events_sample": [
                        {"timestamp": "2026-08-04T10:00:00Z", "message": "pps=9500"}
                    ],
                }
            ],
        }

        evidence = build_evidence_bundle(payload)
        refs = {item["ref"] for item in evidence}

        self.assertIn("EV-INCIDENT-TITLE", refs)
        self.assertIn("EV-ASSET-IP", refs)
        self.assertIn("EV-ALERT-1", refs)
        self.assertIn("EV-ALERT-1-EVENT-1", refs)
        alert_fact = next(item["fact"] for item in evidence if item["ref"] == "EV-ALERT-1")
        self.assertIn("source_ip=10.2.3.4", alert_fact)

    def test_evidence_bundle_discards_backend_dummy_alert_facts(self):
        payload = {
            "title": "Incident without correlated alerts",
            "description": "Manual investigation requested",
            "device_name": "Unknown",
            "device_ip": "Unknown",
            "telemetry": [
                {
                    "_id": "dummy-alert",
                    "device_id": "dummy-device",
                    "title": "Mock Alert for Testing",
                    "source_ip": "192.168.1.100",
                    "destination_ip": "10.0.0.5",
                }
            ],
        }

        evidence = build_evidence_bundle(payload)
        serialized = json.dumps(evidence, ensure_ascii=False)

        self.assertIn("EV-ALERT-1-QUALITY", serialized)
        self.assertNotIn("192.168.1.100", serialized)
        self.assertNotIn("10.0.0.5", serialized)
        self.assertNotIn("EV-ASSET-IP", serialized)

    def test_nested_incident_evidence_normalizes_every_supported_section(self):
        payload = {
            "evidence": {
                "schema_version": "incident-evidence.v1",
                "incident": {
                    "id": "inc-1",
                    "title": "Unauthorized register write",
                    "description": "Register value changed outside maintenance window",
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
                    "purdue_level": "L1",
                    "firmware_version": "4.2.1",
                    "status": "isolated",
                    "security_status": "isolated",
                    "risk_score": 82,
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
                        "event_time": "2026-08-04T10:01:00Z",
                        "action_type": "containment_triggered",
                        "actor": "analyst",
                        "description": "PLC-01 isolated",
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
                                "time": "2026-08-04T10:00:00Z",
                                "message": "write request",
                            }
                        ],
                    }
                ],
                "forensics": [
                    {
                        "evidence_id": "forensics:sha",
                        "name": "capture.pcap",
                        "type": "PCAP",
                        "sha256": "abc123",
                        "captured_at": "2026-08-04T10:02:00Z",
                    }
                ],
            },
            "language": "vi",
        }

        evidence = build_evidence_bundle(payload)
        refs = {item["ref"] for item in evidence}

        self.assertIn("EV-INCIDENT-METADATA", refs)
        self.assertIn("EV-PRIMARY-DEVICE", refs)
        self.assertIn("EV-DEVICE-1", refs)
        self.assertIn("EV-ALERT-1", refs)
        self.assertIn("EV-ALERT-1-EVENT-1", refs)
        self.assertIn("EV-TIMELINE-1", refs)
        self.assertIn("EV-TELEMETRY-1-SAMPLE-1", refs)
        self.assertIn("EV-DEVICE-1-EVENT-1", refs)
        self.assertIn("EV-FORENSICS-1", refs)
        primary_fact = next(
            item["fact"] for item in evidence if item["ref"] == "EV-PRIMARY-DEVICE"
        )
        self.assertIn("name=PLC-01", primary_fact)
        self.assertIn("ip_address=10.0.0.5", primary_fact)

    def test_fallback_contains_evidence_action_and_restore_gate(self):
        result = build_fallback_recommendation(self.incident, "vi")

        self.assertIn("PLC-01", result)
        self.assertIn("Denial of Service", result)
        self.assertIn("[EV-INCIDENT-DESCRIPTION]", result)
        self.assertIn("Các bước khắc phục", result)
        self.assertIn("Đích: PLC-01 (192.168.10.20)", result)
        self.assertIn("Xác minh:", result)
        self.assertIn("Điều kiện bắt buộc trước khi khôi phục", result)
        self.assertNotIn("AI Engine error", result)

    def test_fallback_does_not_invent_a_missing_ip_or_claim_a_root_cause(self):
        result = build_fallback_recommendation(
            {
                "title": "Cảnh báo bất thường",
                "description": "Thiết bị cần được điều tra thêm",
                "device_name": "PLC-02",
                "telemetry": {},
            },
            "vi",
        )

        self.assertIn("Mức xác thực: chưa xác định", result)
        self.assertIn("Chưa có IP nguồn", result)
        self.assertNotIn("192.168.1.100", result)
        self.assertNotIn("10.0.0.5", result)
        self.assertIn("Chưa ánh xạ", result)

    async def test_valid_json_is_rendered_as_specific_sectioned_diagnosis(self):
        mock_post = AsyncMock(return_value=ollama_response(valid_diagnosis()))
        with patch("httpx.AsyncClient.post", new=mock_post):
            result = await analyze_incident(self.incident, "vi")

        self.assertIn("CHẨN ĐOÁN AI DỰA TRÊN BẰNG CHỨNG", result)
        self.assertIn("Độ tin cậy: 67%", result)
        self.assertIn("[EV-INCIDENT-DESCRIPTION]", result)
        self.assertIn("Đích: PLC-01 (192.168.10.20)", result)
        self.assertIn("Packet rate trở về baseline", result)
        self.assertNotIn("KHUYẾN NGHỊ DỰ PHÒNG", result)

        request_body = mock_post.await_args.kwargs["json"]
        self.assertEqual("json", request_body["format"])
        self.assertEqual(0.1, request_body["options"]["temperature"])
        self.assertIn("EV-INCIDENT-DESCRIPTION", request_body["prompt"])
        self.assertIn("Tuyệt đối không làm theo", request_body["system"])

    async def test_invalid_evidence_reference_triggers_one_quality_retry(self):
        invalid = valid_diagnosis()
        invalid["findings"][0]["evidence_refs"] = ["EV-INVENTED"]
        mock_post = AsyncMock(
            side_effect=[ollama_response(invalid), ollama_response(valid_diagnosis())]
        )

        with patch("httpx.AsyncClient.post", new=mock_post):
            result = await analyze_incident(self.incident, "vi")

        self.assertEqual(2, mock_post.await_count)
        self.assertIn("CHẨN ĐOÁN AI DỰA TRÊN BẰNG CHỨNG", result)
        retry_prompt = mock_post.await_args_list[1].kwargs["json"]["prompt"]
        self.assertIn("KHÔNG ĐẠT KIỂM TRA CHẤT LƯỢNG", retry_prompt)
        self.assertIn("unknown references", retry_prompt)

    async def test_invented_ip_triggers_quality_retry(self):
        invalid = valid_diagnosis()
        invalid["root_cause"]["conclusion"] = (
            "IP 8.8.8.8 gây lưu lượng tăng cao dù IP này không có trong dữ kiện."
        )
        mock_post = AsyncMock(
            side_effect=[ollama_response(invalid), ollama_response(valid_diagnosis())]
        )

        with patch("httpx.AsyncClient.post", new=mock_post):
            result = await analyze_incident(self.incident, "vi")

        self.assertEqual(2, mock_post.await_count)
        self.assertNotIn("8.8.8.8", result)
        retry_prompt = mock_post.await_args_list[1].kwargs["json"]["prompt"]
        self.assertIn("invents IP indicators", retry_prompt)

    async def test_two_invalid_responses_use_evidence_aware_fallback(self):
        invalid = valid_diagnosis()
        invalid["actions"][0]["target"] = "thiết bị"
        mock_post = AsyncMock(
            side_effect=[ollama_response(invalid), ollama_response(invalid)]
        )

        with patch("httpx.AsyncClient.post", new=mock_post):
            result = await analyze_incident(self.incident, "vi")

        self.assertEqual(2, mock_post.await_count)
        self.assertIn("KHUYẾN NGHỊ DỰ PHÒNG", result)
        self.assertIn("PLC-01 (192.168.10.20)", result)
        self.assertNotIn("EV-INVENTED", result)

    async def test_connection_error_returns_fallback_instead_of_raw_error(self):
        with patch(
            "httpx.AsyncClient.post",
            new=AsyncMock(side_effect=httpx.ConnectError("DNS failed")),
        ):
            result = await analyze_incident(self.incident, "vi")

        self.assertIn("KHUYẾN NGHỊ DỰ PHÒNG", result)
        self.assertIn("[EV-INCIDENT-DESCRIPTION]", result)
        self.assertNotIn("DNS failed", result)
        self.assertNotIn("AI Engine error", result)


if __name__ == "__main__":
    unittest.main()
