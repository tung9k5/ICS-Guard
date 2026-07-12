import random
import time

def get_timestamp():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def generate_gateway_payload(device, state):
    device_id = device["_id"]
    zone = device["zone"]
    node_type = device["node_type"]
    
    # Baseline
    cpu = 12.5
    mem = 28.0
    bps = 15000
    pkt_rate = 450
    logs = []
    
    if state == "wan_dos":
        cpu = random.uniform(85.0, 98.0)
        mem = random.uniform(75.0, 92.0)
        bps = random.randint(120000, 250000) # Heavy flood
        pkt_rate = random.randint(3000, 5000)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "ERROR",
            "event": "TLS_HANDSHAKE_FAILED",
            "source_ip": "185.220.101.45",
            "message": "TLS Handshake timeout: buffer exhausted under high load"
        })
    elif state == "route_poisoning":
        cpu = random.uniform(20.0, 35.0)
        bps = random.randint(18000, 28000)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "WARN",
            "event": "ROUTE_MODIFIED",
            "source_ip": "185.220.101.45",
            "message": "Gateway static route modified. Traffic redirected to 185.220.101.45"
        })
    else:
        # Normal
        cpu += random.uniform(-1.5, 1.5)
        mem += random.uniform(-0.5, 0.5)
        bps += random.randint(-1000, 1000)
        pkt_rate += random.randint(-20, 20)
        if random.random() < 0.1:
            logs.append({
                "timestamp": get_timestamp(),
                "log_level": "INFO",
                "event": "ROUTING_STABLE",
                "source_ip": "127.0.0.1",
                "message": f"Active routes: 14. Forwarding traffic normal."
            })
            
    return {
        "device_id": device_id,
        "zone": zone,
        "device_type": "Gateway",
        "node_type": node_type,
        "timestamp": get_timestamp(),
        "metrics": {
            "cpu_usage": round(cpu, 2),
            "memory_usage": round(mem, 2),
            "bytes_per_second": bps,
            "packet_forward_rate": pkt_rate
        },
        "logs": logs,
        "status": "active"
    }

def generate_controller_payload(device, state):
    device_id = device["_id"]
    zone = device["zone"]
    node_type = device["node_type"]
    
    cpu = 18.0
    scan_time = 12.0 # ms
    bps = 8000
    logs = []
    
    if state == "logic_tampering":
        cpu = random.uniform(65.0, 85.0)
        scan_time = random.uniform(45.0, 75.0) # elevated execution time
        bps = random.randint(9000, 12000)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "CRITICAL",
            "event": "FIRMWARE_CHECKSUM_ERROR",
            "source_ip": "192.168.10.105",
            "message": "Ladder logic block OB1 hash mismatch. Potential unauthorized modification"
        })
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "ERROR",
            "event": "SCAN_CYCLE_LIMIT_EXCEEDED",
            "source_ip": "127.0.0.1",
            "message": f"Scan cycle execution took {round(scan_time, 2)}ms (Limit: 50.0ms)"
        })
    elif state == "modbus_flooding":
        cpu = random.uniform(50.0, 75.0)
        bps = random.randint(60000, 95000)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "WARN",
            "event": "MODBUS_SESSION_OPEN",
            "source_ip": f"192.168.20.{random.randint(150, 250)}",
            "message": "Multiple concurrent Modbus TCP sessions initialized rapidly"
        })
        if random.random() < 0.5:
            logs.append({
                "timestamp": get_timestamp(),
                "log_level": "ERROR",
                "event": "MAX_CONNECTIONS_REACHED",
                "source_ip": "127.0.0.1",
                "message": "Modbus client connection pool exhausted (Max: 16 sessions)"
            })
    else:
        cpu += random.uniform(-1.0, 1.0)
        scan_time += random.uniform(-0.5, 0.5)
        bps += random.randint(-500, 500)
        if random.random() < 0.05:
            logs.append({
                "timestamp": get_timestamp(),
                "log_level": "INFO",
                "event": "MODBUS_WRITE_REGISTER",
                "source_ip": "192.168.10.1",
                "message": "Modbus client wrote to Register 40005 (value: 24)"
            })
            
    return {
        "device_id": device_id,
        "zone": zone,
        "device_type": "Controller",
        "node_type": node_type,
        "timestamp": get_timestamp(),
        "metrics": {
            "cpu_usage": round(cpu, 2),
            "scan_cycle_time_ms": round(scan_time, 2),
            "bytes_per_second": bps
        },
        "logs": logs,
        "status": "active"
    }

def generate_chip_payload(device, state):
    device_id = device["_id"]
    zone = device["zone"]
    node_type = device["node_type"]
    
    heap = 184500 # free heap bytes
    rssi = -62 # wifi signal dbm
    logs = []
    
    if state == "ota_tampering":
        heap = random.randint(120000, 150000)
        rssi += random.randint(-5, 5)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "WARN",
            "event": "OTA_UPDATE_START",
            "source_ip": "192.168.10.100",
            "message": "Firmware over-the-air update initiated from remote socket"
        })
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "ERROR",
            "event": "OTA_HASH_MISMATCH",
            "source_ip": "192.168.10.100",
            "message": "Firmware signature verification failed. Partition rejected"
        })
    elif state == "watchdog_reset":
        heap = random.randint(1500, 8000) # memory leak
        rssi = -88
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "CRITICAL",
            "event": "WATCHDOG_RESET",
            "source_ip": "127.0.0.1",
            "message": "Hardware Watchdog Timer triggered (WDT Reset). CPU frozen"
        })
    else:
        heap += random.randint(-2000, 2000)
        rssi += random.randint(-2, 2)
        if random.random() < 0.02:
            logs.append({
                "timestamp": get_timestamp(),
                "log_level": "INFO",
                "event": "WIFI_CONNECTED",
                "source_ip": "192.168.10.1",
                "message": f"Connected to AP. Assigned IP: {device['ipAddress']}"
            })
            
    return {
        "device_id": device_id,
        "zone": zone,
        "device_type": "Chip",
        "node_type": node_type,
        "timestamp": get_timestamp(),
        "metrics": {
            "heap_free_bytes": heap,
            "wifi_signal_dbm": rssi
        },
        "logs": logs,
        "status": "active"
    }

def generate_sensor_payload(device, state):
    device_id = device["_id"]
    zone = device["zone"]
    node_type = device["node_type"]
    
    # Base values depending on name
    base_val = 35.0
    val_unit = "C"
    
    if "temp" in device_id:
        base_val = 45.0
        val_unit = "C"
    elif "flow" in device_id:
        base_val = 12.5
        val_unit = "L/min"
    elif "meter" in device_id:
        base_val = 220.0
        val_unit = "V"
    elif "gas" in device_id:
        base_val = 15.0
        val_unit = "ppm"
    elif "press" in device_id:
        base_val = 1.2
        val_unit = "bar"
        
    battery = 98.0
    drift = 0.0
    logs = []
    
    if state == "sensor_spoofing":
        # Simulate false data injection
        if "temp" in device_id:
            val = base_val + random.uniform(45.0, 65.0) # boiler explosion risk temp
        elif "gas" in device_id:
            val = base_val + random.uniform(80.0, 150.0) # toxic leak gas level
        else:
            val = base_val * 4.5
        drift = random.uniform(15.0, 35.0)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "CRITICAL",
            "event": "SENSOR_SPOOFING_DETECTED",
            "source_ip": "127.0.0.1",
            "message": f"Abrupt voltage shift on ADC input channel. Physical rate of change exceeded."
        })
    elif state == "signal_loss":
        val = 0.0
        battery = random.uniform(40.0, 60.0)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "ERROR",
            "event": "TX_TIMEOUT",
            "source_ip": "127.0.0.1",
            "message": "RF transceiver transmit timeout: packet acknowledgement lost"
        })
    else:
        # Normal
        val = base_val + random.uniform(-0.5, 0.5)
        battery -= random.uniform(0.001, 0.005)
        if random.random() < 0.05:
            logs.append({
                "timestamp": get_timestamp(),
                "log_level": "INFO",
                "event": "ADC_READING_STABLE",
                "source_ip": "127.0.0.1",
                "message": f"ADC sensor voltage stable. Calibrated value: {round(val, 2)} {val_unit}"
            })
            
    return {
        "device_id": device_id,
        "zone": zone,
        "device_type": "Sensor",
        "node_type": node_type,
        "timestamp": get_timestamp(),
        "metrics": {
            "value": round(val, 2),
            "value_unit": val_unit,
            "battery_level_pct": round(battery, 2),
            "drift_error_pct": round(drift, 2)
        },
        "logs": logs,
        "status": "active"
    }

def generate_actuator_payload(device, state):
    device_id = device["_id"]
    zone = device["zone"]
    node_type = device["node_type"]
    
    pos = 50.0 # position 0-100%
    curr = 1.8 # current load amps
    logs = []
    
    if state == "command_flooding":
        pos = random.choice([0.0, 100.0])
        curr = random.uniform(7.5, 12.0) # overload
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "ERROR",
            "event": "MOTOR_CURRENT_OVERLOAD",
            "source_ip": "127.0.0.1",
            "message": f"Actuator drive motor draw current: {round(curr, 2)}A (Limit: 5.0A). Actuation halted."
        })
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "WARN",
            "event": "VALVE_STUCK_LIMIT",
            "source_ip": "127.0.0.1",
            "message": "Limit switch status conflict: hardware torque limit reached before target position."
        })
    elif state == "unauthorized_actuation":
        pos = 100.0 # forced open
        curr = random.uniform(2.2, 3.5)
        logs.append({
            "timestamp": get_timestamp(),
            "log_level": "CRITICAL",
            "event": "UNAUTHORIZED_CMD",
            "source_ip": "185.220.101.45",
            "message": "Actuator write coil register commanded bypass logic. Source unauthorized."
        })
    else:
        # Normal
        pos = 50.0 + random.choice([-10.0, 0.0, 10.0]) if random.random() < 0.2 else pos
        curr = 1.5 + random.uniform(-0.2, 0.2)
        if random.random() < 0.05:
            logs.append({
                "timestamp": get_timestamp(),
                "log_level": "INFO",
                "event": "LIMIT_SWITCH_ACTIVATED",
                "source_ip": "192.168.10.11",
                "message": f"Feedback limit switch confirmed position: {pos}%"
            })
            
    return {
        "device_id": device_id,
        "zone": zone,
        "device_type": "Actuator",
        "node_type": node_type,
        "timestamp": get_timestamp(),
        "metrics": {
            "position_pct": round(pos, 2),
            "current_load_amps": round(curr, 2)
        },
        "logs": logs,
        "status": "active"
    }
