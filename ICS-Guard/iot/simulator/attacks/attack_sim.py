import random
import asyncio
import time

async def trigger_periodic_traffic_spike(devices, device_anomaly_states):
    """Periodically triggers a traffic spike on a random PLC device to simulate attack."""
    # Start after 60 seconds
    await asyncio.sleep(60)
    plcs = [d for d in devices if d["type"] == "PLC"]
    if not plcs:
        return
    
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

async def trigger_periodic_brute_force(devices, backend_url, send_rest_log_fn):
    """Periodically triggers SSH Brute Force failed logins on a random PLC via REST API."""
    # Start after 40 seconds
    await asyncio.sleep(40)
    plcs = [d for d in devices if d["type"] == "PLC"]
    if not plcs:
        return
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
            loop.run_in_executor(None, send_rest_log_fn, payload)
            await asyncio.sleep(1.5)
            
        print(f"✅ [Simulator Anomaly] Completed brute force simulation burst on {target_id}.\n")
        
        # Wait 120 seconds before next brute force simulation
        await asyncio.sleep(120)

async def run_traffic_spike_continuous(device_id, device_anomaly_states):
    """Triggers a traffic spike on a specific device continuously."""
    print(f"\n🚨 [Simulator Anomaly] Manually triggering ABNORMAL_TRAFFIC_SPIKE on {device_id}...")
    device_anomaly_states[device_id] = "traffic_spike"

async def run_brute_force_continuous(device_id, backend_url, send_rest_log_fn, device_anomaly_states):
    """Triggers SSH Brute Force failed logins on a specific device continuously until stopped."""
    attacker_ip = "185.220.101.45"
    print(f"\n🚨 [Simulator Anomaly] Manually triggering DEVICE_BRUTE_FORCE attack on {device_id} from IP {attacker_ip}...")
    device_anomaly_states[device_id] = "brute_force"
    
    while device_anomaly_states.get(device_id) == "brute_force":
        payload = {
            "device_id": device_id,
            "log_type": "auth",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "event": "AUTH_FAILED",
            "source_ip": attacker_ip,
            "username": "admin_root"
        }
        # Send REST post asynchronously in background to not block loop
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, send_rest_log_fn, payload)
        await asyncio.sleep(1.5)
        
    print(f"✅ [Simulator Anomaly] Stopped brute force simulation on {device_id}.\n")
