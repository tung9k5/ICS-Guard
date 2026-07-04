import json

class EdgeGatewayController:
    """
    Giả lập Chip Tổng (Edge Gateway / Central Controller)
    Quản lý logic cục bộ và thực thi quy trình điều khiển vòng lặp kín (Closed-loop Control).
    """
    def __init__(self, devices, device_anomaly_states):
        self.devices = devices
        self.device_anomaly_states = device_anomaly_states
        print("[Edge Gateway] Central Controller initialized.")

    def run_local_rules(self, generated_payloads):
        """
        Thực thi các logic điều khiển tự động hóa an toàn cục bộ (Closed-loop Control).
        Nếu phát hiện cảm biến vượt ngưỡng nguy hiểm, tự động ra lệnh điều chỉnh Actuator.
        """
        # Map payloads by ID for quick lookups
        payload_map = {p["device_id"]: p for p in generated_payloads}
        
        # RULE 1: An toàn lò hơi Zone-A (Boiler Temp > 80C -> Mở van xả valve-01, còi hú siren-01)
        for i in range(1, 6):
            temp_id = f"sensor-temp-0{i}"
            valve_id = f"actuator-valve-01" if i <= 3 else "actuator-valve-02"
            siren_id = "actuator-siren-01"
            
            if temp_id in payload_map:
                temp_val = payload_map[temp_id]["metrics"].get("value", 0)
                if temp_val > 80.0:
                    # Ghi nhận log phản ứng tự động cục bộ
                    print(f"⚠️ [Edge Gateway Rule] {temp_id} báo nhiệt độ cao ({temp_val} C) vượt ngưỡng! Tự động kích hoạt {valve_id} và {siren_id}.")
                    
                    # Cập nhật trực tiếp kết quả phản ứng vật lý trong payload của Actuator
                    if valve_id in payload_map:
                        payload_map[valve_id]["metrics"]["position_pct"] = 100.0 # Mở van tối đa
                        payload_map[valve_id]["metrics"]["current_load_amps"] = 3.2
                        payload_map[valve_id]["logs"].append({
                            "timestamp": payload_map[valve_id]["timestamp"],
                            "log_level": "WARN",
                            "event": "LIMIT_SWITCH_ACTIVATED",
                            "source_ip": "127.0.0.1",
                            "message": f"Rule Triggered: Auto-opened to 100% due to overtemperature alert on {temp_id}."
                        })
                    if siren_id in payload_map:
                        payload_map[siren_id]["metrics"]["position_pct"] = 100.0 # Bật còi báo động
                        payload_map[siren_id]["logs"].append({
                            "timestamp": payload_map[siren_id]["timestamp"],
                            "log_level": "WARN",
                            "event": "CMD_RECEIVED",
                            "source_ip": "127.0.0.1",
                            "message": f"Rule Triggered: Siren activated due to overtemperature alert on {temp_id}."
                        })

        # RULE 2: Rò rỉ khí gas Zone-C (Gas Level > 50ppm -> Bật quạt thông gió fan-01, còi báo alarm-01)
        for i in range(1, 6):
            gas_id = f"sensor-gas-0{i}"
            fan_id = "actuator-fan-01" if i <= 3 else "actuator-fan-02"
            alarm_id = "actuator-alarm-01" if i <= 3 else "actuator-alarm-02"
            
            if gas_id in payload_map:
                gas_val = payload_map[gas_id]["metrics"].get("value", 0)
                if gas_val > 50.0:
                    print(f"⚠️ [Edge Gateway Rule] {gas_id} báo khí gas rò rỉ ({gas_val} ppm) vượt ngưỡng! Tự động kích hoạt {fan_id} và {alarm_id}.")
                    
                    if fan_id in payload_map:
                        payload_map[fan_id]["metrics"]["position_pct"] = 100.0 # Bật quạt 100% công suất
                        payload_map[fan_id]["metrics"]["current_load_amps"] = 4.5
                        payload_map[fan_id]["logs"].append({
                            "timestamp": payload_map[fan_id]["timestamp"],
                            "log_level": "WARN",
                            "event": "LIMIT_SWITCH_ACTIVATED",
                            "source_ip": "127.0.0.1",
                            "message": f"Rule Triggered: Auto-started ventilation fan at 100% capacity due to high gas leak on {gas_id}."
                        })
                    if alarm_id in payload_map:
                        payload_map[alarm_id]["metrics"]["position_pct"] = 100.0 # Kích hoạt chuông báo động
                        payload_map[alarm_id]["logs"].append({
                            "timestamp": payload_map[alarm_id]["timestamp"],
                            "log_level": "WARN",
                            "event": "LIMIT_SWITCH_ACTIVATED",
                            "source_ip": "127.0.0.1",
                            "message": f"Rule Triggered: Emergency alarm bells activated due to high gas leak on {gas_id}."
                        })
                        
        return list(payload_map.values())
