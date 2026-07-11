# Đánh Giá Hiện Trạng & Kế Hoạch Công Việc
## 👤 Thành viên: Nguyễn Tùng Lâm (Trưởng nhóm IoT & Hạ tầng / IoT & Infrastructure Lead)
## 📅 Cập nhật lần cuối: 29/06/2026

Tài liệu này hệ thống lại hiện trạng các công việc Lâm đã thực hiện, các công việc còn tồn đọng, mức độ ưu tiên tương ứng và hướng dẫn triển khai chi tiết từng nhiệm vụ để hoàn thiện đồ án tốt nghiệp **ICS-Guard**.

---

## I. BẢNG TỔNG HỢP ĐÁNH GIÁ & ĐỘ ƯU TIÊN

| Đầu việc & Module | Hiện trạng | Chi tiết công việc đã làm | Nội dung còn tồn đọng cần làm | Mức độ ưu tiên |
| :--- | :--- | :--- | :--- | :---: |
| **Bảo mật kênh truyền MQTT (TLS 1.3)** | **🟢 Hoàn thành** | - Đã sinh chứng chỉ SSL tự ký.<br>- Đã mở cổng `8883` bảo mật TLS 1.3 trong Mosquitto.<br>- Đã cấu hình TLS 1.3 cho client Simulator & Backend. | *Không có (Đã hoàn thiện xong phần kết nối)* | *Đã xong* |
| **Tài liệu hướng dẫn & Sơ đồ UML** | **🟢 Hoàn thành** | - Đã vẽ sơ đồ triển khai UML bằng Mermaid trong `README.md`.<br>- Đã hoàn thành viết tài liệu Hướng dẫn vận hành chi tiết trong tệp `README.md` ở gốc dự án. | *Không có (Đã hoàn thiện)* | *Đã xong* |
| **Retention Policy cho InfluxDB** | **🟢 Hoàn thành** | - Đã cấu hình tự động tạo Retention Policy (14 ngày) mặc định khi server khởi chạy trong `influxService.js`. | *Không có (Đã hoàn thiện)* | *Đã xong* |
| **REST Ingestion Data Validation** | **🟢 Hoàn thành** | - Đã xác thực kiểu dữ liệu JSON Schema đầu vào.<br>- Đã tích hợp kiểm tra timestamp (lệch tối đa 5 phút) để chống Replay Attack tại `telemetryController.js`. | *Không có (Đã hoàn thiện)* | *Đã xong* |
| **Triển khai Cloud & HTTPS** | **🔴 Chưa hoàn thành** | - Đã đóng gói chạy local ổn định bằng Docker Compose. | - Đưa hệ thống lên Cloud ảo (AWS/GCP/Azure).<br>- Cấu hình HTTPS an toàn sử dụng chứng chỉ miễn phí Let's Encrypt. | **🌟 KHUYẾN KHÍCH** *(Điểm cộng để đạt mức Xuất sắc)* |
| **Giả lập Thiết bị & Tấn công** | **🟢 Hoàn thành** | - Đã giả lập gửi telemetry 3 loại thiết bị.<br>- Đã cấu hình điều khiển tấn công qua MQTT.<br>- Đã xây dựng giao diện Attacker Console (Red Cyberpunk) để kích hoạt tấn công thủ công. | *Không có (Đã hoàn thiện tốt)* | *Đã xong* |
| **Đóng gói Hạ tầng Docker** | **🟢 Hoàn thành** | - Docker-compose khởi chạy thành công toàn bộ hệ thống local. | *Không có (Sẽ cập nhật cấu hình cổng MQTT TLS sau khi làm xong TLS)* | *Đã xong* |

---

## II. CHI TIẾT TỪNG ĐẦU VIỆC & HƯỚNG DẪN THỰC HIỆN

### 1. Cấu hình bảo mật TLS 1.3 cho Mosquitto Broker & Client (Ưu tiên: 🔥 Cao)
* **Mục tiêu:** Mã hóa toàn bộ dữ liệu telemetry gửi qua giao thức MQTT để chống nghe lén dữ liệu trong môi trường công nghiệp.
* **Các bước thực hiện cụ thể:**
  1. **Tạo CA và Chứng chỉ:** Chạy script OpenSSL để tạo file CA tự ký (`ca.crt`) cùng chứng chỉ Server (`server.crt`, `server.key`). Lưu chúng vào thư mục: `infrastructure/mosquitto/certs/`.
  2. **Cấu hình Mosquitto:** Sửa tệp `infrastructure/mosquitto/config/mosquitto.conf`:
     ```text
     listener 8883
     cafile /mosquitto/config/certs/ca.crt
     certfile /mosquitto/config/certs/server.crt
     keyfile /mosquitto/config/certs/server.key
     require_certificate false
     tls_version tlsv1.3
     ```
  3. **Cập nhật Device Simulator:** Trong tệp `iot/simulator/simulator.py`, cập nhật phần khởi tạo Client:
     ```python
     # Cấu hình TLS trước khi connect
     client.tls_set(ca_certs="certs/ca.crt", tls_version=ssl.PROTOCOL_TLSv1_2) # Hoặc đường dẫn ca.crt tương ứng
     client.connect(MQTT_HOST, 8883, 60)
     ```
  4. **Cập nhật Node.js Backend:** Trong dịch vụ `backend/src/services/mqttService.js`, cấu hình thư viện `mqtt.js` để đọc chứng chỉ CA và kết nối qua giao thức `mqtts://`.

---

### 2. Sơ đồ triển khai UML và tài liệu User Manual (Ưu tiên: 🔥 Cao)
* **Mục tiêu:** Cung cấp tài liệu kỹ thuật chuẩn chỉ cho báo cáo đồ án tốt nghiệp và hướng dẫn giáo viên vận hành.
* **Các bước thực hiện cụ thể:**
  1. **Vẽ sơ đồ triển khai UML:** Sử dụng công cụ vẽ (như Lucidchart, Draw.io hoặc mã nguồn Mermaid) để mô tả cách 9 container liên kết với nhau trong mạng Docker Bridge (các cổng giao tiếp như 3000, 8000, 8086, 1883, 15672...).
  2. **Viết User Manual:** Viết trực tiếp vào tệp `README.md` tại thư mục gốc của dự án, bao gồm:
     * Yêu cầu cài đặt trước (Docker, Git, Node.js).
     * Các biến môi trường cần khai báo trong tệp `.env`.
     * Hướng dẫn chạy hệ thống (`docker-compose up -d --build`).
     * Hướng dẫn kiểm tra trạng thái và khắc phục sự cố thông thường (xem log container).

---

### 3. Chính sách lưu trữ dữ liệu (Retention Policy) cho InfluxDB (Ưu tiên: ⚡ Trung bình)
* **Mục tiêu:** Tự động giới hạn thời gian lưu dữ liệu đo đạc (telemetry), tránh tràn dung lượng đĩa cứng khi hệ thống thu thập dữ liệu thời gian thực liên tục.
* **Các bước thực hiện cụ thể:**
  1. Sử dụng script khởi chạy database hoặc chạy trực tiếp lệnh SQL qua CLI InfluxDB:
     ```sql
     CREATE RETENTION POLICY "two_weeks_telemetry" ON "ics_telemetry" DURATION 14d REPLICATION 1 DEFAULT
     ```
  2. Đoạn code này cần được tích hợp trong file `backend/src/database/seed_influx.js` để đảm bảo hệ thống tự cấu hình ngay từ lần chạy đầu tiên.

---

### 4. REST Ingest Data Validation (Ưu tiên: ⚡ Trung bình)
* **Mục tiêu:** Xác thực tính toàn vẹn của dữ liệu log thô gửi qua REST và ngăn chặn các cuộc tấn công phát lại (Replay Attack).
* **Các bước thực hiện cụ thể:**
  1. **Xác thực cấu trúc dữ liệu:** Sử dụng thư viện validation (ví dụ: `joi` hoặc bộ xác thực Schema có sẵn) tại `backend/src/controllers/telemetryController.js` để kiểm tra payload log thô.
  2. **Chống Replay Attack:** Kiểm tra trường `timestamp` trong payload gửi lên. Nếu timestamp lệch quá xa so với thời gian hiện tại của Server (ví dụ: > 5 phút), trả về mã lỗi từ chối yêu cầu.

---

### 5. Triển khai Cloud & HTTPS (Ưu tiên: 🌟 Khuyến khích - Điểm Xuất Sắc)
* **Mục tiêu:** Chạy thực tế hệ thống trên môi trường Internet để kiểm thử từ xa và bảo mật kết nối web.
* **Các bước thực hiện cụ thể:**
  1. Thuê/Khởi tạo máy chủ ảo VPS (như AWS EC2, Google Compute Engine, hoặc các nhà cung cấp như DigitalOcean).
  2. Cài đặt Docker và kéo mã nguồn dự án về.
  3. Cấu hình Nginx làm Reverse Proxy để tiếp nhận HTTPS qua cổng 443 và sử dụng công cụ **Certbot** tự động cấp chứng chỉ SSL miễn phí từ **Let's Encrypt**.

---

## III. KẾ HOẠCH PHÂN CHIA GIAI ĐOẠN TRIỂN KHAI CHI TIẾT

Để thuận tiện cho việc thực hiện và kiểm soát chất lượng, lộ trình công việc còn lại của bạn được chia thành 4 giai đoạn cụ thể sau:

### 📅 GIAI ĐOẠN 1: BẢO MẬT KÊNH TRUYỀN MQTT (TLS 1.3)
> **Mục tiêu:** Hoàn thành toàn bộ kết nối bảo mật giữa Client và Broker. Đây là nhiệm vụ khó nhất và quan trọng nhất.

*   **[x] Tác vụ 1.1: Sinh cặp chứng chỉ CA và SSL**
    *   Tạo script OpenSSL sinh `ca.crt`, `server.crt`, `server.key` tự ký.
    *   Đặt các file chứng chỉ vào thư mục [infrastructure/mosquitto/certs/](file:///d:/New%20folder/ICS-Guard/infrastructure/mosquitto/certs/).
*   **[x] Tác vụ 1.2: Cấu hình MQTT Broker (Mosquitto)**
    *   Sửa file [mosquitto.conf](file:///d:/New%20folder/ICS-Guard/infrastructure/mosquitto/config/mosquitto.conf): Bật cổng `8883`, trỏ đường dẫn tới chứng chỉ và cấu hình giao thức TLS 1.3.
*   **[x] Tác vụ 1.3: Cấu hình TLS cho Device Simulator**
    *   Sửa file [simulator.py](file:///d:/New%20folder/ICS-Guard/iot/simulator/simulator.py): Sử dụng phương thức `client.tls_set(...)` trỏ tới file `ca.crt` và đổi cổng kết nối từ `1883` thành `8883`.
*   **[x] Tác vụ 1.4: Cấu hình TLS cho Backend API**
    *   Sửa file `backend/src/services/mqttService.js`: Thiết lập cấu hình đọc tệp `ca.crt` và cập nhật URI kết nối sang giao thức bảo mật `mqtts://`.

---

### 📅 GIAI ĐOẠN 2: TỐI ƯU HÓA DỮ LIỆU & CHỐNG TẤN CÔNG PHÁT LẠI (REPLAY ATTACK)
> **Mục tiêu:** Đảm bảo hệ thống vận hành trơn tru lâu dài và an toàn trước các cuộc tấn công gửi lại gói tin.

*   **[x] Tác vụ 2.1: Cấu hình Retention Policy cho InfluxDB**
    *   Cập nhật tệp [seed_influx.js](file:///d:/New%20folder/ICS-Guard/backend/src/database/seed_influx.js) và [influxService.js](file:///d:/New%20folder/ICS-Guard/backend/src/services/influxService.js) để thiết lập mặc định thời gian lưu trữ dữ liệu (Retention Policy) là 14 ngày.
*   **[x] Tác vụ 2.2: Ràng buộc dữ liệu & Chống Replay Attack**
    *   Cập nhật tệp `backend/src/controllers/telemetryController.js` (hoặc middleware tương ứng):
        *   Xác thực cấu trúc JSON Schema của log gửi lên.
        *   So sánh timestamp trong log với thời gian hiện tại của Server để từ chối các gói tin log quá cũ (ngăn chặn Replay Attack).

---

### 📅 GIAI ĐOẠN 3: ĐÓNG GÓI TÀI LIỆU HỌC THUẬT & HƯỚNG DẪN VẬN HÀNH
> **Mục tiêu:** Đóng gói hoàn chỉnh đồ án để nộp báo cáo tốt nghiệp.

*   **[x] Tác vụ 3.1: Vẽ sơ đồ triển khai UML (Deployment Diagram)**
    *   Vẽ sơ đồ kết nối mạng Docker Bridge của 9 dịch vụ kèm theo các cổng giao tiếp được ánh xạ ra ngoài.
*   **[x] Tác vụ 3.2: Viết User Manual chi tiết**
    *   Cập nhật tệp `README.md` tại thư mục gốc chứa các thông tin hướng dẫn chuẩn bị môi trường, lệnh khởi động dự án bằng Docker Compose, và thông tin tài khoản truy cập mặc định.

---

### 📅 GIAI ĐOẠN 4 (TÙY CHỌN): TRIỂN KHAI CLOUD & HTTPS
> **Mục tiêu:** Triển khai sản phẩm lên máy chủ Internet thực tế để lấy điểm tối đa (mức Xuất sắc).

*   **[ ] Tác vụ 4.1: Triển khai dự án lên máy chủ VPS**
    *   Thiết lập môi trường Docker trên VPS Ubuntu và kéo dự án về chạy.
*   **[ ] Tác vụ 4.2: Cấu hình Reverse Proxy & HTTPS**
    *   Cấu hình Nginx dẫn hướng các kết nối qua cổng `443` tới Dashboard và Backend.
    *   Sử dụng Certbot để tự động cấp chứng chỉ SSL miễn phí từ Let's Encrypt cho tên miền.
