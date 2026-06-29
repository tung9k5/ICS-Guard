import random
import time

def generate_sensor_payload(device, state):
    device_id = device["_id"]
    zone = device["zone"]
    device_type = device["type"] # Sensor
    
    base_temp = 35.0
    base_cpu = 10.0
    base_bps = 5000
    
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
    
    return {
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
