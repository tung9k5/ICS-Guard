# ICS-Guard: Industrial Cyber Security System

Dự án Hệ thống Giám sát và Cảnh báo An toàn Không gian Mạng cho IoT/ICS. 
*(Phiên bản giản lược thành phần AI để tối ưu tài nguyên phát triển).*

## 🌟 Tổng quan dự án (Architecture)

Hệ thống bao gồm các thành phần chính (Kiến trúc 4 lớp):
1. **IoT Protocol**: Sử dụng MQTT (Eclipse Mosquitto) cho các thiết bị.
2. **Collection/Queue**: RabbitMQ (Message Queue) để tiếp nhận sự kiện và InfluxDB lưu Telemetry.
3. **Analysis/Backend**: FastAPI/NestJS xử lý các sự kiện mạng, kiểm tra luật và lưu trữ dữ liệu sự kiện/incident vào MongoDB.
4. **Dashboard**: ReactJS + D3.js cung cấp biểu đồ và giao diện trực quan thời gian thực.

## 🤝 Quy trình phát triển (Git & GitHub Workflow)

Tất cả các thành viên tham gia phát triển dự án cần tuân thủ quy trình phân nhánh, commit và Pull Request chuẩn. Chi tiết quy trình được viết rõ tại tài liệu:
👉 **[Quy trình làm việc với Git & GitHub](../GITHUB_WORKFLOW.md)** (nằm ở thư mục gốc của dự án).

## 🚀 Hướng dẫn cài đặt môi trường

### 1. Yêu cầu hệ thống
- Docker & Docker Compose
- Git
- Node.js (nếu phát triển Frontend)
- Python 3.9+ / Node.js (nếu phát triển Backend)

### 2. Cài đặt

1. **Clone dự án**
   ```bash
   git clone <repo_url>
   cd ICS-Guard
   ```

2. **Cấu hình môi trường**
   - Copy file `.env.example` thành `.env` và cập nhật các biến môi trường:
   ```bash
   cp .env.example .env
   ```

3. **Khởi động hệ thống bằng Docker Compose**
   - Chạy toàn bộ stack dự án chỉ với một lệnh duy nhất:
   ```bash
   docker-compose up -d --build

   - nếu chạy docker-compose up -d --build thì:
   - tự cài requirements.txt trong backend
   - tự cài node modules trong frontend
   - chỉ chạy lại docker khi frontend và backend cài thêm thư viên mới.
   ```

4. **Truy cập các dịch vụ**
   - Frontend Dashboard: `http://localhost:5173`
   - Backend API: `http://localhost:8000/docs` (Swagger UI)
   - RabbitMQ Management: `http://localhost:15672`
   - MongoDB: Truy cập qua cổng `27017` bằng MongoDB Compass.

## 📁 Cấu trúc thư mục
- `/frontend`: Mã nguồn giao diện (ReactJS).
- `/backend`: Mã nguồn API (FastAPI/NestJS).
- `/iot`: Code giả lập thiết bị IoT (Simulator).
- `/infrastructure`: Cấu hình Docker, Nginx, Mosquitto, database scripts.
- `/docs`: Tài liệu thiết kế UML, báo cáo.
- `/tests`: Các kịch bản kiểm thử (unit test, integration test, bảo mật).

## 🛠 Công nghệ sử dụng
- **Backend API**: FastAPI / NestJS
- **Frontend Dashboard**: ReactJS, D3.js, Recharts
- **Database**: MongoDB (Event DB), InfluxDB (Time-series)
- **Message Broker & IoT**: RabbitMQ, MQTT (Mosquitto)
- **Deployment**: Docker + Docker Compose, Nginx
