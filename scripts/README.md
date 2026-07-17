# SCRIPTS - ICS-Guard

Thư mục chứa các script tự động hóa: database seeder, auto block IP firewall, và điều phối hệ thống.

## 👤 Thành viên phụ trách
*   **Nguyễn Trí Dũng & Nguyễn Tùng Lâm**

## 🚀 Nhiệm vụ & Mục tiêu triển khai
- Giai đoạn 4: Viết script gọi API firewall chặn IP tự động khi có brute-force.
- Giai đoạn 2: Khởi tạo dữ liệu mẫu tĩnh (seeder JSON) tại [scripts/seed/](seed/) (`users.json`, `devices.json`, `rules.json`). Các script nạp dữ liệu thực tế được quản lý tập trung tại phân hệ [backend/database/](../../backend/database/).
