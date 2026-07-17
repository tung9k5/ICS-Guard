# Tổng quan và Yêu cầu Hệ thống khi vận hành thực tế
*(Tài liệu giải thích dành cho người không chuyên IT)*

Tài liệu này mô tả một cách đơn giản, dễ hiểu về **cách hệ thống hoạt động sau khi triển khai** và **cách kết nối với các thiết bị IoT ngoài thực tế**.

---

## 1. Hệ thống sẽ hoạt động như thế nào?

Hãy tưởng tượng hệ thống giống như **một trung tâm giám sát an ninh**. Thay vì theo dõi camera, hệ thống sẽ theo dõi toàn bộ dữ liệu mà các thiết bị IoT gửi về và tự động phát hiện những dấu hiệu bất thường.

Sau khi triển khai, hệ thống sẽ bao gồm ba thành phần chính:

- **Thiết bị IoT:** Bao gồm các cảm biến, PLC, máy bơm, quạt thông minh hoặc các thiết bị công nghiệp khác được lắp đặt tại hiện trường.
- **Máy chủ (Server):** Tiếp nhận dữ liệu từ các thiết bị IoT, phân tích bằng các thuật toán giám sát và phát hiện các hành vi bất thường hoặc tấn công.
- **Trang quản trị (Dashboard):** Người quản lý chỉ cần truy cập vào trang web để theo dõi trạng thái của toàn bộ thiết bị theo thời gian thực.

Hệ thống hoạt động hoàn toàn tự động:

- Các thiết bị IoT liên tục gửi dữ liệu về Server thông qua mạng (Wi-Fi, mạng LAN hoặc Internet).
- Server phân tích dữ liệu ngay khi nhận được.
- Khi phát hiện dữ liệu bất thường hoặc có dấu hiệu tấn công, hệ thống sẽ ngay lập tức:
  - Hiển thị cảnh báo trên Dashboard.
  - Gửi thông báo qua Telegram.
  - Gửi Email cảnh báo chi tiết.

Người sử dụng không cần theo dõi hệ thống liên tục. Chỉ cần đăng nhập Dashboard khi cần hoặc chờ thông báo nếu có sự cố xảy ra.

---

## 2. Làm sao để phần mềm kết nối được với máy móc (IoT) thật ở ngoài đời?

Các thiết bị IoT sẽ giao tiếp với hệ thống thông qua mạng nội bộ hoặc Internet, không cần kết nối trực tiếp bằng dây USB.

Quy trình kết nối thực tế diễn ra như sau:

1. **Chuẩn bị thiết bị**
   - Lắp đặt các thiết bị IoT tại vị trí cần giám sát (ví dụ: cảm biến nhiệt độ, cảm biến độ ẩm, PLC, máy bơm, quạt thông minh...).

2. **Kết nối mạng**
   - Cấu hình thiết bị để kết nối vào cùng hệ thống mạng thông qua Wi-Fi, mạng LAN hoặc Internet.

3. **Khai báo thiết bị**
   - Thêm thông tin thiết bị vào hệ thống để Server có thể nhận diện và quản lý.

4. **Truyền dữ liệu**
   - Sau khi kết nối thành công, thiết bị sẽ tự động gửi dữ liệu định kỳ hoặc theo thời gian thực về Server.

5. **Giám sát và phát hiện bất thường**
   - Server sẽ kiểm tra toàn bộ dữ liệu nhận được.
   - Nếu dữ liệu bình thường, hệ thống tiếp tục ghi nhận và theo dõi.
   - Nếu phát hiện dấu hiệu bất thường hoặc nghi ngờ bị tấn công, hệ thống sẽ lập tức:
     - Hiển thị cảnh báo trên Dashboard.
     - Gửi thông báo qua Telegram.
     - Gửi Email cảnh báo.
     - Lưu lại toàn bộ sự kiện để phục vụ việc kiểm tra sau này.

---

## 3. Tóm tắt quy trình sử dụng

Người sử dụng chỉ cần thực hiện các bước đơn giản sau:

1. Khởi động Server hoặc máy tính đã cài đặt hệ thống.
2. Đảm bảo các thiết bị IoT đã được kết nối mạng và khai báo trong hệ thống.
3. Đăng nhập Dashboard để theo dõi trạng thái của các thiết bị.
4. Khi có sự cố hoặc dấu hiệu tấn công, hệ thống sẽ tự động gửi cảnh báo qua Dashboard, Telegram và Email để người quản lý xử lý kịp thời.

Toàn bộ quá trình thu thập dữ liệu, phân tích, giám sát và cảnh báo đều được thực hiện tự động. Người sử dụng không cần có kiến thức chuyên sâu về lập trình hoặc công nghệ IoT để vận hành hệ thống.

---

## Mô hình hoạt động tổng quát

```text
                    +-----------------------+
                    |   Thiết bị IoT        |
                    | (PLC, Sensor, Quạt...)|
                    +----------+------------+
                               |
                      Wi-Fi / LAN / Internet
                               |
                               v
                    +-----------------------+
                    |       Server          |
                    | - Nhận dữ liệu        |
                    | - Phân tích           |
                    | - Phát hiện tấn công  |
                    +----------+------------+
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
+----------------+    +----------------+    +----------------+
| Dashboard Web  |    |    Telegram    |    |     Email      |
| Theo dõi       |    | Thông báo      |    | Cảnh báo       |
+----------------+    +----------------+    +----------------+
```