# Cấu trúc Cơ sở dữ liệu (Database Collections)

Dưới đây là cấu trúc các bảng (collections) trong cơ sở dữ liệu MongoDB của dự án, được trình bày dưới dạng thư mục để dễ hình dung:

- `Database: ICS-Guard`
  - `users`: Bảng lưu trữ thông tin người dùng hệ thống.
    - `username` (String): Tên đăng nhập
    - `password_hash` (String): Mật khẩu đã được mã hóa
    - `email` (String): Địa chỉ email
    - `full_name` (String): Họ và tên đầy đủ
    - `role` (String): Quyền hạn (ví dụ: Admin, Customer)
    - `is_active` (Boolean): Trạng thái hoạt động
    - `login_failures` (Object): Theo dõi số lần đăng nhập sai (count, last_failed_at, lockout_until)
    - `isFirstLogin` (Boolean): Đánh dấu lần đăng nhập đầu tiên
    - `contactInfo` (Object): Thông tin liên lạc (telegramChatId, telegramUsername, phoneNumber)
    - `isAlertEnabled` (Boolean): Cho phép nhận cảnh báo
    - `avatar` (String): Đường dẫn ảnh đại diện
    - `timestamps` (Date): createdAt, updatedAt

  - `devices`: Bảng quản lý các thiết bị (IoT/ICS) trong hệ thống.
    - `_id` (String): ID của thiết bị (custom)
    - `userId` (ObjectId): Tham chiếu đến `User` (chủ sở hữu)
    - `name` (String): Tên thiết bị
    - `type` (String): Loại thiết bị
    - `zone` (String): Khu vực thiết bị hoạt động
    - `ipAddress` (String): Địa chỉ IP
    - `macAddress` (String): Địa chỉ MAC
    - `status` (String): Trạng thái thiết bị (ACTIVE, INACTIVE, ...)
    - `risk_score` (Number): Điểm rủi ro
    - `api_key` (String): Khóa API cho thiết bị
    - `baseline_metrics` (Object): Thông số cơ sở (bytes_per_second_max, connection_rate_max)
    - `firmware_version` (String): Phiên bản firmware
    - `hardware_model` (String): Model phần cứng
    - `node_type` (String): Loại node (SENSOR, ACTUATOR, ...)
    - `parent_id` (String): ID của thiết bị cha (nếu có)
    - `icon_path` (String): Đường dẫn icon hiển thị
    - `lastSeen` (Date): Thời gian kết nối cuối cùng
    - `timestamps` (Date): createdAt, updatedAt

  - `alerts`: Bảng lưu trữ các cảnh báo an ninh được phát hiện.
    - `rule_name` (String): Tên luật kích hoạt cảnh báo
    - `device_id` (String): Tham chiếu đến `Device`
    - `title` (String): Tiêu đề cảnh báo
    - `description` (String): Mô tả chi tiết
    - `severity` (String): Mức độ nghiêm trọng (LOW, MEDIUM, HIGH, CRITICAL)
    - `status` (String): Trạng thái xử lý (NEW, ACKNOWLEDGED, RESOLVED, ...)
    - `source_ip` / `destination_ip` (String): IP nguồn và đích
    - `event_count` (Number): Số lượng sự kiện
    - `raw_events_sample` (Array): Mẫu các sự kiện thô (timestamp, message)
    - `detected_at` (Date): Thời điểm phát hiện
    - `resolved_at` (Date): Thời điểm giải quyết
    - `resolved_by` (String): Người giải quyết
    - `incident_id` (ObjectId): Tham chiếu đến `Incident` (nếu có)
    - `timestamps` (Date): createdAt, updatedAt

  - `incidents`: Bảng quản lý các sự cố an ninh.
    - `title` (String): Tiêu đề sự cố
    - `description` (String): Mô tả sự cố
    - `status` (String): Trạng thái (OPEN, IN_PROGRESS, RESOLVED, ...)
    - `severity` (String): Mức độ nghiêm trọng
    - `assigned_to` (ObjectId): Tham chiếu đến `User` (người được giao xử lý)
    - `alert_ids` (Array of ObjectId): Danh sách các `Alert` liên quan
    - `timestamps` (Date): createdAt, updatedAt

  - `incident_timelines`: Bảng lưu trữ dòng thời gian các hoạt động của một sự cố.
    - `incident_id` (ObjectId): Tham chiếu đến `Incident`
    - `event_time` (Date): Thời gian xảy ra sự kiện
    - `actor` (String): Tác nhân thực hiện
    - `action_type` (String): Loại hành động
    - `description` (String): Mô tả chi tiết hành động
    - `metadata` (Mixed): Dữ liệu bổ sung

  - `rules`: Bảng định nghĩa các luật phát hiện xâm nhập/cảnh báo.
    - `rule_name` (String): Tên luật
    - `description` (String): Mô tả luật
    - `is_active` (Boolean): Trạng thái kích hoạt
    - `severity` (String): Mức độ nghiêm trọng khi vi phạm
    - `conditions` (Array): Các điều kiện của luật (field, operator, value)
    - `time_window_seconds` (Number): Khung thời gian theo dõi
    - `trigger_count` (Number): Số lần vi phạm để kích hoạt
    - `group_by` (Array of String): Phân nhóm theo trường dữ liệu
    - `actions` (Array): Các hành động sẽ thực thi (action_type, config)
    - `created_by` (ObjectId): Tham chiếu đến `User` (người tạo)
    - `timestamps` (Date): createdAt, updatedAt

  - `audit_logs`: Bảng lưu nhật ký hệ thống (Audit Trail).
    - `userId` (ObjectId): Tham chiếu đến `User` thực hiện
    - `username` (String): Tên người dùng
    - `action` (String): Hành động thực hiện
    - `target_resource` (String): Tài nguyên bị tác động
    - `ipAddress` (String): Địa chỉ IP
    - `userAgent` (String): Trình duyệt / User Agent
    - `details` (Mixed): Chi tiết thao tác
    - `status` (String): Trạng thái (SUCCESS, FAILED)
    - `createdAt` (Date): Thời điểm ghi log

  - `blocked_ips`: Bảng lưu danh sách các địa chỉ IP bị chặn.
    - `ipAddress` (String): Địa chỉ IP bị chặn
    - `reason` (String): Lý do bị chặn
    - `blockedAt` (Date): Thời điểm bắt đầu chặn
    - `expiresAt` (Date): Thời điểm hết hạn chặn

  - `refresh_tokens`: Bảng quản lý Refresh Tokens cho việc xác thực.
    - `userId` (ObjectId): Tham chiếu đến `User`
    - `token` (String): Chuỗi token
    - `expiresAt` (Date): Thời điểm hết hạn
    - `revoked` (Boolean): Trạng thái đã bị thu hồi hay chưa
    - `timestamps` (Date): createdAt, updatedAt
