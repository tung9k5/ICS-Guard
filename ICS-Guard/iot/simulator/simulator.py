import os
import json
import time
import random
import asyncio
import urllib.request
import urllib.parse
import sys
import ssl
import paho.mqtt.client as mqtt

# Import modularized components
from plc import generate_plc_payload
from sensor import generate_sensor_payload
from smart_meter import generate_smart_meter_payload
from attacks import (
    trigger_periodic_traffic_spike,
    trigger_periodic_brute_force,
    run_traffic_spike_continuous,
    run_brute_force_continuous
)

# Ensure stdout handles UTF-8 (emojis and unicode characters) correctly on Windows consoles
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
with open(CONFIG_PATH, "r") as f:
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
# "normal", "traffic_spike"
device_anomaly_states = {d["_id"]: "normal" for d in DEVICES}

# Global event loop reference
MAIN_LOOP = None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[Simulator] Connected to MQTT Broker successfully.")
        client.subscribe("ics/control/attack", qos=1)
        print("[Simulator] Subscribed to topic 'ics/control/attack'.")
    else:
        print(f"[Simulator] Failed to connect, return code {rc}")

def send_rest_log(payload):
    """Helper to send auth logs/telemetry via REST Ingestion using built-in urllib."""
    url = f"{BACKEND_URL}/api/telemetry/ingest"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, 
        data=data, 
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            response.read()
    except Exception as e:
        print(f"[Simulator] Failed to send REST log: {e}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        print(f"[Simulator Control] Received command on {msg.topic}: {payload}")
        device_id = payload.get("device_id")
        attack_type = payload.get("attack_type")
        
        if not device_id or not attack_type:
            return

        if attack_type == "traffic_spike":
            if MAIN_LOOP:
                asyncio.run_coroutine_threadsafe(
                    run_traffic_spike_continuous(device_id, device_anomaly_states),
                    MAIN_LOOP
                )
        elif attack_type == "brute_force":
            if MAIN_LOOP:
                asyncio.run_coroutine_threadsafe(
                    run_brute_force_continuous(device_id, BACKEND_URL, send_rest_log, device_anomaly_states),
                    MAIN_LOOP
                )
        elif attack_type == "stop":
            device_anomaly_states[device_id] = "normal"
            print(f"[Simulator Control] Force restored {device_id} to normal state.")
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

async def simulate_device(device):
    device_id = device["_id"]
    zone = device["zone"]
    device_type = device["type"]
    
    topic = f"ics/telemetry/{device_id}"
    
    # Stagger startups randomly
    await asyncio.sleep(random.uniform(0.1, 5.0))
    
    while True:
        # Check current anomaly state
        state = device_anomaly_states.get(device_id, "normal")
        
        # Dispatch to the appropriate generator
        if device_type == "PLC":
            payload = generate_plc_payload(device, state)
        elif device_type == "SmartMeter":
            payload = generate_smart_meter_payload(device, state)
        else:
            payload = generate_sensor_payload(device, state)
            
        try:
            client.publish(topic, json.dumps(payload), qos=1)
            # Log telemetry in console (print only if device is under attack)
            if state != "normal":
                metrics = payload.get("metrics", {})
                bps = metrics.get("bytes_per_second", 0)
                temp = metrics.get("temperature", 0)
                cpu = metrics.get("cpu_usage", 0)
                print(f"[Telemetry Log] Device: {device_id} | Status: {state.upper()} | CPU: {cpu}% | Temp: {temp} C | Traffic: {bps} Bps")
        except Exception as e:
            print(f"[Simulator] Publish error on {device_id}: {e}")
            
        await asyncio.sleep(5.0)

async def main():
    global MAIN_LOOP
    MAIN_LOOP = asyncio.get_running_loop()
    
    device_sim_tasks = [simulate_device(d) for d in DEVICES]
    # Disable periodic automatic attacks, and only keep the device simulation loops.
    # Users trigger attacks manually via the Attacker Console!
    await asyncio.gather(*device_sim_tasks)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[Simulator] Shutting down.")
        client.loop_stop()
        client.disconnect()
