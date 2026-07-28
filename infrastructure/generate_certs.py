import os
import subprocess
import shutil

# Thư mục chứa certs tạm thời và đầu ra
INFRA_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.dirname(INFRA_DIR)
CERT_OUT_DIR = os.path.join(INFRA_DIR, "generated_certs")

def run_cmd(cmd):
    # Sử dụng đường dẫn openssl của Git trên Windows nếu có
    if cmd[0] == "openssl" and os.name == "nt":
        git_openssl = "C:\\Program Files\\Git\\usr\\bin\\openssl.exe"
        if os.path.exists(git_openssl):
            cmd[0] = git_openssl
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(f"Error executing command: {result.stderr}")
        raise Exception(result.stderr)
    return result.stdout

def main():
    if os.path.exists(CERT_OUT_DIR):
        shutil.rmtree(CERT_OUT_DIR)
    os.makedirs(CERT_OUT_DIR, exist_ok=True)

    print("=== 1. GENERATE CERTIFICATE AUTHORITY (CA) ===")
    ca_key = os.path.join(CERT_OUT_DIR, "ca.key")
    ca_crt = os.path.join(CERT_OUT_DIR, "ca.crt")
    
    run_cmd(["openssl", "genrsa", "-out", ca_key, "2048"])
    run_cmd([
        "openssl", "req", "-x509", "-new", "-nodes", "-key", ca_key,
        "-sha256", "-days", "3650", "-out", ca_crt,
        "-subj", "/CN=ICS-Guard-Root-CA/O=ICS-Guard/C=VN"
    ])

    # Thiết lập cấu hình SAN (Subject Alternative Name) cho các dịch vụ
    def generate_service_cert(name, dns_alt_names):
        print(f"\n=== GENERATE SERVICE CERTIFICATE: {name} ===")
        key_path = os.path.join(CERT_OUT_DIR, f"{name}.key")
        csr_path = os.path.join(CERT_OUT_DIR, f"{name}.csr")
        crt_path = os.path.join(CERT_OUT_DIR, f"{name}.crt")
        ext_path = os.path.join(CERT_OUT_DIR, f"{name}.ext")

        # Cấu hình SAN extension
        san_lines = [
            "authorityKeyIdentifier=keyid,issuer",
            "basicConstraints=CA:FALSE",
            "keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment",
            "subjectAltName = @alt_names",
            "[alt_names]"
        ]
        for idx, dns in enumerate(dns_alt_names):
            san_lines.append(f"DNS.{idx+1} = {dns}")
            
        with open(ext_path, "w") as f:
            f.write("\n".join(san_lines) + "\n")

        # Generate Private Key
        run_cmd(["openssl", "genrsa", "-out", key_path, "2048"])
        
        # Generate CSR
        run_cmd([
            "openssl", "req", "-new", "-key", key_path, "-out", csr_path,
            "-subj", f"/CN={name}/O=ICS-Guard/C=VN"
        ])
        
        # Sign CSR with CA
        run_cmd([
            "openssl", "x509", "-req", "-in", csr_path, "-CA", ca_crt, "-CAkey", ca_key,
            "-CAcreateserial", "-out", crt_path, "-days", "1825", "-sha256", "-extfile", ext_path
        ])
        
        # Remove CSR and Ext config
        os.remove(csr_path)
        os.remove(ext_path)

    # 2. Tạo chứng chỉ cho Mosquitto MQTT
    generate_service_cert("mosquitto", ["mosquitto", "localhost", "127.0.0.1"])

    # 3. Tạo chứng chỉ cho MongoDB
    generate_service_cert("mongodb", ["mongodb", "localhost", "127.0.0.1"])
    # MongoDB yêu cầu định dạng gộp PEM (.pem) của crt + key
    mongodb_pem = os.path.join(CERT_OUT_DIR, "mongodb.pem")
    with open(mongodb_pem, "w") as out:
        with open(os.path.join(CERT_OUT_DIR, "mongodb.crt")) as crt:
            out.write(crt.read())
        with open(os.path.join(CERT_OUT_DIR, "mongodb.key")) as key:
            out.write(key.read())

    # 4. Tạo chứng chỉ cho Redis
    generate_service_cert("redis", ["redis", "localhost", "127.0.0.1"])

    # 5. Tạo chứng chỉ cho AI Engine (FastAPI)
    generate_service_cert("ai-engine", ["ai-engine", "localhost", "127.0.0.1"])

    print("\n=== 2. COPY CERTIFICATES TO SERVICE DIRECTORIES ===")
    
    def copy_file(src, dst_dir, new_name=None):
        os.makedirs(dst_dir, exist_ok=True)
        name = new_name if new_name else os.path.basename(src)
        dst_path = os.path.join(dst_dir, name)
        shutil.copy2(src, dst_path)
        print(f"Copied {os.path.basename(src)} -> {dst_path}")

    # Mosquitto
    mosq_certs_dir = os.path.join(INFRA_DIR, "mosquitto", "config", "certs")
    copy_file(ca_crt, mosq_certs_dir)
    copy_file(os.path.join(CERT_OUT_DIR, "mosquitto.crt"), mosq_certs_dir, "server.crt")
    copy_file(os.path.join(CERT_OUT_DIR, "mosquitto.key"), mosq_certs_dir, "server.key")

    # MongoDB
    mongo_certs_dir = os.path.join(INFRA_DIR, "mongodb", "certs")
    copy_file(ca_crt, mongo_certs_dir)
    copy_file(mongodb_pem, mongo_certs_dir)

    # Redis
    redis_certs_dir = os.path.join(INFRA_DIR, "redis", "certs")
    copy_file(ca_crt, redis_certs_dir)
    copy_file(os.path.join(CERT_OUT_DIR, "redis.crt"), redis_certs_dir)
    copy_file(os.path.join(CERT_OUT_DIR, "redis.key"), redis_certs_dir)

    # Backend
    backend_certs_dir = os.path.join(WORKSPACE_DIR, "backend", "src", "certs")
    copy_file(ca_crt, backend_certs_dir)
    copy_file(os.path.join(CERT_OUT_DIR, "mongodb.crt"), backend_certs_dir)
    copy_file(os.path.join(CERT_OUT_DIR, "mongodb.key"), backend_certs_dir)

    # AI Engine
    ai_certs_dir = os.path.join(WORKSPACE_DIR, "ai-engine", "app", "certs")
    copy_file(ca_crt, ai_certs_dir)
    copy_file(os.path.join(CERT_OUT_DIR, "ai-engine.crt"), ai_certs_dir)
    copy_file(os.path.join(CERT_OUT_DIR, "ai-engine.key"), ai_certs_dir)

    # IoT Simulator
    iot_certs_dir = os.path.join(WORKSPACE_DIR, "iot", "certs")
    copy_file(ca_crt, iot_certs_dir)

    # Dọn dẹp thư mục tạm
    shutil.rmtree(CERT_OUT_DIR)
    
    # Xóa file serial nếu có
    serial_file = os.path.join(INFRA_DIR, "ca.srl")
    if os.path.exists(serial_file):
        os.remove(serial_file)

    print("\n[OK] Certificates generated and distributed successfully for Zero Trust.")

if __name__ == "__main__":
    main()