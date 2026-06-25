import os
import json
import time
import random
import asyncio
import urllib.request
import urllib.parse
import paho.mqtt.client as mqtt

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

# Global dict to store current anomaly state for each device
# "normal", "traffic_spike"
device_anomaly_states = {d["_id"]: "normal" for d in DEVICES}

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[Simulator] Connected to MQTT Broker successfully.")
    else:
        print(f"[Simulator] Failed to connect, return code {rc}")

client.on_connect = on_connect

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

async def simulate_device(device):
    device_id = device["_id"]
    zone = device["zone"]
    device_type = device["type"]
    
    # Base configuration values
    base_temp = 35.0
    base_cpu = 10.0
    base_bps = 5000
    
    if device_type == "PLC":
        base_temp = 42.0
        base_cpu = 15.0
        base_bps = 12000
    elif device_type == "SmartMeter":
        base_temp = 30.0
        base_cpu = 5.0
        base_bps = 2000
    
    topic = f"ics/telemetry/{device_id}"
    
    # Stagger startups randomly
    await asyncio.sleep(random.uniform(0.1, 5.0))
    
    while True:
        # Check current anomaly state
        state = device_anomaly_states.get(device_id, "normal")
        
        if state == "traffic_spike":
            # Simulate a massive DDoS/Spike
            temp = base_temp + random.uniform(5.0, 10.0)
            cpu = base_cpu + random.uniform(40.0, 60.0)
            bps = int(base_bps * 8 + random.randint(5000, 15000)) # 8x spike
        else:
            # Normal variations
            temp = base_temp + random.uniform(-2.0, 2.0)
            cpu = base_cpu + random.uniform(-1.0, 1.0)
            bps = int(base_bps + random.randint(-500, 500))
        
        # Keep values in bound
        cpu = max(0.1, min(100.0, cpu))
        temp = max(10.0, temp)
        bps = max(100, bps)
        
        payload = {
            "device_id": device_id,
            "zone": zone,
            "device_type": device_type,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "metrics": {
                "temperature": round(temp, 2),
                "cpu_usage": round(cpu, 2),
                "bytes_per_second": bps
            },
            "status": "active"
        }
        
        try:
            client.publish(topic, json.dumps(payload), qos=1)
        except Exception as e:
            print(f"[Simulator] Publish error on {device_id}: {e}")
            
        await asyncio.sleep(5.0)

async def trigger_periodic_traffic_spike():
    """Periodically triggers a traffic spike on a random PLC device to simulate attack."""
    # Start after 60 seconds
    await asyncio.sleep(60)
    plcs = [d for d in DEVICES if d["type"] == "PLC"]
    
    while True:
        target_plc = random.choice(plcs)
        target_id = target_plc["_id"]
        
        print(f"\n🚨 [Simulator Anomaly] Triggering ABNORMAL_TRAFFIC_SPIKE on {target_id}...")
        device_anomaly_states[target_id] = "traffic_spike"
        
        # Spike lasts for 30 seconds
        await asyncio.sleep(30)
        
        print(f"✅ [Simulator Anomaly] Restoring {target_id} to normal traffic levels.\n")
        device_anomaly_states[target_id] = "normal"
        
        # Wait 90 seconds before next spike
        await asyncio.sleep(90)

async def trigger_periodic_brute_force():
    """Periodically triggers SSH Brute Force failed logins on a random PLC via REST API."""
    # Start after 40 seconds
    await asyncio.sleep(40)
    plcs = [d for d in DEVICES if d["type"] == "PLC"]
    attacker_ip = "185.220.101.45"
    
    while True:
        target_plc = random.choice(plcs)
        target_id = target_plc["_id"]
        
        print(f"\n🚨 [Simulator Anomaly] Triggering DEVICE_BRUTE_FORCE attack simulation on {target_id} from IP {attacker_ip}...")
        
        # Send 12 failed authentication log packets over REST Ingest quickly (1.5 seconds apart)
        for i in range(12):
            payload = {
                "device_id": target_id,
                "log_type": "auth",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "event": "AUTH_FAILED",
                "source_ip": attacker_ip,
                "username": "admin_root"
            }
            # Send REST post asynchronously in background to not block loop
            loop = asyncio.get_event_loop()
            loop.run_in_executor(None, send_rest_log, payload)
            await asyncio.sleep(1.5)
            
        print(f"✅ [Simulator Anomaly] Completed brute force simulation burst on {target_id}.\n")
        
        # Wait 120 seconds before next brute force simulation
        await asyncio.sleep(120)

async def main():
    device_sim_tasks = [simulate_device(d) for d in DEVICES]
    await asyncio.gather(*device_sim_tasks)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[Simulator] Shutting down.")
        client.loop_stop()
        client.disconnect()
