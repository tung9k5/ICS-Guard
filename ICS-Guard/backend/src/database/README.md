# DATABASE - ICS-Guard

Quản lý kết nối và các thao tác cơ bản với MongoDB (Event/Incident DB) và InfluxDB (Telemetry DB).

## 👤 Thành viên phụ trách
*   **Nguyễn Trí Dũng**

## 🚀 Nhiệm vụ & Mục tiêu triển khai
- Giai đoạn 1: Thiết kế ERD database (MongoDB, InfluxDB). Chi tiết thiết kế xem tại [database_design.md](../../../docs/database/database_design.md).
- Giai đoạn 2: Khởi tạo database local và nạp dữ liệu mẫu bằng các script:
  *   [seed_local.js](seed_local.js): Khởi tạo MongoDB (cấu hình index & import users, devices, rules).
  *   [seed_influx.js](seed_influx.js): Khởi tạo InfluxDB (thiết lập retention policy & ghi telemetry 24h qua).
