import socket
import threading
import struct
import logging

class ModbusTCPServer:
    def __init__(self, host="0.0.0.0", port=5020, allowed_ips=None):
        self.host = host
        self.port = port
        # Default allow localhost only for security
        self.allowed_ips = allowed_ips or ["127.0.0.1"]
        self.running = False
        self.lock = threading.Lock()
        
        # Shared memory for Modbus registers
        # Coils: 0 to 99 (Boolean: False/True)
        self.coils = {i: False for i in range(100)}
        # Holding Registers: 0 to 99 (Uint16: 0 to 65535)
        self.holding_registers = {i: 0 for i in range(100)}
        
        self.server_socket = None

    def start(self):
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(5)
        self.running = True
        logging.info(f"[Modbus Server] Listening on {self.host}:{self.port}... Allowed IPs: {self.allowed_ips}")
        
        threading.Thread(target=self._accept_loop, daemon=True).start()

    def _accept_loop(self):
        while self.running:
            try:
                client_socket, client_addr = self.server_socket.accept()
                client_ip = client_addr[0]
                
                # IP Whitelisting Check
                if client_ip not in self.allowed_ips:
                    logging.warning(f"🛡️ [Modbus Security] Blocked connection from unauthorized IP: {client_ip}")
                    client_socket.close()
                    continue
                    
                threading.Thread(target=self._handle_client, args=(client_socket,), daemon=True).start()
            except Exception as e:
                if self.running:
                    logging.error(f"[Modbus Server] Error accepting client: {e}")
                break

    def _handle_client(self, client_socket):
        while self.running:
            try:
                # Read MBAP header (7 bytes)
                header = client_socket.recv(7)
                if not header or len(header) < 7:
                    break
                
                transaction_id, protocol_id, length, unit_id = struct.unpack(">HHHB", header)
                
                # Read the PDU (length - 1 bytes)
                pdu_len = length - 1
                pdu = client_socket.recv(pdu_len)
                if not pdu or len(pdu) < pdu_len:
                    break
                
                function_code = pdu[0]
                response_pdu = bytearray()
                
                if function_code == 3: # Read Holding Registers
                    start_addr, quantity = struct.unpack(">HH", pdu[1:5])
                    response_pdu.append(function_code)
                    byte_count = quantity * 2
                    response_pdu.append(byte_count)
                    
                    with self.lock:
                        for i in range(quantity):
                            addr = start_addr + i
                            val = self.holding_registers.get(addr, 0)
                            response_pdu.extend(struct.pack(">H", val))
                            
                elif function_code == 5: # Write Single Coil
                    coil_addr, coil_val = struct.unpack(">HH", pdu[1:5])
                    state = coil_val == 0xFF00
                    with self.lock:
                        self.coils[coil_addr] = state
                    logging.info(f"🔌 [Modbus Server] Write Coil {coil_addr} = {state}")
                    # Echo back request
                    response_pdu.extend(pdu)
                    
                elif function_code == 6: # Write Single Register
                    reg_addr, reg_val = struct.unpack(">HH", pdu[1:5])
                    with self.lock:
                        self.holding_registers[reg_addr] = reg_val
                    logging.info(f"⚙️ [Modbus Server] Write Register {reg_addr} = {reg_val}")
                    # Echo back request
                    response_pdu.extend(pdu)
                else:
                    # Exception response (Unsupported Function Code)
                    response_pdu.append(function_code + 0x80)
                    response_pdu.append(1) # Exception Code: Illegal Function
                    
                # Build MBAP header for response
                resp_length = len(response_pdu) + 1 # +1 for Unit ID
                resp_header = struct.pack(">HHHB", transaction_id, protocol_id, resp_length, unit_id)
                
                client_socket.sendall(resp_header + response_pdu)
                
            except Exception as e:
                logging.error(f"[Modbus Server] Client handling error: {e}")
                break
        client_socket.close()

    def set_register(self, address, value):
        with self.lock:
            self.holding_registers[address] = int(value)

    def get_register(self, address):
        with self.lock:
            return self.holding_registers.get(address, 0)

    def set_coil(self, address, value):
        with self.lock:
            self.coils[address] = bool(value)

    def get_coil(self, address):
        with self.lock:
            return self.coils.get(address, False)
            
    def stop(self):
        self.running = False
        if self.server_socket:
            self.server_socket.close()
