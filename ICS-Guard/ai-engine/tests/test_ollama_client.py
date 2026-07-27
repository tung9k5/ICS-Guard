import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.services.assistant.ollama_client import (
    analyze_incident,
    build_fallback_recommendation,
)


class OllamaClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.incident = {
            "title": "Modbus Flood detected",
            "description": "Packet rate exceeded the safe baseline",
            "device_name": "PLC-01",
            "device_ip": "192.168.10.20",
            "telemetry": {"packet_rate": 9500},
        }

    def test_fallback_contains_actionable_restore_gate(self):
        result = build_fallback_recommendation(self.incident, "vi")

        self.assertIn("PLC-01", result)
        self.assertIn("Denial of Service", result)
        self.assertIn("Các bước khắc phục", result)
        self.assertIn("Điều kiện bắt buộc trước khi khôi phục", result)
        self.assertNotIn("AI Engine error", result)

    async def test_connection_error_returns_fallback_instead_of_raw_error(self):
        with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=httpx.ConnectError("DNS failed"))):
            result = await analyze_incident(self.incident, "vi")

        self.assertIn("KHUYẾN NGHỊ DỰ PHÒNG", result)
        self.assertNotIn("DNS failed", result)
        self.assertNotIn("AI Engine error", result)


if __name__ == "__main__":
    unittest.main()
