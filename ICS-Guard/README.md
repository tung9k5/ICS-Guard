# ICS-Guard: Industrial Cyber Security System

Dự án Hệ thống Giám sát và Cảnh báo An toàn Không gian Mạng cho các hệ thống công nghiệp IoT/ICS (Industrial Control Systems).

---

## 🌟 SƠ ĐỒ TRIỂN KHAI HẠ TẦNG UML (DEPLOYMENT DIAGRAM)

Dưới đây là sơ đồ kiến trúc triển khai thực tế của hệ thống dựa trên mạng Docker Bridge, mô tả các container dịch vụ và các cổng giao tiếp:

```mermaid
graph TD
    subgraph Host["Máy chủ vật lý (Host OS)"]
        UserBrowser["Trình duyệt người dùng"]
        MongoCompass["MongoDB Compass (Quản trị DB)"]
    end

    subgraph Docker["Hệ sinh thái Docker Compose"]
        Nginx["Nginx Reverse Proxy (Container)<br>Cổng: 80 / 443"]
        Frontend["Frontend SOC Dashboard (React)<br>Cổng: 3000"]
        Backend["Backend Security API (Node.js)<br>Cổng: 8000"]
        
        MongoDB["MongoDB Database (Event DB)<br>Cổng: 27017"]
        InfluxDB["InfluxDB (Time-series Telemetry)<br>Cổng: 8086"]
        Mosquitto["Mosquitto MQTT Broker (TLS 1.3)<br>Cổng: 8883 (TLS) / 1883"]
        RabbitMQ["RabbitMQ Message Queue<br>Cổng: 5672 / 15672 (Admin)"]
        
        AIEngine["AI Assistant (FastAPI/Llama)<br>Cổng: 5000"]
        Simulator["Device Simulator (Python)<br>(Chạy ngầm trong network)"]
    end

    %% Kết nối từ ngoài vào
    UserBrowser -->|HTTP/HTTPS| Nginx
    UserBrowser -->|Direct Access| Frontend
    MongoCompass -->|Connect| MongoDB

    %% Định tuyến Nginx
    Nginx -->|Proxy /| Frontend
    Nginx -->|Proxy /api| Backend

    %% Kết nối trong Docker Network
    Simulator -->|MQTTS / Cổng 8883| Mosquitto
    Simulator -->|REST API Ingest| Backend
    
    Backend -->|Read/Write| MongoDB
    Backend -->|Write Telemetry| InfluxDB
    Backend -->|AMQP Queue| RabbitMQ
    Backend -->|Subscribe Telemetry| Mosquitto
    Backend -->|Analyze Logs| AIEngine
```

---

## 🤝 Quy trình phát triển (Git & GitHub Workflow)

Tất cả các thành viên tham gia phát triển dự án cần tuân thủ quy trình phân nhánh, commit và Pull Request chuẩn. Chi tiết quy trình được viết rõ tại tài liệu:
👉 **[Quy trình làm việc với Git & GitHub (docs/GITHUB_WORKFLOW.md)](docs/GITHUB_WORKFLOW.md)**.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH CHI TIẾT (USER MANUAL)

### 1. Yêu cầu hệ thống
Trước khi chạy dự án, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:
*   **Docker & Docker Compose** (Bắt buộc)
*   **Git** (Để đồng bộ mã nguồn)
*   **MongoDB Compass** (Khuyến nghị dùng để giám sát dữ liệu)

### 2. Các bước khởi động nhanh (Quick Start)

#### Bước 2.1: Clone dự án và tạo file môi trường `.env`
```bash
# Clone dự án
git clone <repo_url>
cd ICS-Guard

# Tạo tệp cấu hình môi trường từ tệp mẫu
cp .env.example .env
```

#### Bước 2.2: Khởi chạy các container bằng Docker Compose
```bash
docker-compose up -d --build
```
Lệnh này sẽ tự động:
*   Tải về và khởi tạo 9 container dịch vụ.
*   Cài đặt các thư viện phụ thuộc (`requirements.txt` cho Python, `node_modules` cho Frontend/Backend).
*   Khởi chạy cấu hình mạng Docker Bridge dùng chung.

#### Bước 2.3: Khởi tạo cơ sở dữ liệu (Database Seeding)
Hệ thống hỗ trợ nạp dữ liệu mẫu tự động qua API khi khởi chạy lần đầu. Để chủ động cấu hình đầy đủ Index và dữ liệu khởi tạo, bạn có thể thực hiện chạy thủ công trong container:
```bash
# Khởi tạo dữ liệu MongoDB (Users, Devices, Rules)
docker-compose exec backend node src/database/seed_local.js

# Khởi tạo dữ liệu InfluxDB & Retention Policy 14 ngày
docker-compose exec backend node src/database/seed_influx.js
```

---

### 3. KIỂM TRA BẢO MẬT & KÊNH TRUYỀN TLS 1.3

Kênh truyền MQTT giữa thiết bị giả lập và hệ thống được mã hóa an toàn qua giao thức TLS 1.3 (Cổng `8883`). Để xác thực:

1.  **Xem log của container Simulator:**
    ```bash
    docker-compose logs -f simulator
    ```
    Nếu kết nối thành công, bạn sẽ thấy log in ra dạng:
    ```text
    [Simulator] Enabling TLS using CA certificate at: /app/certs/ca.crt
    [Simulator] Connected to MQTT Broker successfully.
    ```
2.  **Xem log kết nối TLS của Broker Mosquitto:**
    ```bash
    docker-compose logs -f mosquitto
    ```
    Màn hình log sẽ xuất hiện thông tin chấp nhận kết nối TLS 1.3:
    ```text
    New connection from simulator on port 8883.
    OpenSSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
    ```

---

### 4. ĐỊA CHỈ TRUY CẬP CÁC DỊCH VỤ

| Dịch vụ | Địa chỉ truy cập | Tài khoản / Cấu hình mặc định |
| :--- | :--- | :--- |
| **SOC Dashboard (Frontend)** | [http://localhost:3000](http://localhost:3000) | Giao diện giám sát thời gian thực SOC |
| **Backend API Swagger** | [http://localhost:8000/docs](http://localhost:8000/docs) | Tài liệu kiểm thử API tự động |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | User/Pass: `guest` / `guest` |
| **MongoDB Express** | `localhost:27017` | Kết nối qua Mongo Compass: `mongodb://admin:123456@localhost:27017/` |

---

## 📁 Cấu trúc thư mục dự án

*   `/frontend`: Mã nguồn giao diện giám sát SOC (ReactJS + Vite).
*   `/backend`: API dịch vụ và phân tích sự cố (NodeJS Express).
*   `/iot/simulator`: Bộ giả lập thiết bị công nghiệp (PLC, Sensor, Smart Meter) và kịch bản tấn công.
*   `/infrastructure`: Tệp cấu hình các container (Nginx, Mosquitto TLS, MongoDB init).
*   `/docs`: Chứa toàn bộ báo cáo, hướng dẫn công việc và kế hoạch KPI.
*   `/tests`: Thư mục chứa các kịch bản kiểm thử bảo mật và tích hợp.
