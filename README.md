ICS-Guard: Industrial Cyber Security System
1. Giới thiệu

ICS-Guard là hệ thống giám sát an toàn mạng cho IoT/ICS, gồm các thành phần:

Frontend: ReactJS Dashboard
Backend: FastAPI
Database: MongoDB, InfluxDB
Message Broker: RabbitMQ, MQTT (Mosquitto)
Deployment: Docker Compose
2. Cài đặt môi trường

Cài đặt các phần mềm sau trước khi chạy dự án:

Phần mềm	Phiên bản	Tải về
Docker Desktop	Mới nhất	https://www.docker.com/products/docker-desktop/
Git	Mới nhất	https://git-scm.com/downloads
Python	3.11+	https://www.python.org/downloads/
Node.js	20 LTS+	https://nodejs.org/
MongoDB Compass (khuyến nghị)	Mới nhất	https://www.mongodb.com/products/tools/compass

Lưu ý:

Khi cài Python, hãy chọn Add Python to PATH.
Không cần cài MongoDB Server, vì MongoDB sẽ được chạy bằng Docker.

Kiểm tra cài đặt:

docker --version
docker compose version
git --version
python --version
node -v
npm -v
3. Clone dự án
git clone <repo_url>
cd ICS-Guard
4. Cấu hình môi trường

Tạo file .env:

Windows

copy .env.example .env

Linux/macOS

cp .env.example .env
5. Chạy dự án
docker compose up -d --build

Docker sẽ tự động:

Build Backend và Frontend
Cài requirements.txt
Cài node_modules
Khởi tạo MongoDB, RabbitMQ, Mosquitto và InfluxDB
6. Kiểm tra
docker ps

Các container cần chạy:

frontend
backend
mongodb
rabbitmq
mosquitto
influxdb
7. Truy cập
Dịch vụ	Địa chỉ
Frontend	http://localhost:3000
Backend API	http://localhost:8000
Swagger	http://localhost:8000/docs
RabbitMQ	http://localhost:15672
MongoDB	localhost:27017

MongoDB Compass

Connection String:

mongodb://admin:123456@localhost:27017/
