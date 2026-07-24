# Cấu trúc thư mục Backend

Dưới đây là cấu trúc thư mục của phần backend trong dự án:

```text
backend/
├── mosquitto/                    # Thư mục cấu hình cho MQTT broker (Mosquitto).
│   └── config/                   # Chứa cấu hình chi tiết của mosquitto.
├── src/                          # Thư mục chứa toàn bộ mã nguồn chính của backend.
│   ├── certs/                    # Chứa các chứng chỉ (certificates) bảo mật (SSL/TLS).
│   ├── config/                   # Chứa các cấu hình cho ứng dụng (môi trường, hệ thống).
│   ├── constants/                # Chứa các hằng số dùng chung trong toàn bộ project.
│   │   ├── app.type.js           # Các hằng số về loại ứng dụng.
│   │   ├── auth.js               # Các hằng số liên quan đến xác thực.
│   │   ├── index.js              # File xuất (export) các hằng số.
│   │   ├── message.js            # Các hằng số thông báo hệ thống.
│   │   ├── roles.js              # Các hằng số về phân quyền (roles).
│   │   ├── status.js             # Các hằng số về trạng thái hoạt động.
│   │   └── types.js              # Các hằng số về kiểu dữ liệu.
│   ├── controllers/              # Chứa các controllers xử lý logic nhận request từ router.
│   │   ├── aiController.js       # Xử lý các API liên quan đến AI (chatbot, analysis).
│   │   ├── alertController.js    # Xử lý các API quản lý cảnh báo.
│   │   ├── attackController.js   # Xử lý các API mô phỏng tấn công.
│   │   ├── auditController.js    # Xử lý các API nhật ký hệ thống (audit logs).
│   │   ├── authController.js     # Xử lý các API xác thực người dùng (login, register).
│   │   ├── dashboardController.js# Xử lý các API thống kê cho trang chủ (dashboard).
│   │   ├── deviceController.js   # Xử lý các API quản lý thiết bị.
│   │   ├── incidentController.js # Xử lý các API quản lý sự cố (incidents).
│   │   ├── ruleController.js     # Xử lý các API quản lý luật cảnh báo (rules).
│   │   ├── telemetryController.js# Xử lý các API dữ liệu telemetry từ thiết bị.
│   │   └── userController.js     # Xử lý các API quản lý người dùng.
│   ├── database/                 # Chứa các file kết nối tới CSDL, migration, seed data.
│   │   ├── seed_influx.js        # Script tạo dữ liệu mẫu cho InfluxDB.
│   │   └── seed_local.js         # Script tạo dữ liệu mẫu cho MongoDB/LocalDB.
│   ├── middlewares/              # Chứa các middlewares xử lý logic trung gian (auth, log, error).
│   │   ├── auditMiddleware.js    # Middleware ghi log hành động người dùng.
│   │   ├── authMiddleware.js     # Middleware kiểm tra xác thực (token).
│   │   ├── ipBlockMiddleware.js  # Middleware chặn các IP độc hại.
│   │   └── rbacMiddleware.js     # Middleware kiểm tra quyền truy cập (RBAC).
│   ├── models/                   # Chứa định nghĩa các schema/model tương tác với database.
│   │   ├── alert.js              # Model cho dữ liệu cảnh báo.
│   │   ├── auditLog.js           # Model cho dữ liệu nhật ký hệ thống.
│   │   ├── blockedIp.js          # Model lưu danh sách IP bị chặn.
│   │   ├── device.js             # Model cho dữ liệu thiết bị.
│   │   ├── incident.js           # Model cho dữ liệu sự cố.
│   │   ├── incidentTimeline.js   # Model lưu diễn biến sự cố.
│   │   ├── index.js              # File gom các models để export.
│   │   ├── refreshToken.js       # Model lưu refresh token của người dùng.
│   │   ├── rule.js               # Model cho dữ liệu luật cảnh báo.
│   │   └── user.js               # Model cho dữ liệu người dùng.
│   ├── repositories/             # Chứa các lớp giao tiếp trực tiếp với database (Repository pattern).
│   │   ├── alertRepository.js    # Xử lý truy vấn database cho alert.
│   │   ├── auditRepository.js    # Xử lý truy vấn database cho audit.
│   │   ├── authRepository.js     # Xử lý truy vấn database cho auth.
│   │   ├── blockedIpRepository.js# Xử lý truy vấn database cho blocked IPs.
│   │   ├── deviceRepository.js   # Xử lý truy vấn database cho device.
│   │   ├── incidentRepository.js # Xử lý truy vấn database cho incident.
│   │   ├── incidentTimelineRepository.js # Xử lý truy vấn database cho timeline sự cố.
│   │   ├── ruleRepository.js     # Xử lý truy vấn database cho rule.
│   │   └── userRepository.js     # Xử lý truy vấn database cho user.
│   ├── routes/                   # Định nghĩa các endpoints (API) và điều hướng request.
│   │   ├── aiRoutes.js           # Định tuyến API AI.
│   │   ├── alertRoutes.js        # Định tuyến API cảnh báo.
│   │   ├── attackRoutes.js       # Định tuyến API tấn công.
│   │   ├── auditRoutes.js        # Định tuyến API nhật ký hệ thống.
│   │   ├── authRoutes.js         # Định tuyến API xác thực.
│   │   ├── dashboardRoutes.js    # Định tuyến API thống kê dashboard.
│   │   ├── deviceRoutes.js       # Định tuyến API thiết bị.
│   │   ├── incidentRoutes.js     # Định tuyến API sự cố.
│   │   ├── ruleRoutes.js         # Định tuyến API luật.
│   │   ├── telemetryRoutes.js    # Định tuyến API telemetry.
│   │   └── userRoutes.js         # Định tuyến API người dùng.
│   ├── services/                 # Chứa các nghiệp vụ logic (business logic) cốt lõi.
│   │   ├── alertService.js       # Logic xử lý cảnh báo.
│   │   ├── attackService.js      # Logic xử lý mô phỏng tấn công.
│   │   ├── auditService.js       # Logic xử lý nhật ký.
│   │   ├── authService.js        # Logic xử lý xác thực, token.
│   │   ├── dashboardService.js   # Logic xử lý dữ liệu dashboard.
│   │   ├── deviceService.js      # Logic xử lý quản lý thiết bị.
│   │   ├── emailService.js       # Logic gửi email thông báo.
│   │   ├── incidentService.js    # Logic xử lý sự cố.
│   │   ├── influxService.js      # Logic tương tác với InfluxDB.
│   │   ├── mqttService.js        # Logic xử lý giao thức MQTT.
│   │   ├── queueService.js       # Logic xử lý hàng đợi (RabbitMQ/Redis).
│   │   ├── ruleService.js        # Logic xử lý luật.
│   │   ├── securityService.js    # Logic bảo mật và mã hóa.
│   │   ├── sessionRegistry.js    # Quản lý phiên làm việc (sessions).
│   │   ├── socketService.js      # Logic xử lý WebSocket (real-time).
│   │   ├── telegramService.js    # Logic gửi thông báo qua Telegram.
│   │   ├── telemetryService.js   # Logic xử lý luồng dữ liệu telemetry.
│   │   └── userService.js        # Logic xử lý thông tin người dùng.
│   ├── shared/                   # Các tài nguyên, định nghĩa dùng chung.
│   │   ├── constants/            # Hằng số chung chia sẻ giữa các service.
│   │   │   └── severity.js       # Mức độ nghiêm trọng.
│   │   ├── schemas/              # Các schema chuẩn chung.
│   │   │   └── deviceSchema.js   # Schema chuẩn cho thiết bị.
│   │   └── package.json          # File định nghĩa module shared.
│   ├── utils/                    # Chứa các hàm tiện ích nhỏ (helper functions).
│   │   ├── AppError.js           # Lớp xử lý lỗi tùy chỉnh.
│   │   ├── ipHelper.js           # Hàm xử lý, định dạng địa chỉ IP.
│   │   ├── pagination.js         # Hàm tiện ích phân trang kết quả.
│   │   ├── regex.js              # Các biểu thức chính quy (Regex) dùng chung.
│   │   └── response.js           # Hàm chuẩn hóa format API response.
│   ├── validators/               # Chứa các logic kiểm tra (validate) dữ liệu đầu vào.
│   │   ├── alertValidator.js     # Validate dữ liệu tạo/sửa cảnh báo.
│   │   ├── attackValidator.js    # Validate dữ liệu payload tấn công.
│   │   ├── auditValidator.js     # Validate truy vấn nhật ký.
│   │   ├── authValidator.js      # Validate dữ liệu đăng nhập, đăng ký.
│   │   ├── commonValidator.js    # Validate dữ liệu chung (ID, pagination).
│   │   ├── deviceValidator.js    # Validate dữ liệu thiết bị.
│   │   ├── incidentValidator.js  # Validate dữ liệu sự cố.
│   │   ├── ruleValidator.js      # Validate dữ liệu cấu hình luật.
│   │   ├── telemetryValidator.js # Validate dữ liệu telemetry từ thiết bị.
│   │   └── userValidator.js      # Validate dữ liệu tạo/sửa người dùng.
│   └── app.js                    # Tệp khởi tạo và cấu hình ứng dụng Express.
├── api-prompt.txt                # Tài liệu lưu trữ các API prompt hoặc ghi chú cấu hình AI.
├── Dockerfile                    # Cấu hình Docker để build image cho backend.
├── package-lock.json             # File lock phiên bản thư viện.
├── package.json                  # Quản lý các thư viện, dependencies của Node.js.
├── swagger-output.json           # File kết quả tài liệu API tự động (Swagger).
└── swagger.js                    # File cấu hình tạo tài liệu API tự động (Swagger).
```
