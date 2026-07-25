import os
import json
import time
import random
import asyncio
import urllib.request
import urllib.parse
import sys
import logging
import base64
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

# Add parent directory to sys.path to import payloads, agents, etc.
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import modularized components
from payloads.payload_generators import (
    generate_gateway_payload,
    generate_controller_payload,
    generate_chip_payload,
    generate_sensor_payload,
    generate_actuator_payload
)
from edge_gateway import EdgeGatewayController
from attacks import run_attack_continuous, stop_attack_continuous

# Ensure stdout handles UTF-8 correctly
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Configure python logging to avoid silent exceptions
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load env variables via python-dotenv
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv(dotenv_path)

# AES-256-CBC Encryption setup
AES_SECRET_KEY = os.getenv("AES_SECRET_KEY")
AES_IV = os.getenv("AES_IV")

if not AES_SECRET_KEY or len(AES_SECRET_KEY) != 32:
    logging.critical("[CRITICAL] AES_SECRET_KEY environment variable is missing, default, or invalid. Must be exactly 32 bytes.")
    sys.exit(1)

if not AES_IV or len(AES_IV) != 16:
    logging.critical("[CRITICAL] AES_IV environment variable is missing, default, or invalid. Must be exactly 16 bytes.")
    sys.exit(1)

def encrypt_payload(data_dict):
    data_str = json.dumps(data_dict)
    raw_iv = os.urandom(12)
    
    cipher = Cipher(algorithms.AES(AES_SECRET_KEY.encode()), modes.GCM(raw_iv), backend=default_backend())
    encryptor = cipher.encryptor()
    ct = encryptor.update(data_str.encode('utf-8')) + encryptor.finalize()
    
    return {
        "encrypted_data": base64.b64encode(ct).decode('utf-8'),
        "iv": base64.b64encode(raw_iv).decode('utf-8'),
        "auth_tag": base64.b64encode(encryptor.tag).decode('utf-8'),
        "alg": "AES-256-GCM"
    }

# Load config
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
DEVICES = []
ALL_DEVICES_MAP = {}

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Fetch devices from backend or fallback to config.json
try:
    logging.info(f"[Simulator] Fetching devices from backend API: {BACKEND_URL}/api/devices/public/list-all...")
    req = urllib.request.Request(f"{BACKEND_URL}/api/devices/public/list-all")
    req.add_header('x-simulator-api-key', os.getenv('SIMULATOR_API_KEY', ''))
    with urllib.request.urlopen(req, timeout=5) as response:
        if response.status == 200:
            raw = json.loads(response.read().decode('utf-8'))
            fetched = raw if isinstance(raw, list) else raw.get('data', [])
            DEVICES = [d for d in fetched if d.get('status', 'active') not in ['unprovisioned', 'offline', 'decommissioned']]
            ALL_DEVICES_MAP = {d["_id"]: d for d in fetched}
            logging.info(f"[Simulator] Dynamic fetch success! Loaded {len(DEVICES)} active devices.")
except Exception as e:
    logging.warning(f"[Simulator] Failed to fetch devices from backend: {e}. Falling back to static config.json")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        fetched = json.load(f)
        DEVICES = [d for d in fetched if d.get('status', 'active') not in ['unprovisioned', 'offline', 'decommissioned']]
        ALL_DEVICES_MAP = {d["_id"]: d for d in fetched}

logging.info(f"[Simulator] Initialized with {len(DEVICES)} devices.")
logging.info(f"[Simulator] Target MQTT Broker: {MQTT_HOST}:{MQTT_PORT}")
logging.info(f"[Simulator] Target Backend API: {BACKEND_URL}")

try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, "ics_guard_simulator")
except AttributeError:
    client = mqtt.Client("ics_guard_simulator")

# Setup TLS if ca.crt exists
ca_cert_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "certificates", "ca.crt"))
if os.path.exists(ca_cert_path):
    logging.info(f"[Simulator] Enabling TLS using CA certificate at: {ca_cert_path}")
    try:
        client.tls_set(ca_certs=ca_cert_path)
        allow_insecure_tls = os.getenv("ALLOW_INSECURE_TLS", "false").lower() == "true"
        client.tls_insecure_set(allow_insecure_tls)
        if MQTT_PORT == 1883:
            MQTT_PORT = int(os.getenv("MQTT_TLS_PORT", 8883))
    except Exception as e:
        logging.error(f"[Simulator] Failed to configure TLS: {e}")

# Global dict to store current anomaly state for each device
device_anomaly_states = {d["_id"]: "normal" for d in DEVICES}

from modbus_server import ModbusTCPServer

# Start Modbus TCP Server representing PLCs
modbus_port = int(os.getenv("MODBUS_PORT", 5020))
modbus_server = ModbusTCPServer(host="0.0.0.0", port=modbus_port)
modbus_server.start()

# Edge Gateway Controller for closed loop rules
gateway_controller = EdgeGatewayController(DEVICES, device_anomaly_states, modbus_host="127.0.0.1", modbus_port=modbus_port)

# Global event loop reference
MAIN_LOOP = None
running_devices = {}

def decrypt_payload(payload_dict):
    try:
        if isinstance(payload_dict, str):
            encrypted_data = payload_dict
            iv = None
            auth_tag = None
            alg = "AES-256-CBC"
        else:
            encrypted_data = payload_dict.get("encrypted_data")
            iv = payload_dict.get("iv")
            auth_tag = payload_dict.get("auth_tag")
            alg = payload_dict.get("alg", "AES-256-CBC")

        raw_ciphertext = base64.b64decode(encrypted_data)

        if alg == "AES-256-GCM" or (iv and auth_tag):
            raw_iv = base64.b64decode(iv)
            raw_auth_tag = base64.b64decode(auth_tag)
            cipher = Cipher(
                algorithms.AES(AES_SECRET_KEY.encode()),
                modes.GCM(raw_iv, raw_auth_tag),
                backend=default_backend()
            )
            decryptor = cipher.decryptor()
            decrypted_bytes = decryptor.update(raw_ciphertext) + decryptor.finalize()
            return json.loads(decrypted_bytes.decode('utf-8'))
        else:
            cipher = Cipher(
                algorithms.AES(AES_SECRET_KEY.encode()),
                modes.CBC(AES_IV.encode()),
                backend=default_backend()
            )
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(raw_ciphertext) + decryptor.finalize()
            unpadder = padding.PKCS7(128).unpadder()
            data_str = unpadder.update(padded_data) + unpadder.finalize()
            return json.loads(data_str.decode('utf-8'))
    except Exception as e:
        logging.error(f"[Simulator Decrypt] Failed to decrypt command: {e}")
        return None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logging.info("[Simulator] Connected to MQTT Broker successfully.")
        client.subscribe("ics/control/attack", qos=1)
        client.subscribe("ics/device/sync", qos=1)
        logging.info("[Simulator] Subscribed to topic 'ics/control/attack' and 'ics/device/sync'.")
    else:
        logging.error(f"[Simulator] Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        
        # Check if the payload is encrypted (ics/control/attack commands from backend are encrypted)
        if "encrypted_data" in payload:
            decrypted = decrypt_payload(payload)
            if decrypted:
                payload = decrypted
            else:
                return

        logging.info(f"[Simulator Control] Received command on {msg.topic}: {payload}")
        
        if msg.topic == "ics/device/sync":
            action = payload.get("action")
            if action == "create":
                device = payload.get("device")
                if device:
                    ALL_DEVICES_MAP[device["_id"]] = device
                    if MAIN_LOOP:
                        asyncio.run_coroutine_threadsafe(
                            add_dynamic_device(device),
                            MAIN_LOOP
                        )
            elif action == "delete":
                device_id = payload.get("device_id")
                if device_id:
                    if device_id in ALL_DEVICES_MAP:
                        ALL_DEVICES_MAP[device_id]["status"] = "offline"
                    if MAIN_LOOP:
                        asyncio.run_coroutine_threadsafe(
                            remove_dynamic_device(device_id),
                            MAIN_LOOP
                        )
            elif action == "update":
                device = payload.get("device")
                if device:
                    ALL_DEVICES_MAP[device["_id"]] = device
            return

        device_id = payload.get("device_id")
        attack_type = payload.get("attack_type")
        
        if not device_id or not attack_type:
            return

        if attack_type == "stop":
            if MAIN_LOOP:
                asyncio.run_coroutine_threadsafe(
                    stop_attack_continuous(device_id, device_anomaly_states),
                    MAIN_LOOP
                )
        elif attack_type == "rollback":
            logging.info(f"🔄 [Simulator Safety] Nhận lệnh ROLLBACK trên thiết bị {device_id}.")
            logging.info(f"⚙️  Đang phục hồi chương trình OB1 và đặt lại các thanh ghi Modbus...")
            # Reset Modbus coils and registers to normal states
            for i in range(100):
                modbus_server.set_coil(i, False)
                modbus_server.set_register(i, 0)
            if MAIN_LOOP:
                asyncio.run_coroutine_threadsafe(
                    stop_attack_continuous(device_id, device_anomaly_states),
                    MAIN_LOOP
                )
        else:
            if MAIN_LOOP:
                asyncio.run_coroutine_threadsafe(
                    run_attack_continuous(device_id, attack_type, device_anomaly_states),
                    MAIN_LOOP
                )
    except Exception as e:
        logging.error(f"[Simulator Control] Failed to process message: {e}")

client.on_connect = on_connect
client.on_message = on_message

# Connect to broker with retry logic
connected = False
for retry in range(10):
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_start()
        connected = True
        break
    except Exception as e:
        logging.warning(f"[Simulator] Connection failed to MQTT Broker (retry {retry+1}/10): {e}")
        time.sleep(5)

if not connected:
    logging.critical("[Simulator] Could not connect to MQTT Broker. Exiting.")
    exit(1)

blocked_ips = set()

async def sync_blocked_ips():
    global blocked_ips
    logging.info("[Simulator Firewall] Khởi động tiến trình đồng bộ danh sách IP bị chặn...")
    while True:
        try:
            url = f"{BACKEND_URL}/api/telemetry/blocked-ips"
            req = urllib.request.Request(url)
            req.add_header('x-device-api-key', os.getenv('DEVICE_API_KEY', ''))
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    new_blocked = {item["ipAddress"] for item in data if "ipAddress" in item}
                    if new_blocked != blocked_ips:
                        logging.info(f"🛡️ [Simulator Firewall] Cập nhật danh sách đen IP: {new_blocked}")
                        blocked_ips = new_blocked
        except Exception as e:
            logging.warning(f"🛡️ [Simulator Firewall] Lỗi đồng bộ IP bị chặn: {e}")
        await asyncio.sleep(5.0)

def is_device_reachable(device_id):
    curr_id = device_id
    visited = set()
    while curr_id:
        if curr_id in visited:
            break
        visited.add(curr_id)
        dev = ALL_DEVICES_MAP.get(curr_id)
        if not dev:
            break
        if dev.get("status", "active") in ["offline", "unprovisioned", "decommissioned"]:
            return False
        curr_id = dev.get("parent_id")
    return True

async def simulate_device(device):
    device_id = device["_id"]
    zone = device["zone"]
    node_type = device.get("node_type", "sensor")
    
    topic = f"ics/telemetry/{device_id}"
    
    # Stagger startups randomly
    await asyncio.sleep(random.uniform(0.1, 5.0))
    
    try:
        while True:
            if not is_device_reachable(device_id):
                await asyncio.sleep(5.0)
                continue
            state = device_anomaly_states.get(device_id, "normal")
            
            # 1. Dispatch payload generation to the specific generator
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
                
            # 2. Run Local Closed-Loop rules if applicable (modifying actuator payloads on the fly)
            modified_payloads = gateway_controller.run_local_rules([payload])
            final_payload = modified_payloads[0]
            
            # 2.5 Lọc các log nghiệp vụ độc hại từ IP bị chặn (Edge Firewall Simulation)
            if "logs" in final_payload and isinstance(final_payload["logs"], list):
                original_logs = final_payload["logs"]
                filtered_logs = [log for log in original_logs if log.get("source_ip") not in blocked_ips]
                if len(filtered_logs) < len(original_logs):
                    blocked_list = [log.get('source_ip') for log in original_logs if log.get('source_ip') in blocked_ips]
                    logging.warning(f"🛡️ [Simulator Firewall] BLOCK! Chặn log độc hại từ IP: {blocked_list}")
                    final_payload["logs"] = filtered_logs
            
            # 3. Publish over MQTTS (Encrypted with AES)
            try:
                if state == "signal_loss":
                    pass
                else:
                    secure_payload = encrypt_payload(final_payload)
                    secure_json = json.dumps(secure_payload)
                    client.publish(topic, secure_json, qos=1)
                    
                # Log telemetry in console if device is under attack or has logs
                if state != "normal" or len(final_payload.get("logs", [])) > 0:
                    metrics = final_payload.get("metrics", {})
                    logs_count = len(final_payload.get("logs", []))
                    logging.info(f"[Telemetry Log] Node: {device_id} | State: {state.upper()} | Metrics: {metrics} | Logs: {logs_count}")
            except Exception as e:
                logging.error(f"[Simulator] Publish error on {device_id}: {e}")
                
            await asyncio.sleep(5.0)
    except asyncio.CancelledError:
        logging.info(f"[Simulator] Simulation task for device {device_id} cancelled.")

async def add_dynamic_device(device):
    device_id = device["_id"]
    if device_id in running_devices:
        return
    
    logging.info(f"🟢 [Simulator Dynamic] CẮM NÓNG thiết bị: {device.get('name', device_id)} ({device_id}). Khởi tạo luồng telemetry...")
    DEVICES.append(device)
    device_anomaly_states[device_id] = "normal"
    
    task = asyncio.create_task(simulate_device(device))
    running_devices[device_id] = task

async def remove_dynamic_device(device_id):
    if device_id not in running_devices:
        return
    
    logging.info(f"🔴 [Simulator Dynamic] RÚT DÂY MẠNG thiết bị: {device_id}. Hủy luồng telemetry...")
    # Remove from devices list
    for d in DEVICES:
        if d["_id"] == device_id:
            DEVICES.remove(d)
            break
            
    if device_id in device_anomaly_states:
        del device_anomaly_states[device_id]
        
    task = running_devices[device_id]
    task.cancel()
    del running_devices[device_id]

async def main():
    global MAIN_LOOP
    MAIN_LOOP = asyncio.get_running_loop()
    
    # Chạy tác vụ đồng bộ IP chặn chạy ngầm
    asyncio.create_task(sync_blocked_ips())
    
    # Khởi động mô phỏng cho các thiết bị ban đầu
    for d in DEVICES:
        device_id = d["_id"]
        task = asyncio.create_task(simulate_device(d))
        running_devices[device_id] = task
        
    logging.info(f"[Simulator] Started simulation loop for {len(running_devices)} devices.")
    
    # Giữ luồng main chạy vô hạn
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("[Simulator] Shutting down.")
        modbus_server.stop()
        client.loop_stop()
        client.disconnect()
