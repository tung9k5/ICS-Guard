# Đề Xuất Thiết Kế: Giao Diện Kích Hoạt Tấn Công (Attack Console) & Các Kịch Bản Mới

Tài liệu này phác thảo phương pháp triển khai giao diện điều khiển tấn công (**Attack Console**) và tích hợp các kịch bản tấn công nâng cao theo đề xuất ý tưởng của bạn.

---

## 1. Kiến trúc Giao diện & Tính năng Cốt lõi (Attack Console Web)

Chúng ta sẽ xây dựng một giao diện web riêng biệt (thường được đặt tên là `/attacker` hoặc `/attack-console`) với phong cách thiết kế **Rogue/Red Cyberpunk** (để phân biệt với giao diện SOC Dashboard màu xanh lá của phòng thủ).

### Giao diện điều khiển (UI Components):
*   **Bảng thiết bị mục tiêu (Target Grid)**: Hiển thị danh sách 50 thiết bị, kèm theo trạng thái kết nối thời gian thực (Online / Offline / Quarantined).
*   **Bộ cấu hình tấn công (Attack Configurator)**:
    *   Dropdown chọn thiết bị mục tiêu (`device_id`).
    *   Dropdown chọn kịch bản tấn công (Traffic Spike, Brute Force, Replay, MITM Drift).
    *   Trượt chọn thời gian tấn công (Duration) hoặc để chế độ "Vô hạn" (Infinite).
*   **Nút kích hoạt/dừng khẩn cấp**:
    *   Nút đỏ `[LAUNCH ATTACK]` (Khởi động).
    *   Nút xám `[TERMINATE ATTACK]` (Ngắt kết nối/Dừng cuộc tấn công).

---

## 2. Cơ chế Tự động Dừng khi Mất tín hiệu (Auto-Stop on Signal Loss)

Ý tưởng **Tự động dừng khi phát hiện thiết bị bị tấn công mất tín hiệu** là một cơ chế phản hồi rất thực tế. Điều này giả lập việc:
1. Thiết bị thật bị sập nguồn vật lý (Crash) do quá tải tấn công.
2. Hoặc hệ thống phòng thủ SOC đã **cách ly (Quarantine)** thành công thiết bị đó ra khỏi mạng, khiến kẻ tấn công không còn kết nối tới mục tiêu.

### Quy trình hoạt động của cơ chế Auto-Stop:

1.  **Phát hiện mất tín hiệu (Heartbeat Monitor)**:
    *   Ở Backend Node.js, chúng ta có một scheduler chạy nền kiểm tra định kỳ (mỗi 10 giây).
    *   Nếu một thiết bị không gửi dữ liệu telemetry lên InfluxDB/MQTT trong vòng **15 giây** qua, Backend sẽ cập nhật trạng thái thiết bị trong MongoDB thành `"offline"`.
2.  **Kích hoạt Hook ngừng tấn công**:
    *   Ngay khi trạng thái thiết bị chuyển thành `"offline"` hoặc `"quarantined"`, Backend sẽ tự động phát (publish) một tin nhắn MQTT xuống topic điều khiển:
        ```json
        Topic: "ics/control/attack"
        Payload: {
          "device_id": "plc-water-01",
          "action": "stop",
          "reason": "device_lost_signal"
        }
        ```
3.  **Simulator xử lý**:
    *   Simulator nhận được lệnh `stop` với lý do thiết bị mất tín hiệu. Nó sẽ lập tức tắt tiến trình giả lập tấn công của thiết bị đó và phục hồi về trạng thái nghỉ (`normal` nhưng ở chế độ offline).
    *   Trên giao diện **Attack Console**, trạng thái cuộc tấn công sẽ chuyển từ `Active (Đang chạy)` sang `Stopped (Đã dừng - Mất tín hiệu mục tiêu)`.

---

## 3. Đề xuất các Kịch Bản Tấn Công Mới (Ý tưởng mở rộng)

Ngoài hai kịch bản cũ (Brute Force và Traffic Spike), dưới đây là 3 kịch bản tấn công IoT công nghiệp (ICS) rất thực tế để lấy điểm tối đa về "Tính sáng tạo & Mở rộng":

### Kịch bản 3: Tấn công Phát lại (Replay Attack)
*   **Cách hoạt động**: Kẻ tấn công ghi lại (sniff) một gói tin telemetry bình thường từ PLC ở quá khứ, sau đó liên tục gửi lại (replay) gói tin đó lên Backend với **cùng một timestamp cũ** hoặc chỉnh sửa nhẹ.
*   **Mục đích kiểm thử**: Kiểm tra xem module **Data Validation** ở Backend có thực sự hoạt động tốt để chặn các gói tin trùng lặp timestamp hoặc timestamp quá hạn hay không.
*   **Simulator sẽ gửi**: Gửi liên tục 1 payload y hệt nhau về cả giá trị lẫn thời gian (`timestamp` giữ nguyên không đổi).

### Kịch bản 4: Tấn công Sai số trượt (MITM / False Data Injection Drift)
*   **Cách hoạt động**: Đây là kiểu tấn công kiểu **Stuxnet**. Kẻ tấn công không làm thay đổi đột ngột số liệu (vì sẽ bị rule phát hiện ngay), mà thay vào đó sẽ chèn mã độc để tăng nhẹ giá trị cảm biến (ví dụ: nhiệt độ tăng 0.1°C mỗi phút).
*   **Mục đích kiểm thử**: Thách thức mô hình **Học máy (Machine Learning)**. Chỉ có AI mới nhận ra xu hướng tăng dần bất thường này (Anomaly), các rule tĩnh dựa trên ngưỡng cứng (Threshold) sẽ hoàn toàn bị vượt qua.
*   **Simulator sẽ gửi**: telemetry với nhiệt độ tăng dần đều đặn cho đến khi vượt ngưỡng nguy hiểm.

### Kịch bản 5: Tấn công Từ chối dịch vụ vật lý (Jamming / Ransomware)
*   **Cách hoạt động**: Giả lập việc thiết bị bị mã hóa dữ liệu (Ransomware) hoặc kênh truyền sóng bị gây nhiễu (Jamming).
*   **Simulator sẽ gửi**: Ngừng hoàn toàn việc gửi telemetry của thiết bị đó lên Broker.
*   **Mục đích kiểm thử**: Kiểm tra xem SOC Dashboard có phát hiện thiết bị mất kết nối và kích hoạt sự cố **"DEVICE_OFFLINE_CRITICAL"** để cảnh báo kỹ sư vận hành đi kiểm tra thực địa hay không.
