import hmac
import json
import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable, Optional
from urllib.parse import unquote, urlparse

from plant_db import PlantDB


MAX_BODY_BYTES = 1024 * 1024


class RuntimeAPIServer:
    def __init__(
        self,
        plant_db: PlantDB,
        service_key: str,
        host: str = "0.0.0.0",
        port: int = 5002,
        after_commit: Optional[Callable[[], None]] = None,
    ):
        if not service_key:
            raise ValueError("internal runtime service key is required")
        self.plant_db = plant_db
        self.service_key = service_key
        self.after_commit = after_commit
        self._server = ThreadingHTTPServer(
            (host, port),
            self._build_handler(),
        )
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            name="plant-runtime-api",
            daemon=True,
        )

    def _build_handler(self):
        plant_db = self.plant_db
        expected_key = self.service_key
        after_commit = self.after_commit

        class Handler(BaseHTTPRequestHandler):
            server_version = "ICSGuardRuntime/1.0"

            def log_message(self, fmt, *args):
                logging.info("[RuntimeAPI] " + fmt, *args)

            def _send_json(self, status, payload):
                body = json.dumps(
                    payload,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)

            def _provided_key(self):
                direct = (
                    self.headers.get("x-service-key")
                    or self.headers.get("x-internal-service-key")
                )
                if direct:
                    return direct
                authorization = self.headers.get("Authorization", "")
                if authorization.startswith("Bearer "):
                    return authorization[7:]
                return ""

            def _authorized(self):
                provided = self._provided_key()
                return bool(provided) and hmac.compare_digest(
                    provided.encode("utf-8"),
                    expected_key.encode("utf-8"),
                )

            def _require_auth(self):
                if self._authorized():
                    return True
                self._send_json(
                    401,
                    {
                        "error": "Unauthorized",
                        "message": "A valid internal service key is required",
                    },
                )
                return False

            def _read_json(self):
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                except ValueError as exc:
                    raise ValueError("invalid Content-Length") from exc
                if length <= 0:
                    raise ValueError("JSON body is required")
                if length > MAX_BODY_BYTES:
                    raise ValueError("request body is too large")
                raw = self.rfile.read(length)
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise ValueError("invalid UTF-8 JSON body") from exc
                if not isinstance(payload, dict):
                    raise ValueError("JSON body must be an object")
                return payload

            @staticmethod
            def _device_id(path):
                prefix = "/api/plant/devices/"
                if not path.startswith(prefix):
                    return None
                value = unquote(path[len(prefix):]).strip()
                return value or None

            def do_GET(self):
                path = urlparse(self.path).path
                if path == "/health":
                    self._send_json(
                        200,
                        {
                            "status": "healthy",
                            "service": "hardware-runtime",
                            "runtime_id": plant_db.get_runtime_id(),
                        },
                    )
                    return
                if not self._require_auth():
                    return
                if path == "/api/plant/devices":
                    self._send_json(200, plant_db.get_all_devices())
                    return
                device_id = self._device_id(path)
                if device_id:
                    device = plant_db.get_device(device_id)
                    if not device:
                        self._send_json(
                            404,
                            {"error": "NotFound", "message": "device not found"},
                        )
                        return
                    self._send_json(200, device)
                    return
                self._send_json(
                    404,
                    {"error": "NotFound", "message": "route not found"},
                )

            def do_POST(self):
                path = urlparse(self.path).path
                if not self._require_auth():
                    return
                if path != "/api/plant/devices":
                    self._send_json(
                        404,
                        {"error": "NotFound", "message": "route not found"},
                    )
                    return
                try:
                    result = plant_db.upsert_device(self._read_json())
                    if after_commit:
                        after_commit()
                    self._send_json(201, result)
                except ValueError as exc:
                    self._send_json(
                        422,
                        {"error": "ValidationError", "message": str(exc)},
                    )
                except Exception:
                    logging.exception("[RuntimeAPI] Device upsert failed")
                    self._send_json(
                        500,
                        {"error": "InternalError", "message": "device upsert failed"},
                    )

            def do_DELETE(self):
                path = urlparse(self.path).path
                if not self._require_auth():
                    return
                device_id = self._device_id(path)
                if not device_id:
                    self._send_json(
                        404,
                        {"error": "NotFound", "message": "route not found"},
                    )
                    return
                try:
                    result = plant_db.delete_device(device_id)
                    if not result["deleted"]:
                        self._send_json(
                            404,
                            {"error": "NotFound", "message": "device not found"},
                        )
                        return
                    if after_commit:
                        after_commit()
                    self._send_json(200, result)
                except Exception:
                    logging.exception("[RuntimeAPI] Device delete failed")
                    self._send_json(
                        500,
                        {"error": "InternalError", "message": "device delete failed"},
                    )

        return Handler

    def start(self):
        self._thread.start()
        host, port = self._server.server_address
        logging.info("[RuntimeAPI] Listening on %s:%s", host, port)

    def stop(self):
        self._server.shutdown()
        self._server.server_close()
        if self._thread.is_alive():
            self._thread.join(timeout=5)
