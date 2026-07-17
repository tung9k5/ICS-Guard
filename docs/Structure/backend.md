# Cấu trúc thư mục Backend

Dưới đây là cấu trúc thư mục của phần backend trong dự án:

```text
backend/
├── src/                      # Thư mục chứa toàn bộ mã nguồn chính của backend.
│   ├── app.js                # Tệp khởi tạo và cấu hình ứng dụng Express.
│   ├── certs/                # Chứa các chứng chỉ (certificates) bảo mật (SSL/TLS).
│   ├── config/               # Chứa các cấu hình cho ứng dụng (môi trường, hệ thống).
│   ├── constants/            # Chứa các hằng số dùng chung trong toàn bộ project.
│   ├── controllers/          # Chứa các controllers xử lý logic nhận request từ router.
│   │   ├── alertController.js
│   │   ├── attackController.js
│   │   ├── auditController.js
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── deviceController.js
│   │   ├── incidentController.js
│   │   ├── ruleController.js
│   │   ├── telemetryController.js
│   │   └── userController.js
│   ├── database/             # Chứa các file kết nối tới CSDL, migration, seed data.
│   ├── middlewares/          # Chứa các middlewares xử lý logic trung gian (auth, log, error).
│   ├── models/               # Chứa định nghĩa các schema/model tương tác với database.
│   │   ├── alert.js
│   │   ├── auditLog.js
│   │   ├── blockedIp.js
│   │   ├── device.js
│   │   ├── incident.js
│   │   ├── incidentTimeline.js
│   │   ├── index.js
│   │   ├── refreshToken.js
│   │   ├── rule.js
│   │   └── user.js
│   ├── repositories/         # Chứa các lớp giao tiếp trực tiếp với database (Repository pattern).
│   ├── routes/               # Định nghĩa các endpoints (API) và điều hướng request.
│   ├── services/             # Chứa các nghiệp vụ logic (business logic) cốt lõi.
│   ├── utils/                # Chứa các hàm tiện ích nhỏ (helper functions).
│   └── validators/           # Chứa các logic kiểm tra (validate) dữ liệu đầu vào.
├── Dockerfile                # Cấu hình Docker để build image cho backend.
├── package.json              # Quản lý các thư viện, dependencies của Node.js.
├── package-lock.json         # File lock phiên bản thư viện.
├── swagger.js                # Cấu hình tạo tài liệu API tự động (Swagger).
└── swagger-output.json       # File kết quả tài liệu Swagger.
```
