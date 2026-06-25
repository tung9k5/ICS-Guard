# Hướng dẫn Công việc của Nguyễn Tùng Lâm (IoT & Infra Lead)
## Vai trò chính: Trưởng nhóm IoT & Hạ tầng (IoT & Infrastructure Lead)

Chào Lâm, dưới đây là tài liệu chi tiết hướng dẫn toàn bộ công việc, nhiệm vụ kỹ thuật và sản phẩm học thuật mà bạn cần hoàn thành và đóng gói cho đồ án tốt nghiệp **ICS-Guard** (2026).

Nhiệm vụ của bạn tập trung chính vào **Layer 1 (Thiết bị IoT & Giả lập)** và **Layer 2 (Thu thập & Ingestion Pipeline)** của kiến trúc hệ thống, đồng thời chịu trách nhiệm đóng gói toàn bộ dự án bằng Docker Compose và chuẩn bị hạ tầng triển khai.

---

## 1. Bản đồ Nhiệm vụ theo các Giai đoạn (Roadmap)

Dưới đây là tiến độ công việc của bạn xuyên suốt 5 giai đoạn của dự án (được đối chiếu từ `work_plan.md`):

### 📋 Giai đoạn 1: Phân tích & Thiết kế (Hoàn thành)
*   **Sơ đồ kiến trúc 4 lớp (Architecture Diagram)**: Vẽ chi tiết luồng đi của dữ liệu từ thiết bị IoT (Layer 1) -> Thu thập/Hàng đợi (Layer 2) -> Phân tích/Phát hiện (Layer 3) -> Trực quan hóa Dashboard (Layer 4).
*   **Thiết kế Schema/Buckets cho InfluxDB**: Xác định các trường dữ liệu đo lường (telemetry metrics) như CPU, nhiệt độ, lưu lượng mạng (`bytes_per_second`) cho các loại thiết bị (PLC, Smart Meter, Sensor).
*   **Nghiên cứu TLS 1.3**: Chuẩn bị phương án mã hóa kênh truyền MQTT qua Mosquitto Broker.

### 📋 Giai đoạn 2: Phát triển Chức năng Cốt lõi (Đang hoàn thiện)
*   **Cấu hình Mosquitto MQTT Broker & InfluxDB**: Khởi chạy thành công các dịch vụ lưu trữ Time-series và Broker.
*   **Phát triển Device Simulator (Python)**: Viết mã giả lập dữ liệu telemetry từ PLC, Smart Meter, và Sensor gửi định kỳ qua MQTT.
*   **Xây dựng REST API Ingestion & Data Validation**: Thiết lập endpoint để các tác nhân (Agent) bên ngoài gửi logs dạng REST. Thực hiện kiểm tra schema của payload để từ chối các request bất hợp lệ hoặc tấn công Replay.

### 📋 Giai đoạn 3: Tích hợp & Kiểm thử (Đang triển khai)
*   **Đóng gói hạ tầng qua `docker-compose.yml`**: Viết và tối ưu hóa file compose ở thư mục gốc để khởi chạy toàn bộ 9 microservices chỉ bằng 1 lệnh:
    ```bash
    docker-compose up -d --build
    ```
*   **Giả lập Traffic kiểm thử**: Chạy Simulator để tạo tải telemetry lớn gửi lên hệ thống nhằm kiểm tra độ ổn định của Ingestion Pipeline.

### 📋 Giai đoạn 4: Tính năng Nâng cao (Khuyến khích - Điểm Xuất Sắc)
*   **Triển khai hệ thống lên Cloud**: Nghiên cứu và đưa toàn bộ ứng dụng lên AWS, GCP hoặc Azure. Cấu hình HTTPS bảo mật bằng chứng chỉ SSL/TLS miễn phí (Let's Encrypt).

### 📋 Giai đoạn 5: Đóng gói và Chuẩn bị Bảo vệ
*   **Làm sạch Source Code**: Tổ chức lại thư mục `/iot` và `/infrastructure` ngăn nắp, xóa các file rác.
*   **Viết README & User Manual**: Viết tài liệu hướng dẫn vận hành chi tiết bằng Docker Compose ở file `README.md` gốc để giáo viên hướng dẫn dễ dàng chạy thử.

---

## 2. Chi tiết Kỹ thuật & Các lỗi cần xử lý trong Codebase hiện tại

Hiện tại, mã nguồn hạ tầng của chúng ta đã hoàn thành khoảng **90%**, tuy nhiên vẫn còn một số điểm Lâm cần lưu ý và tiếp tục hoàn thiện ngay:

### ⚠️ A. Kích hoạt Kịch bản Tấn công trong Simulator (`simulator.py`)
Trong file `simulator.py`, bạn đã lập trình sẵn hai hàm giả lập tấn công rất tốt:
1.  `trigger_periodic_traffic_spike()`: Giả lập đột biến lưu lượng (Traffic Spike) gấp 8 lần bình thường trên một PLC ngẫu nhiên.
2.  `trigger_periodic_brute_force()`: Giả lập SSH Brute Force bằng cách gửi liên tục các bản tin `AUTH_FAILED` qua REST Ingest.

**Vấn đề:** Trong hàm `main()`, các tác vụ này **chưa được kích hoạt**. Hiện tại Simulator chỉ chạy giả lập dữ liệu bình thường.
**Nhiệm vụ của Lâm:**
*   Chỉnh sửa hàm `main()` trong `simulator.py` để chạy đồng thời các kịch bản tấn công này dưới dạng các background tasks. Ví dụ:
    ```python
    async def main():
        device_sim_tasks = [simulate_device(d) for d in DEVICES]
        # Thêm các tác vụ giả lập tấn công định kỳ
        attack_tasks = [
            trigger_periodic_traffic_spike(),
            trigger_periodic_brute_force()
        ]
        await asyncio.gather(*device_sim_tasks, *attack_tasks)
    ```

### 🔐 B. Cấu hình TLS 1.3 cho Mosquitto Broker
*   **Hiện trạng**: File `mosquitto.conf` hiện chỉ đang lắng nghe ở cổng không bảo mật `1883` với cấu hình `allow_anonymous true`.
*   **Yêu cầu đồ án**: Phải truyền dữ liệu an toàn qua MQTT mã hóa TLS (cổng `8883`).
*   **Nhiệm vụ của Lâm**:
    1.  Tạo chứng chỉ SSL tự ký (Self-signed certificates) gồm: `ca.crt`, `server.crt`, `server.key` và lưu vào thư mục `infrastructure/mosquitto/certs/`.
    2.  Cập nhật file `mosquitto.conf` để mở port `8883` với các đường dẫn chứng chỉ tương ứng.
    3.  Cập nhật code của `simulator.py` sử dụng TLS khi kết nối tới Broker bằng cách gọi `client.tls_set(...)` trước khi gọi `client.connect()`.

### 🗄️ C. Retention Policy cho InfluxDB
*   Lâm cần thiết lập chính sách lưu trữ (Retention Policy) cho InfluxDB (ví dụ: tự động xóa dữ liệu telemetry cũ sau 7 ngày hoặc 30 ngày) để tránh làm đầy ổ đĩa của hệ thống giám sát. Cấu hình này có thể thực hiện thông qua script khởi tạo database hoặc cấu hình trực tiếp trong container InfluxDB.

---

## 3. Danh sách sản phẩm học thuật Lâm cần nộp (Deliverables)

Để đạt điểm tối đa trong phần Đánh giá & Thiết kế hạ tầng, Lâm cần chuẩn bị các tài liệu sau để đưa vào Báo cáo đồ án tốt nghiệp:

1.  **Sơ đồ Kiến trúc 4 lớp (Architecture Diagram)**: Thể hiện rõ các thành phần IoT -> Collection (MQTT, REST) -> Message Queue (RabbitMQ) -> Storage (InfluxDB, MongoDB) -> Presentation (React, WebSocket).
2.  **Sơ đồ Triển khai UML (Deployment Diagram)**: Mô tả cách các Docker Container liên kết với nhau, các cổng (ports) ánh xạ ra ngoài (3000, 8000, 8086, 1883, 15672, v.v.).
3.  **Tài liệu Hướng dẫn Vận hành (User Manual)**:
    *   Các bước chuẩn bị môi trường (cài đặt Docker, cấu hình file `.env`).
    *   Lệnh khởi động, tắt và xem logs của hệ thống.
    *   Cách truy cập vào trang quản trị cơ sở dữ liệu (Mongo Express/Compass) và hàng đợi (RabbitMQ Management).

Chúc Lâm hoàn thành xuất sắc nhiệm vụ của mình để cả nhóm đạt kết quả cao nhất!
