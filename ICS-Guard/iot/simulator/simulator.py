import os
import json
import time
import random
import asyncio
import urllib.request
import urllib.parse
import sys
import paho.mqtt.client as mqtt

# Import modularized components
from payload_generators import (
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

# Load env variables manually from root .env if it exists
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
if os.path.exists(dotenv_path):
    with open(dotenv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("'").strip('"')
                os.environ[key] = val

# Load config
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    DEVICES = json.load(f)

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

print(f"[Simulator] Loaded {len(DEVICES)} devices.")
print(f"[Simulator] Target MQTT Broker: {MQTT_HOST}:{MQTT_PORT}")
print(f"[Simulator] Target Backend API: {BACKEND_URL}")

try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, "ics_guard_simulator")
except AttributeError:
    client = mqtt.Client("ics_guard_simulator")

# Setup TLS if ca.crt exists
ca_cert_path = os.path.join(os.path.dirname(__file__), "certs", "ca.crt")
if os.path.exists(ca_cert_path):
    print(f"[Simulator] Enabling TLS using CA certificate at: {ca_cert_path}")
    try:
        client.tls_set(ca_certs=ca_cert_path)
        client.tls_insecure_set(True)
        if MQTT_PORT == 1883:
            MQTT_PORT = int(os.getenv("MQTT_TLS_PORT", 8883))
    except Exception as e:
        print(f"[Simulator] Failed to configure TLS: {e}")

# Global dict to store current anomaly state for each device
device_anomaly_states = {d["_id"]: "normal" for d in DEVICES}

# Edge Gateway Controller for closed loop rules
gateway_controller = EdgeGatewayController(DEVICES, device_anomaly_states)

# Global event loop reference
MAIN_LOOP = None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[Simulator] Connected to MQTT Broker successfully.")
        client.subscribe("ics/control/attack", qos=1)
        print("[Simulator] Subscribed to topic 'ics/control/attack'.")
    else:
        print(f"[Simulator] Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        print(f"[Simulator Control] Received command on {msg.topic}: {payload}")
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
            print(f"🔄 [Simulator Safety] Nhận lệnh ROLLBACK trên thiết bị {device_id}.")
            print(f"⚙️  Đang phục hồi chương trình OB1 từ phân vùng Backup an toàn...")
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
        print(f"[Simulator Control] Failed to process message: {e}")

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
        print(f"[Simulator] Connection failed to MQTT Broker (retry {retry+1}/10): {e}")
        time.sleep(5)

if not connected:
    print("[Simulator] Could not connect to MQTT Broker. Exiting.")
    exit(1)

blocked_ips = set()

async def sync_blocked_ips():
    global blocked_ips
    print("[Simulator Firewall] Khởi động tiến trình đồng bộ danh sách IP bị chặn...")
    while True:
        try:
            url = f"{BACKEND_URL}/api/telemetry/blocked-ips"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    new_blocked = {item["ipAddress"] for item in data if "ipAddress" in item}
                    if new_blocked != blocked_ips:
                        print(f"🛡️ [Simulator Firewall] Cập nhật danh sách đen IP: {new_blocked}")
                        blocked_ips = new_blocked
        except Exception as e:
            # Lỗi mạng tạm thời, bỏ qua silently
            pass
        await asyncio.sleep(5.0)

async def simulate_device(device):
    device_id = device["_id"]
    zone = device["zone"]
    node_type = device.get("node_type", "sensor")
    
    topic = f"ics/telemetry/{device_id}"
    
    # Stagger startups randomly
    await asyncio.sleep(random.uniform(0.1, 5.0))
    
    while True:
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
        # We pass a list of 1 payload and execute rules
        modified_payloads = gateway_controller.run_local_rules([payload])
        final_payload = modified_payloads[0]
        
        # 2.5 Lọc các log nghiệp vụ độc hại từ IP bị chặn (Edge Firewall Simulation)
        if "logs" in final_payload and isinstance(final_payload["logs"], list):
            original_logs = final_payload["logs"]
            filtered_logs = [log for log in original_logs if log.get("source_ip") not in blocked_ips]
            if len(filtered_logs) < len(original_logs):
                blocked_list = [log.get('source_ip') for log in original_logs if log.get('source_ip') in blocked_ips]
                print(f"🛡️ [Simulator Firewall] BLOCK! Đã chặn {len(original_logs) - len(filtered_logs)} gói tin log độc hại từ IP: {blocked_list}")
                final_payload["logs"] = filtered_logs
        
        # 3. Publish over MQTTS
        try:
            # If the device is under signal_loss attack, simulate signal cut (do not publish)
            if state == "signal_loss":
                pass
            else:
                client.publish(topic, json.dumps(final_payload), qos=1)
                
            # Log telemetry in console if device is under attack or has logs
            if state != "normal" or len(final_payload.get("logs", [])) > 0:
                metrics = final_payload.get("metrics", {})
                logs_count = len(final_payload.get("logs", []))
                print(f"[Telemetry Log] Node: {device_id} ({node_type.upper()}) | State: {state.upper()} | Metrics: {metrics} | Logs: {logs_count}")
        except Exception as e:
            print(f"[Simulator] Publish error on {device_id}: {e}")
            
        await asyncio.sleep(5.0)

async def main():
    global MAIN_LOOP
    MAIN_LOOP = asyncio.get_running_loop()
    
    # Chạy tác vụ đồng bộ IP chặn chạy ngầm
    asyncio.create_task(sync_blocked_ips())
    
    device_sim_tasks = [simulate_device(d) for d in DEVICES]
    await asyncio.gather(*device_sim_tasks)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[Simulator] Shutting down.")
        client.loop_stop()
        client.disconnect()
