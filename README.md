# ICS-Guard: Industrial Cyber Security System

## 1. Giới thiệu

ICS-Guard là hệ thống giám sát an toàn mạng cho IoT/ICS, gồm các thành phần:

- **Frontend**: ReactJS Dashboard
- **Backend**: FastAPI
- **Database**: MongoDB, InfluxDB
- **Message Broker**: RabbitMQ, MQTT (Mosquitto)
- **Deployment**: Docker Compose

## 2. Cài đặt môi trường

Cài đặt các phần mềm sau trước khi chạy dự án:

| Phần mềm | Phiên bản | Tải về |
| :--- | :--- | :--- |
| **Docker Desktop** | Mới nhất | [Tại đây](https://www.docker.com/products/docker-desktop/) |
| **Git** | Mới nhất | [Tại đây](https://git-scm.com/downloads) |
| **Python** | 3.11+ | [Tại đây](https://www.python.org/downloads/) |
| **Node.js** | 20 LTS+ | [Tại đây](https://nodejs.org/) |
| **MongoDB Compass** (Khuyến nghị)| Mới nhất | [Tại đây](https://www.mongodb.com/products/tools/compass) |

> **💡 Lưu ý:**
> - Khi cài Python, hãy chọn **Add Python to PATH**.

**Kiểm tra cài đặt:**

```bash
docker --version
docker compose version
git --version
python --version
node -v
npm -v
```

## 3. Clone dự án

```bash
git clone <repo_url>
cd ICS-Guard
```

## 4. Cấu hình môi trường

Tạo file `.env` từ file mẫu:

**Windows**
```cmd
copy .env.example .env
```

## 5. Chạy dự án

```bash
docker compose up -d --build
```

Docker sẽ tự động:
- Build Backend và Frontend
- Cài `requirements.txt` cho Backend
- Cài `node_modules` cho Frontend
- Khởi tạo MongoDB, RabbitMQ, Mosquitto và InfluxDB
- Code tự động update vào Docker khi có thay đổi (Hot-reload).

> **💡 Lưu ý:**
> - Chỉ chạy lại lệnh `docker compose up -d --build` khi bạn có cài đặt thêm thư viện mới vào `requirements.txt` hoặc `package.json`. Các trường hợp sửa code thông thường không cần chạy lại lệnh này.

## 6. Kiểm tra

```bash
docker ps
```

Các container cần chạy bao gồm: `frontend`, `backend`, `mongodb`, `rabbitmq`, `mosquitto`, `influxdb`.

## 7. Truy cập

| Dịch vụ | Địa chỉ |
| :--- | :--- |
| **Frontend** | [http://localhost:3000](http://localhost:3000) |
| **Backend API** | [http://localhost:8000](http://localhost:8000) |
| **Swagger** | [http://localhost:8000/docs](http://localhost:8000/docs) |
| **RabbitMQ** | [http://localhost:15672](http://localhost:15672) |
| **MongoDB** | `localhost:27017` |

### MongoDB Compass

**Connection String:**
- Mở ứng dụng MongoDB Compass, dán đường dẫn dưới đây vào thanh kết nối (URI) để truy cập Database:
```text
mongodb://admin:123456@localhost:27017/
```
