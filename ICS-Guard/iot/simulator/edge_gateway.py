import socket
import struct
import json
import logging

class EdgeGatewayController:
    """
    Giả lập Edge Gateway đóng vai trò Modbus TCP Client.
    Đọc dữ liệu từ Modbus Server (PLCs) qua TCP Socket, thực hiện logic Closed-loop Control,
    và ghi lại kết quả vào các thanh ghi Coil (Actuators).
    """
    def __init__(self, devices, device_anomaly_states, modbus_host="127.0.0.1", modbus_port=5020):
        self.devices = devices
        self.device_anomaly_states = device_anomaly_states
        self.modbus_host = modbus_host
        self.modbus_port = modbus_port
        logging.info(f"[Edge Gateway] Modbus Client Controller initialized to target {modbus_host}:{modbus_port}.")

    def _read_holding_registers(self, start_addr, quantity, unit_id=1):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect((self.modbus_host, self.modbus_port))
            
            # Read Holding Registers (Function Code 3)
            pdu = struct.pack(">BHH", 3, start_addr, quantity)
            header = struct.pack(">HHHB", 1, 0, len(pdu) + 1, unit_id)
            
            s.sendall(header + pdu)
            
            resp_header = s.recv(7)
            if len(resp_header) < 7:
                s.close()
                return None
                
            _, _, resp_len, _ = struct.unpack(">HHHB", resp_header)
            resp_pdu = s.recv(resp_len - 1)
            s.close()
            
            if len(resp_pdu) < 2 or resp_pdu[0] != 3:
                return None
                
            byte_count = resp_pdu[1]
            values = []
            for i in range(0, byte_count, 2):
                val = struct.unpack(">H", resp_pdu[2+i:4+i])[0]
                values.append(val)
            return values
        except Exception as e:
            # Fallback when Modbus server is not ready yet
            return None

    def _write_coil(self, coil_addr, val_bool, unit_id=1):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect((self.modbus_host, self.modbus_port))
            
            # Write Single Coil (Function Code 5)
            coil_val = 0xFF00 if val_bool else 0x0000
            pdu = struct.pack(">BHH", 5, coil_addr, coil_val)
            header = struct.pack(">HHHB", 1, 0, len(pdu) + 1, unit_id)
            
            s.sendall(header + pdu)
            
            resp_header = s.recv(7)
            if len(resp_header) < 7:
                s.close()
                return False
            _, _, resp_len, _ = struct.unpack(">HHHB", resp_header)
            resp_pdu = s.recv(resp_len - 1)
            s.close()
            return len(resp_pdu) >= 5 and resp_pdu[0] == 5
        except Exception:
            return False

    def _read_coils(self, start_addr, quantity, unit_id=1):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect((self.modbus_host, self.modbus_port))
            
            # Read Coils (Function Code 1)
            pdu = struct.pack(">BHH", 1, start_addr, quantity)
            header = struct.pack(">HHHB", 1, 0, len(pdu) + 1, unit_id)
            
            s.sendall(header + pdu)
            
            resp_header = s.recv(7)
            if len(resp_header) < 7:
                s.close()
                return None
            _, _, resp_len, _ = struct.unpack(">HHHB", resp_header)
            resp_pdu = s.recv(resp_len - 1)
            s.close()
            
            if len(resp_pdu) < 2 or resp_pdu[0] != 1:
                return None
                
            byte_count = resp_pdu[1]
            coil_bytes = resp_pdu[2:]
            
            states = []
            for i in range(quantity):
                byte_idx = i // 8
                bit_idx = i % 8
                val = bool((coil_bytes[byte_idx] >> bit_idx) & 1)
                states.append(val)
            return states
        except Exception:
            return None

    def run_local_rules(self, generated_payloads):
        """
        Đọc dữ liệu cảm biến thực tế từ các thanh ghi Modbus Server,
        sau đó đưa ra các phản ứng an toàn closed-loop qua ghi đè thanh ghi Coil Modbus.
        Cuối cùng đồng bộ ngược lại payloads để đẩy lên Backend SOC Dashboard.
        """
        payload_map = {p["device_id"]: p for p in generated_payloads}

        # 1. Đồng bộ dữ liệu cảm biến sang Modbus Server (đóng vai trò PLC đo lường)
        # Giả sử:
        # sensor-temp-01...05 ghi vào Holding Registers 10...14
        # sensor-gas-01...05 ghi vào Holding Registers 20...24
        
        # Đọc dữ liệu từ Modbus Server (nếu có dữ liệu do mô phỏng vừa sinh)
        # Ta cập nhật các giá trị cảm biến của Simulator vào thanh ghi Modbus để thể hiện PLC đang giữ số liệu
        for i in range(1, 6):
            temp_id = f"sensor-temp-0{i}"
            if temp_id in payload_map:
                temp_val = int(payload_map[temp_id]["metrics"].get("value", 0) * 100)
                # Thực hiện ghi tạm thời vào holding register bằng một kết nối socket Write Register (FC6)
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(1.0)
                    s.connect((self.modbus_host, self.modbus_port))
                    pdu = struct.pack(">BHH", 6, 10 + (i - 1), temp_val)
                    header = struct.pack(">HHHB", 1, 0, len(pdu) + 1, 1)
                    s.sendall(header + pdu)
                    s.recv(1024) # Đợi phản hồi
                    s.close()
                except Exception:
                    pass

            gas_id = f"sensor-gas-0{i}"
            if gas_id in payload_map:
                gas_val = int(payload_map[gas_id]["metrics"].get("value", 0) * 100)
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(1.0)
                    s.connect((self.modbus_host, self.modbus_port))
                    pdu = struct.pack(">BHH", 6, 20 + (i - 1), gas_val)
                    header = struct.pack(">HHHB", 1, 0, len(pdu) + 1, 1)
                    s.sendall(header + pdu)
                    s.recv(1024)
                    s.close()
                except Exception:
                    pass

        # 2. Đọc ngược lại dữ liệu cảm biến bằng Modbus Client (Edge Gateway thu thập)
        temp_regs = self._read_holding_registers(10, 5) # Đọc từ thanh ghi 10 (quantity = 5)
        gas_regs = self._read_holding_registers(20, 5)  # Đọc từ thanh ghi 20 (quantity = 5)

        # 3. RULE 1: An toàn lò hơi Zone-A (Nhiệt độ nồi hơi > 80C -> Mở van xả, còi báo động)
        if temp_regs:
            for idx, temp_val_x100 in enumerate(temp_regs):
                temp_val = temp_val_x100 / 100.0
                temp_id = f"sensor-temp-0{idx + 1}"
                valve_id = "actuator-valve-01" if idx < 3 else "actuator-valve-02"
                siren_id = "actuator-siren-01"
                
                # Coil Addresses:
                # actuator-valve-01 -> Coil 30
                # actuator-valve-02 -> Coil 31
                # actuator-siren-01 -> Coil 32
                valve_coil = 30 if idx < 3 else 31
                siren_coil = 32

                if temp_val > 80.0:
                    logging.warning(f"⚠️ [Modbus Gateway Client] {temp_id} nhiệt độ cao ({temp_val} C). Gửi lệnh Modbus Write Coil {valve_coil} & {siren_coil} = ON!")
                    self._write_coil(valve_coil, True)
                    self._write_coil(siren_coil, True)
                
                # Đồng bộ trạng thái coil vào payload đẩy đi
                # Đọc trạng thái Coils từ Server
                valve_state = self._read_coils(valve_coil, 1)
                siren_state = self._read_coils(siren_coil, 1)
                
                if valve_state and valve_state[0]:
                    if valve_id in payload_map:
                        payload_map[valve_id]["metrics"]["position_pct"] = 100.0
                        payload_map[valve_id]["metrics"]["current_load_amps"] = 3.2
                        if not any(l["event"] == "LIMIT_SWITCH_ACTIVATED" for l in payload_map[valve_id]["logs"]):
                            payload_map[valve_id]["logs"].append({
                                "timestamp": payload_map[valve_id]["timestamp"],
                                "log_level": "WARN",
                                "event": "LIMIT_SWITCH_ACTIVATED",
                                "source_ip": "127.0.0.1",
                                "message": f"Modbus TCP Event: Auto-opened due to high temperature ({temp_val} C) read on register {10 + idx}."
                            })
                if siren_state and siren_state[0]:
                    if siren_id in payload_map:
                        payload_map[siren_id]["metrics"]["position_pct"] = 100.0
                        if not any(l["event"] == "CMD_RECEIVED" for l in payload_map[siren_id]["logs"]):
                            payload_map[siren_id]["logs"].append({
                                "timestamp": payload_map[siren_id]["timestamp"],
                                "log_level": "WARN",
                                "event": "CMD_RECEIVED",
                                "source_ip": "127.0.0.1",
                                "message": f"Modbus TCP Event: Siren triggered by gateway client."
                            })

        # 4. RULE 2: Rò rỉ khí gas Zone-C (Mức khí gas > 50ppm -> Bật quạt thông gió, bật chuông cảnh báo)
        if gas_regs:
            for idx, gas_val_x100 in enumerate(gas_regs):
                gas_val = gas_val_x100 / 100.0
                gas_id = f"sensor-gas-0{idx + 1}"
                fan_id = "actuator-fan-01" if idx < 3 else "actuator-fan-02"
                alarm_id = "actuator-alarm-01" if idx < 3 else "actuator-alarm-02"
                
                # Coil Addresses:
                # actuator-fan-01 -> Coil 40
                # actuator-fan-02 -> Coil 41
                # actuator-alarm-01 -> Coil 42
                # actuator-alarm-02 -> Coil 43
                fan_coil = 40 if idx < 3 else 41
                alarm_coil = 42 if idx < 3 else 43

                if gas_val > 50.0:
                    logging.warning(f"⚠️ [Modbus Gateway Client] {gas_id} rò rỉ khí gas ({gas_val} ppm). Gửi lệnh Modbus Write Coil {fan_coil} & {alarm_coil} = ON!")
                    self._write_coil(fan_coil, True)
                    self._write_coil(alarm_coil, True)

                # Đồng bộ trạng thái coil
                fan_state = self._read_coils(fan_coil, 1)
                alarm_state = self._read_coils(alarm_coil, 1)

                if fan_state and fan_state[0]:
                    if fan_id in payload_map:
                        payload_map[fan_id]["metrics"]["position_pct"] = 100.0
                        payload_map[fan_id]["metrics"]["current_load_amps"] = 4.5
                        if not any(l["event"] == "LIMIT_SWITCH_ACTIVATED" for l in payload_map[fan_id]["logs"]):
                            payload_map[fan_id]["logs"].append({
                                "timestamp": payload_map[fan_id]["timestamp"],
                                "log_level": "WARN",
                                "event": "LIMIT_SWITCH_ACTIVATED",
                                "source_ip": "127.0.0.1",
                                "message": f"Modbus TCP Event: Ventilation fan started due to gas leak ({gas_val} ppm) read on register {20 + idx}."
                            })
                if alarm_state and alarm_state[0]:
                    if alarm_id in payload_map:
                        payload_map[alarm_id]["metrics"]["position_pct"] = 100.0
                        if not any(l["event"] == "LIMIT_SWITCH_ACTIVATED" for l in payload_map[alarm_id]["logs"]):
                            payload_map[alarm_id]["logs"].append({
                                "timestamp": payload_map[alarm_id]["timestamp"],
                                "log_level": "WARN",
                                "event": "LIMIT_SWITCH_ACTIVATED",
                                "source_ip": "127.0.0.1",
                                "message": f"Modbus TCP Event: Alarm bells activated due to gas leak."
                            })

        return list(payload_map.values())
