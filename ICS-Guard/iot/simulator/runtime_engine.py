import asyncio
import base64
import json
import logging
import os
import random
import re
import signal
import ssl
import sys
import threading
from typing import Any, Dict, Optional

import paho.mqtt.client as mqtt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from dotenv import load_dotenv


SIMULATOR_DIR = os.path.dirname(os.path.abspath(__file__))
IOT_DIR = os.path.dirname(SIMULATOR_DIR)
if IOT_DIR not in sys.path:
    sys.path.insert(0, IOT_DIR)
if SIMULATOR_DIR not in sys.path:
    sys.path.insert(0, SIMULATOR_DIR)

from edge_gateway import EdgeGatewayController
from modbus_server import ModbusTCPServer
from payloads.payload_generators import (
    generate_actuator_payload,
    generate_chip_payload,
    generate_controller_payload,
    generate_gateway_payload,
    generate_sensor_payload,
)
from plant_db import PlantDB
from runtime_api import RuntimeAPIServer
from runtime_contracts import (
    calculate_policy_hash,
    envelope_hash,
    evaluate_policy,
    extract_policy_document,
    normalize_attack_scenario,
    parse_iso8601,
    utc_now,
    utc_now_iso,
    validate_policy_document,
)


load_dotenv(os.path.abspath(os.path.join(SIMULATOR_DIR, "..", "..", ".env")))
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(levelname)s - %(message)s",
)

SAFE_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
INACTIVE_STATUSES = {"offline", "inactive", "unprovisioned", "decommissioned"}
SCENARIO_FLOW = {
    "modbus-flood": ("modbus-tcp", 502),
    "modbus_flooding": ("modbus-tcp", 502),
    "logic-tampering": ("modbus-tcp", 502),
    "logic_tampering": ("modbus-tcp", 502),
    "sensor-spoofing": ("telemetry", 0),
    "sensor_spoofing": ("telemetry", 0),
}


class RuntimeEngine:
    def __init__(self):
        self.plant_db = PlantDB()
        self.runtime_id = self.plant_db.get_runtime_id()
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.shutdown_event = asyncio.Event()
        self.snapshot_event = asyncio.Event()
        self.mqtt_connected = threading.Event()
        self.devices: Dict[str, Dict[str, Any]] = {}
        self.running_devices: Dict[str, asyncio.Task] = {}
        self.anomaly_states: Dict[str, str] = {}
        self.isolated_devices = set()
        self.command_locks: Dict[str, asyncio.Lock] = {}
        self.background_tasks = []
        self.api_server: Optional[RuntimeAPIServer] = None
        self.modbus_server: Optional[ModbusTCPServer] = None
        self.gateway_controller: Optional[EdgeGatewayController] = None

        self.aes_key = self._load_aes_key()
        self.aes_iv = os.getenv("AES_IV", "").encode("utf-8")
        self.mqtt_host = os.getenv("MQTT_HOST", "localhost")
        self.mqtt_use_tls = os.getenv("MQTT_USE_TLS", "true").lower() == "true"
        default_port = "8883" if self.mqtt_use_tls else "1883"
        self.mqtt_port = int(os.getenv("MQTT_PORT", default_port))
        self.mqtt_username = os.getenv(
            "MQTT_USERNAME",
            os.getenv("HARDWARE_MQTT_USER", "hardware-runtime-01"),
        )
        self.mqtt_password = os.getenv(
            "MQTT_PASSWORD",
            os.getenv("HARDWARE_MQTT_PASSWORD", "hardware_secret_pass"),
        )
        if not self.mqtt_password and (
            os.getenv("ALLOW_ANONYMOUS_MQTT", "false").lower() != "true"
        ):
            raise RuntimeError(
                "MQTT_PASSWORD or HARDWARE_MQTT_PASSWORD is required"
            )

        self.client = self._build_mqtt_client()
        self._seed_inventory_if_empty()

    @staticmethod
    def _load_aes_key() -> bytes:
        raw = os.getenv("AES_SECRET_KEY", "").encode("utf-8")
        if len(raw) != 32:
            raise RuntimeError("AES_SECRET_KEY must be exactly 32 UTF-8 bytes")
        return raw

    def _build_mqtt_client(self):
        client_id = f"{self.runtime_id}-{os.getpid()}"
        client = mqtt.Client(client_id=client_id, clean_session=True)
        client.username_pw_set(self.mqtt_username, self.mqtt_password or None)
        if self.mqtt_use_tls:
            ca_path = os.getenv(
                "MQTT_CA_CERT",
                os.path.abspath(
                    os.path.join(SIMULATOR_DIR, "..", "certs", "ca.crt")
                ),
            )
            if not os.path.isfile(ca_path):
                raise RuntimeError(f"MQTT TLS CA certificate not found: {ca_path}")
            client.tls_set(
                ca_certs=ca_path,
                cert_reqs=ssl.CERT_REQUIRED,
                tls_version=ssl.PROTOCOL_TLS_CLIENT,
            )
            client.tls_insecure_set(
                os.getenv("ALLOW_INSECURE_TLS", "false").lower() == "true"
            )
        client.reconnect_delay_set(min_delay=1, max_delay=30)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        client.on_publish = self._on_publish
        return client

    def _seed_inventory_if_empty(self):
        if self.plant_db.get_all_devices():
            return
        config_path = os.getenv(
            "PLANT_SEED_PATH",
            os.path.join(SIMULATOR_DIR, "config.json"),
        )
        with open(config_path, "r", encoding="utf-8") as handle:
            devices = json.load(handle)
        if not isinstance(devices, list):
            raise RuntimeError("plant seed file must contain a device array")
        seeded = self.plant_db.seed_devices(devices)
        logging.info(
            "[PlantDB] Seeded authoritative inventory with %s devices",
            len(devices) if seeded else 0,
        )

    def encrypt_payload(self, payload: Dict[str, Any]) -> Dict[str, str]:
        plaintext = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        raw_iv = os.urandom(12)
        cipher = Cipher(
            algorithms.AES(self.aes_key),
            modes.GCM(raw_iv),
            backend=default_backend(),
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(plaintext) + encryptor.finalize()
        return {
            "encrypted_data": base64.b64encode(ciphertext).decode("ascii"),
            "iv": base64.b64encode(raw_iv).decode("ascii"),
            "auth_tag": base64.b64encode(encryptor.tag).decode("ascii"),
            "alg": "AES-256-GCM",
        }

    def decrypt_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        encrypted_data = payload.get("encrypted_data")
        if not encrypted_data:
            return payload
        algorithm = payload.get("alg", "AES-256-CBC")
        ciphertext = base64.b64decode(encrypted_data)
        if algorithm == "AES-256-GCM":
            raw_iv = base64.b64decode(payload["iv"])
            auth_tag = base64.b64decode(payload["auth_tag"])
            cipher = Cipher(
                algorithms.AES(self.aes_key),
                modes.GCM(raw_iv, auth_tag),
                backend=default_backend(),
            )
            decryptor = cipher.decryptor()
            plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        else:
            if len(self.aes_iv) != 16:
                raise ValueError("AES_IV must be 16 bytes for legacy CBC payloads")
            cipher = Cipher(
                algorithms.AES(self.aes_key),
                modes.CBC(self.aes_iv),
                backend=default_backend(),
            )
            decryptor = cipher.decryptor()
            padded = decryptor.update(ciphertext) + decryptor.finalize()
            unpadder = padding.PKCS7(128).unpadder()
            plaintext = unpadder.update(padded) + unpadder.finalize()
        decoded = json.loads(plaintext.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise ValueError("MQTT payload must decode to an object")
        return decoded

    def publish_json(
        self,
        topic: str,
        payload: Dict[str, Any],
        encrypt: bool = True,
    ) -> bool:
        if not self.mqtt_connected.is_set():
            return False
        outgoing = self.encrypt_payload(payload) if encrypt else payload
        wire = json.dumps(
            outgoing,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        info = self.client.publish(topic, wire.encode("utf-8"), qos=1)
        return info.rc == mqtt.MQTT_ERR_SUCCESS

    def _on_connect(self, client, userdata, flags, rc):
        if rc != 0:
            rc_reasons = {
                1: "1 (Unacceptable protocol version)",
                2: "2 (Identifier rejected)",
                3: "3 (Server unavailable)",
                4: "4 (Bad username or password)",
                5: "5 (Not authorized)",
            }
            reason = rc_reasons.get(rc, f"{rc} (Unknown rejection)")
            logging.error("[MQTT] Connection rejected by broker: %s", reason)
            return
        self.mqtt_connected.set()
        subscriptions = (
            f"ics/v1/commands/security/{self.runtime_id}/+",
            f"ics/v1/commands/policy/{self.runtime_id}",
            f"lab/v1/commands/attack/{self.runtime_id}/+",
        )
        for topic in subscriptions:
            client.subscribe(topic, qos=1)
        logging.info(
            "[MQTT] Connected as %s and subscribed to runtime %s",
            self.mqtt_username,
            self.runtime_id,
        )
        self.request_snapshot()

    def _on_disconnect(self, client, userdata, rc):
        self.mqtt_connected.clear()
        if rc:
            logging.warning("[MQTT] Disconnected unexpectedly (code %s)", rc)

    @staticmethod
    def _on_publish(client, userdata, mid):
        logging.debug("[MQTT] QoS publish completed (mid=%s)", mid)

    def _on_message(self, client, userdata, message):
        try:
            decoded = json.loads(message.payload.decode("utf-8"))
            if not isinstance(decoded, dict):
                raise ValueError("MQTT payload must be an object")
            payload = self.decrypt_payload(decoded)
        except Exception:
            logging.exception("[MQTT] Rejected malformed payload on %s", message.topic)
            return
        if not self.loop or self.loop.is_closed():
            logging.error("[MQTT] Event loop is not ready")
            return
        future = asyncio.run_coroutine_threadsafe(
            self.handle_mqtt_message(message.topic, payload),
            self.loop,
        )

        def report_failure(done):
            try:
                done.result()
            except Exception:
                logging.exception("[MQTT] Runtime handler failed")

        future.add_done_callback(report_failure)

    def request_snapshot(self):
        if self.loop and self.loop.is_running():
            self.loop.call_soon_threadsafe(self.snapshot_event.set)

    def on_inventory_commit(self):
        if not self.loop or not self.loop.is_running():
            return
        asyncio.run_coroutine_threadsafe(
            self.reconcile_inventory(),
            self.loop,
        )
        self.request_snapshot()

    async def reconcile_inventory(self):
        devices = {
            device["_id"]: device
            for device in self.plant_db.get_all_devices(legacy_aliases=True)
        }
        runtime_states = self.plant_db.get_runtime_states()
        removed = set(self.devices) - set(devices)
        self.devices = devices

        for device_id in removed:
            task = self.running_devices.pop(device_id, None)
            if task:
                task.cancel()
            self.anomaly_states.pop(device_id, None)
            self.isolated_devices.discard(device_id)

        for device_id, device in devices.items():
            state = runtime_states.get(device_id, {})
            if state.get("isolated"):
                self.isolated_devices.add(device_id)
            else:
                self.isolated_devices.discard(device_id)
            overlay = state.get("overlay") or {}
            self.anomaly_states[device_id] = overlay.get(
                "scenario_state",
                "normal",
            )
            if (
                device.get("operational_status", "active") not in INACTIVE_STATUSES
                and device.get("approval_status", "approved") == "approved"
                and device_id not in self.running_devices
                and self.loop
            ):
                self.running_devices[device_id] = asyncio.create_task(
                    self.simulate_device(device_id),
                    name=f"telemetry-{device_id}",
                )

        if self.modbus_server:
            self.gateway_controller = EdgeGatewayController(
                list(self.devices.values()),
                self.anomaly_states,
                modbus_host="127.0.0.1",
                modbus_port=self.modbus_server.port,
            )
        logging.info(
            "[PlantDB] Reconciled %s devices (%s isolated)",
            len(self.devices),
            len(self.isolated_devices),
        )

    def is_device_reachable(self, device_id: str) -> bool:
        current = device_id
        visited = set()
        while current:
            if current in visited:
                return False
            visited.add(current)
            device = self.devices.get(current)
            if not device:
                return False
            if device.get("operational_status", "active") in INACTIVE_STATUSES:
                return False
            if device.get("approval_status", "approved") != "approved":
                return False
            current = device.get("parent_id")
        return True

    async def simulate_device(self, device_id: str):
        await asyncio.sleep(random.uniform(0.1, 2.0))
        try:
            while device_id in self.devices:
                device = self.devices[device_id]
                if device.get("approval_status", "approved") != "approved":
                    await asyncio.sleep(5)
                    continue
                if not self.is_device_reachable(device_id):
                    await asyncio.sleep(5)
                    continue
                if device_id in self.isolated_devices:
                    await asyncio.sleep(1)
                    continue

                state = self.anomaly_states.get(device_id, "normal")
                node_type = device.get("node_type", "sensor")
                if node_type == "gateway":
                    payload = generate_gateway_payload(device, state)
                elif node_type == "controller":
                    payload = generate_controller_payload(device, state)
                elif node_type == "chip":
                    payload = generate_chip_payload(device, state)
                elif node_type == "actuator":
                    payload = generate_actuator_payload(device, state)
                else:
                    payload = generate_sensor_payload(device, state)

                if self.gateway_controller:
                    payload = self.gateway_controller.run_local_rules([payload])[0]
                topic = (
                    f"ics/v1/telemetry/{self.runtime_id}/{device_id}"
                )
                if not self.publish_json(topic, payload, encrypt=True):
                    logging.debug(
                        "[Telemetry] Deferred publish for %s while broker unavailable",
                        device_id,
                    )
                await asyncio.sleep(5)
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.exception("[Telemetry] Device loop failed for %s", device_id)

    async def heartbeat_loop(self):
        interval = float(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "5"))
        while True:
            timestamp = utc_now_iso()
            for device_id, device in list(self.devices.items()):
                payload = {
                    "schema_version": 1,
                    "runtime_id": self.runtime_id,
                    "device_id": device_id,
                    "management_channel": True,
                    "isolated": device_id in self.isolated_devices,
                    "operational_status": device.get(
                        "operational_status",
                        "active",
                    ),
                    "timestamp": timestamp,
                }
                self.publish_json(
                    f"ics/v1/runtime/heartbeat/{self.runtime_id}/{device_id}",
                    payload,
                    encrypt=True,
                )
            await asyncio.sleep(interval)

    async def snapshot_loop(self):
        retry_seconds = float(os.getenv("SNAPSHOT_RETRY_SECONDS", "15"))
        _backoff = 2.0          # start at 2s, grow to max 60s
        _max_backoff = 60.0
        _broker_warn_count = 0
        while True:
            try:
                await asyncio.wait_for(
                    self.snapshot_event.wait(),
                    timeout=retry_seconds,
                )
            except asyncio.TimeoutError:
                pass
            self.snapshot_event.clear()
            snapshot = self.plant_db.generate_full_snapshot()
            topic = f"ics/v1/hardware/snapshot/{self.runtime_id}"
            if self.publish_json(topic, snapshot, encrypt=True):
                logging.info(
                    "[Snapshot] Published generation=%s revision=%s count=%s",
                    snapshot["runtime_generation"],
                    snapshot["snapshot_revision"],
                    snapshot["record_count"],
                )
                _backoff = 2.0   # reset on success
                _broker_warn_count = 0
            else:
                self.snapshot_event.set()
                # Only log every 10 failures to avoid log spam
                _broker_warn_count += 1
                if _broker_warn_count == 1 or _broker_warn_count % 10 == 0:
                    logging.warning(
                        "[Snapshot] Broker unavailable; retry scheduled (attempt %s, next in %.0fs)",
                        _broker_warn_count, _backoff,
                    )
                await asyncio.sleep(_backoff)
                _backoff = min(_backoff * 1.5, _max_backoff)
                continue
            await asyncio.sleep(0.2)


    @staticmethod
    def _split_topic(topic: str, prefix: str):
        parts = topic.split("/")
        prefix_parts = prefix.split("/")
        if len(parts) != len(prefix_parts) + 2:
            return None
        if parts[: len(prefix_parts)] != prefix_parts:
            return None
        return parts[-2], parts[-1]

    @staticmethod
    def _valid_id(value: Any) -> bool:
        return isinstance(value, str) and bool(SAFE_ID.fullmatch(value))

    async def handle_mqtt_message(self, topic: str, payload: Dict[str, Any]):
        if topic.startswith("ics/v1/commands/security/"):
            await self.handle_security_command(topic, payload)
            return
        if topic.startswith("ics/v1/commands/policy/"):
            await self.handle_policy_command(topic, payload)
            return
        if topic.startswith("lab/v1/commands/attack/"):
            await self.handle_attack_command(topic, payload)
            return
        logging.warning("[MQTT] Ignored unexpected topic %s", topic)

    def publish_security_ack(self, ack: Dict[str, Any]):
        command_id = ack.get("command_id")
        if not self._valid_id(command_id):
            return False
        topic = f"ics/v1/acks/{self.runtime_id}/{command_id}"
        return self.publish_json(topic, ack, encrypt=True)

    def publish_attack_ack(self, ack: Dict[str, Any]):
        request_id = ack.get("request_id")
        if not self._valid_id(request_id):
            return False
        topic = f"lab/v1/acks/{self.runtime_id}/{request_id}"
        return self.publish_json(topic, ack, encrypt=False)

    @staticmethod
    def _security_ack(
        command_id: str,
        runtime_id: str,
        target_id: str,
        command_type: str,
        status: str,
        message: str,
        error_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        ack = {
            "schema_version": 1,
            "command_id": command_id,
            "runtime_id": runtime_id,
            "target_id": target_id,
            "command_type": command_type,
            "status": status,
            "result_message": message,
            "ack_timestamp": utc_now_iso(),
        }
        if error_code:
            ack["error_code"] = error_code
        return ack

    async def handle_security_command(
        self,
        topic: str,
        payload: Dict[str, Any],
    ):
        topic_ids = self._split_topic(topic, "ics/v1/commands/security")
        if not topic_ids:
            logging.warning("[SecurityCommand] Invalid topic %s", topic)
            return
        topic_runtime, topic_target = topic_ids
        command_id = payload.get("command_id")
        command_type = payload.get("command_type")
        runtime_id = payload.get("runtime_id")
        target_id = payload.get("target_id")
        if not all(
            self._valid_id(value)
            for value in (command_id, topic_runtime, topic_target, target_id)
        ):
            logging.warning("[SecurityCommand] Invalid command identifiers")
            return
        if topic_runtime != self.runtime_id or runtime_id != self.runtime_id:
            logging.warning("[SecurityCommand] Runtime/topic mismatch")
            return
        if topic_target != target_id:
            logging.warning("[SecurityCommand] Target/topic mismatch")
            return

        payload_target = payload.get("payload", {}).get("target_device_id")
        if payload_target is not None and payload_target != target_id:
            logging.warning("[SecurityCommand] Nested target mismatch")
            return

        payload_hash = envelope_hash(payload)
        command_type_value = str(command_type or "unknown")
        claim = self.plant_db.claim_command(
            command_id,
            command_type_value,
            self.runtime_id,
            target_id,
            payload_hash,
            payload.get("issued_at"),
            payload.get("expires_at"),
        )
        if claim["state"] == "conflict":
            self.publish_security_ack(
                self._security_ack(
                    command_id,
                    self.runtime_id,
                    target_id,
                    command_type_value,
                    "failed",
                    "command_id was reused with a different envelope",
                    "command_id_reuse",
                )
            )
            return
        if claim["state"] == "duplicate":
            cached = claim["record"].get("final_ack")
            if cached:
                self.publish_security_ack(cached)
                return

        lock = self.command_locks.setdefault(target_id, asyncio.Lock())
        async with lock:
            current = self.plant_db.get_command(command_id)
            if current and current.get("final_ack"):
                self.publish_security_ack(current["final_ack"])
                return
            ack = None
            if payload.get("schema_version") != 1:
                ack = self._security_ack(
                    command_id,
                    self.runtime_id,
                    target_id,
                    command_type_value,
                    "failed",
                    "unsupported schema_version",
                    "invalid_schema",
                )
            elif command_type not in {"isolate", "rollback"}:
                ack = self._security_ack(
                    command_id,
                    self.runtime_id,
                    target_id,
                    command_type_value,
                    "failed",
                    "unsupported command_type",
                    "unsupported_command",
                )
            elif not self.plant_db.get_device(target_id):
                ack = self._security_ack(
                    command_id,
                    self.runtime_id,
                    target_id,
                    command_type_value,
                    "failed",
                    "target device does not exist",
                    "unknown_target",
                )
            else:
                expiry = parse_iso8601(payload.get("expires_at"))
                if not expiry or utc_now() >= expiry:
                    ack = self._security_ack(
                        command_id,
                        self.runtime_id,
                        target_id,
                        command_type_value,
                        "failed",
                        "command expired before execution",
                        "expired",
                    )

            terminal_attack_acks = []
            if ack is None:
                try:
                    if command_type == "isolate":
                        self.plant_db.set_isolated(target_id, True)
                        self.isolated_devices.add(target_id)
                        message = "target operational telemetry is isolated"
                    else:
                        terminal_attack_acks = self.plant_db.rollback_device(
                            target_id
                        )
                        self.isolated_devices.discard(target_id)
                        self.anomaly_states[target_id] = "normal"
                        message = "target baseline and overlays were restored"
                    ack = self._security_ack(
                        command_id,
                        self.runtime_id,
                        target_id,
                        command_type,
                        "succeeded",
                        message,
                    )
                except Exception as exc:
                    logging.exception("[SecurityCommand] Execution failed")
                    ack = self._security_ack(
                        command_id,
                        self.runtime_id,
                        target_id,
                        command_type_value,
                        "failed",
                        str(exc),
                        "execution_failed",
                    )

            self.plant_db.finalize_command(
                command_id,
                payload_hash,
                ack["status"],
                ack,
            )
            self.publish_security_ack(ack)
            for attack_ack in terminal_attack_acks:
                self.publish_attack_ack(attack_ack)

    @staticmethod
    def _attack_ack(
        request_id: str,
        runtime_id: str,
        target_id: str,
        scenario_id: str,
        status: str,
        terminal: bool,
        reason: str,
    ) -> Dict[str, Any]:
        return {
            "schema_version": 1,
            "request_id": request_id,
            "runtime_id": runtime_id,
            "target_id": target_id,
            "scenario_id": scenario_id,
            "status": status,
            "terminal": terminal,
            "reason": reason,
            "executed_at": utc_now_iso(),
        }

    def _cache_and_publish_attack_failure(
        self,
        request_id: str,
        target_id: str,
        scenario_id: str,
        payload_hash: str,
        reason: str,
    ):
        ack = self._attack_ack(
            request_id,
            self.runtime_id,
            target_id,
            scenario_id,
            "FAILED",
            True,
            reason,
        )
        result = self.plant_db.cache_attack_failure(
            request_id,
            self.runtime_id,
            target_id,
            scenario_id,
            payload_hash,
            ack,
        )
        self.publish_attack_ack(result.get("ack") or ack)

    async def handle_attack_command(
        self,
        topic: str,
        payload: Dict[str, Any],
    ):
        topic_ids = self._split_topic(topic, "lab/v1/commands/attack")
        if not topic_ids:
            logging.warning("[AttackLease] Invalid topic %s", topic)
            return
        topic_runtime, topic_target = topic_ids
        request_id = payload.get("request_id")
        runtime_id = payload.get("runtime_id")
        target_id = payload.get("target_id")
        scenario_id = payload.get("scenario_id")
        if not all(
            self._valid_id(value)
            for value in (request_id, topic_runtime, topic_target, target_id)
        ) or not isinstance(scenario_id, str):
            logging.warning("[AttackLease] Invalid lease identifiers")
            return
        if (
            topic_runtime != self.runtime_id
            or runtime_id != self.runtime_id
            or topic_target != target_id
        ):
            logging.warning("[AttackLease] Topic/envelope mismatch")
            return

        payload_hash = envelope_hash(payload)
        if scenario_id == "stop":
            ack = self.plant_db.stop_attack_lease(request_id, target_id)
            if not ack:
                self._cache_and_publish_attack_failure(
                    request_id,
                    target_id,
                    scenario_id,
                    payload_hash,
                    "active lease not found",
                )
                return
            self.anomaly_states[target_id] = "normal"
            self.publish_attack_ack(ack)
            return

        existing = self.plant_db.get_attack_lease(request_id)
        if existing:
            if existing["payload_hash"] != payload_hash:
                self.publish_attack_ack(
                    self._attack_ack(
                        request_id,
                        self.runtime_id,
                        target_id,
                        scenario_id,
                        "FAILED",
                        True,
                        "request_id was reused with a different envelope",
                    )
                )
                return
            cached = existing.get("final_ack") or existing.get("accepted_ack")
            if cached:
                self.publish_attack_ack(cached)
            return

        device = self.plant_db.get_device(target_id)
        if not device:
            self._cache_and_publish_attack_failure(
                request_id,
                target_id,
                scenario_id,
                payload_hash,
                "unknown target device",
            )
            return
        scenario_state, scenario_error = normalize_attack_scenario(
            scenario_id,
            device.get("node_type"),
        )
        if scenario_error:
            self._cache_and_publish_attack_failure(
                request_id,
                target_id,
                scenario_id,
                payload_hash,
                scenario_error,
            )
            return

        expires_at = parse_iso8601(payload.get("lease_expires_at"))
        now = utc_now()
        max_duration = payload.get("max_duration_seconds", 30)
        if (
            not expires_at
            or expires_at <= now
            or (expires_at - now).total_seconds() > 30.5
            or not isinstance(max_duration, (int, float))
            or isinstance(max_duration, bool)
            or max_duration <= 0
            or max_duration > 30
        ):
            self._cache_and_publish_attack_failure(
                request_id,
                target_id,
                scenario_id,
                payload_hash,
                "lease must be future-dated and no longer than 30 seconds",
            )
            return

        protocol, port = SCENARIO_FLOW.get(scenario_id, ("unknown", 0))
        policy_result = evaluate_policy(
            self.plant_db.get_active_policy(self.runtime_id),
            {
                "source_zone": "attack-lab",
                "destination_device_id": target_id,
                "destination_zone": device.get("zone"),
                "protocol": protocol,
                "port": port,
            },
        )
        if policy_result["action"] != "allow":
            self._cache_and_publish_attack_failure(
                request_id,
                target_id,
                scenario_id,
                payload_hash,
                f"blocked by OT policy: {policy_result['reason']}",
            )
            return

        accepted_ack = self._attack_ack(
            request_id,
            self.runtime_id,
            target_id,
            scenario_id,
            "ACCEPTED",
            False,
            "bounded attack lease started",
        )
        result = self.plant_db.start_attack_lease(
            request_id,
            self.runtime_id,
            target_id,
            scenario_id,
            scenario_state,
            payload_hash,
            now.isoformat().replace("+00:00", "Z"),
            expires_at.isoformat().replace("+00:00", "Z"),
            accepted_ack,
        )
        if result["state"] == "target_busy":
            self._cache_and_publish_attack_failure(
                request_id,
                target_id,
                scenario_id,
                payload_hash,
                f"target already has active lease {result['active_request_id']}",
            )
            return
        if result["state"] == "conflict":
            self.publish_attack_ack(
                self._attack_ack(
                    request_id,
                    self.runtime_id,
                    target_id,
                    scenario_id,
                    "FAILED",
                    True,
                    "request_id conflict",
                )
            )
            return
        if result["state"] == "duplicate":
            cached = (
                result["record"].get("final_ack")
                or result["record"].get("accepted_ack")
            )
            if cached:
                self.publish_attack_ack(cached)
            return

        self.anomaly_states[target_id] = scenario_state
        self.publish_attack_ack(accepted_ack)

    async def attack_watchdog_loop(self):
        while True:
            terminal_acks = self.plant_db.expire_attack_leases(utc_now_iso())
            for ack in terminal_acks:
                target_id = ack["target_id"]
                self.anomaly_states[target_id] = "normal"
                self.publish_attack_ack(ack)
            await asyncio.sleep(1)

    @staticmethod
    def _policy_ack(
        apply_id: str,
        runtime_id: str,
        version: Optional[int],
        policy_hash: Optional[str],
        status: str,
        message: str,
    ) -> Dict[str, Any]:
        return {
            "schema_version": 1,
            "command_id": apply_id,
            "policy_apply_id": apply_id,
            "command_type": "policy",
            "runtime_id": runtime_id,
            "target_id": runtime_id,
            "version": version,
            "policy_hash": policy_hash,
            "status": status,
            "result_message": message,
            "ack_timestamp": utc_now_iso(),
        }

    async def handle_policy_command(
        self,
        topic: str,
        payload: Dict[str, Any],
    ):
        parts = topic.split("/")
        if (
            len(parts) != 5
            or parts[:4] != ["ics", "v1", "commands", "policy"]
            or parts[4] != self.runtime_id
        ):
            logging.warning("[Policy] Invalid policy topic %s", topic)
            return

        policy = extract_policy_document(payload)
        version = policy.get("version")
        provided_hash = payload.get("policy_hash")
        apply_id = payload.get("policy_apply_id") or payload.get("command_id")
        if not apply_id and isinstance(version, int) and isinstance(provided_hash, str):
            apply_id = f"policy-{version}-{provided_hash[:12]}"
        if not self._valid_id(apply_id):
            logging.warning("[Policy] Missing or invalid policy_apply_id")
            return
        payload_hash = envelope_hash(payload)

        existing = self.plant_db.get_policy_application(apply_id)
        if existing:
            if existing["envelope_hash"] == payload_hash:
                self.publish_security_ack(existing["final_ack"])
            else:
                self.publish_security_ack(
                    self._policy_ack(
                        apply_id,
                        self.runtime_id,
                        version,
                        provided_hash,
                        "failed",
                        "policy_apply_id was reused with a different envelope",
                    )
                )
            return

        validation_error = validate_policy_document(policy)
        calculated_hash = None
        if not validation_error:
            calculated_hash = calculate_policy_hash(policy)
            if (
                not isinstance(provided_hash, str)
                or provided_hash != calculated_hash
            ):
                validation_error = "policy_hash mismatch"

        if validation_error:
            ack = self._policy_ack(
                apply_id,
                self.runtime_id,
                version if isinstance(version, int) else None,
                provided_hash if isinstance(provided_hash, str) else None,
                "failed",
                validation_error,
            )
            result = self.plant_db.cache_policy_failure(
                apply_id,
                self.runtime_id,
                version if isinstance(version, int) else None,
                provided_hash if isinstance(provided_hash, str) else None,
                payload_hash,
                ack,
            )
            self.publish_security_ack(result["final_ack"])
            return

        success_ack = self._policy_ack(
            apply_id,
            self.runtime_id,
            version,
            calculated_hash,
            "succeeded",
            "policy persisted and activated atomically",
        )
        result = self.plant_db.apply_policy(
            apply_id,
            self.runtime_id,
            policy,
            calculated_hash,
            payload_hash,
            success_ack,
        )
        if result["state"] == "stale":
            failure_ack = self._policy_ack(
                apply_id,
                self.runtime_id,
                version,
                calculated_hash,
                "failed",
                f"stale policy version; active version is {result['active_version']}",
            )
            cached = self.plant_db.cache_policy_failure(
                apply_id,
                self.runtime_id,
                version,
                calculated_hash,
                payload_hash,
                failure_ack,
            )
            self.publish_security_ack(cached["final_ack"])
            return
        if result["state"] == "conflict":
            self.publish_security_ack(
                self._policy_ack(
                    apply_id,
                    self.runtime_id,
                    version,
                    calculated_hash,
                    "failed",
                    "policy_apply_id conflict",
                )
            )
            return
        self.publish_security_ack(result["final_ack"])

    async def run(self):
        self.loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                self.loop.add_signal_handler(sig, self.shutdown_event.set)
            except (NotImplementedError, RuntimeError):
                pass

        # Expire stale leases before restoring overlays after a restart.
        self.plant_db.expire_attack_leases(utc_now_iso())
        modbus_port = int(os.getenv("MODBUS_PORT", "5020"))
        self.modbus_server = ModbusTCPServer(host="0.0.0.0", port=modbus_port)
        self.modbus_server.start()
        await self.reconcile_inventory()

        service_key = (
            os.getenv("HARDWARE_RUNTIME_SERVICE_KEY")
            or os.getenv("ATTACK_RUNTIME_SERVICE_KEY")
            or os.getenv("HARDWARE_SERVICE_KEY")
            or os.getenv("INTERNAL_SERVICE_KEY")
            or os.getenv("SIMULATOR_API_KEY")
        )
        self.api_server = RuntimeAPIServer(
            self.plant_db,
            service_key=service_key or "",
            host=os.getenv("RUNTIME_API_HOST", "0.0.0.0"),
            port=int(os.getenv("RUNTIME_API_PORT", "5002")),
            after_commit=self.on_inventory_commit,
        )
        self.api_server.start()

        self.client.connect_async(self.mqtt_host, self.mqtt_port, keepalive=60)
        self.client.loop_start()
        self.background_tasks = [
            asyncio.create_task(self.snapshot_loop(), name="snapshot-publisher"),
            asyncio.create_task(self.heartbeat_loop(), name="heartbeat-publisher"),
            asyncio.create_task(
                self.attack_watchdog_loop(),
                name="attack-lease-watchdog",
            ),
        ]
        self.snapshot_event.set()
        logging.info(
            "[Runtime] Started %s with authoritative PlantDB inventory",
            self.runtime_id,
        )

        try:
            await self.shutdown_event.wait()
        finally:
            for task in list(self.running_devices.values()) + self.background_tasks:
                task.cancel()
            await asyncio.gather(
                *list(self.running_devices.values()),
                *self.background_tasks,
                return_exceptions=True,
            )
            if self.api_server:
                self.api_server.stop()
            self.client.loop_stop()
            self.client.disconnect()
            if self.modbus_server:
                self.modbus_server.stop()


def main():
    engine = RuntimeEngine()
    try:
        asyncio.run(engine.run())
    except KeyboardInterrupt:
        logging.info("[Runtime] Shutdown requested")


if __name__ == "__main__":
    main()
