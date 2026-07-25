# ICS-Guard: Industrial Cyber Security System

## 1. Giới thiệu

ICS-Guard là hệ thống giám sát an toàn mạng cho IoT/ICS, gồm các thành phần:

- **Frontend**: ReactJS (Vite) Dashboard
- **Backend**: Node.js + Express.js API
- **AI Services**: Node.js module (Gemini / OpenAI)
- **Database**: MongoDB, InfluxDB
- **Message Broker**: RabbitMQ, MQTT (Mosquitto)
- **Proxy**: Nginx
- **Deployment**: Docker Compose

## 2. Cài đặt môi trường

| Phần mềm | Phiên bản | Tải về |
| :--- | :--- | :--- |
| **Docker Desktop** | Mới nhất | [Tại đây](https://www.docker.com/products/docker-desktop/) |
| **Git** | Mới nhất | [Tại đây](https://git-scm.com/downloads) |
| **Node.js** | 20 LTS+ | [Tại đây](https://nodejs.org/) |
| **MongoDB Compass** (Tùy chọn) | Mới nhất | [Tại đây](https://www.mongodb.com/products/tools/compass) |

## 3. Cấu hình môi trường

Tạo file `.env` từ file mẫu:

**Windows**
```cmd
copy .env.example .env
```

Mở file `.env` và điền các giá trị thực tế. **Không commit file `.env` lên git.**
## 4. Chạy dự án

```bash
docker compose up -d --build
```

Docker sẽ tự động:
- Build Backend và Frontend
- Cài `node_modules` cho Frontend và Backend
- Khởi tạo MongoDB, RabbitMQ, Mosquitto và InfluxDB
- Hot-reload code khi có thay đổi

## 5. Kiểm tra

```bash
docker ps
```

Các container cần chạy: `frontend`, `backend`, `mongodb`, `rabbitmq`, `mosquitto`, `influxdb`, `nginx`.

## 6. Truy cập

| Dịch vụ | Địa chỉ |
| :--- | :--- |
| **Frontend** | [http://localhost:3000](http://localhost:3000) |
| **Backend API** | [http://localhost:8000](http://localhost:8000) |
| **Swagger** | [http://localhost:8000/docs](http://localhost:8000/docs) |
| **RabbitMQ** | [http://localhost:15672](http://localhost:15672) |
| **MongoDB** | `localhost:27017` |


## 7. Cấu trúc thư mục Frontend
Dưới đây là cấu trúc thư mục của phần frontend trong dự án:

```text
frontend/
├── public/                       # Chứa các file tài nguyên tĩnh không cần build tool.
├── src/                          # Thư mục chứa toàn bộ mã nguồn của giao diện ứng dụng.
│   ├── api/                      # Chứa các định nghĩa và hàm gọi API giao tiếp với backend.
│   │   ├── ai.js                 # API tương tác với AI Services.
│   │   ├── alerts.js             # API tương tác với cảnh báo.
│   │   ├── attacks.js            # API giả lập tấn công.
│   │   ├── audit.js              # API xem nhật ký hệ thống.
│   │   ├── auth.js               # API xác thực (login, register, token).
│   │   ├── dashboard.js          # API lấy dữ liệu thống kê dashboard.
│   │   ├── device.js             # API quản lý thiết bị ICS.
│   │   ├── incidents.js          # API quản lý sự cố an ninh.
│   │   ├── rules.js              # API cấu hình luật.
│   │   └── users.js              # API quản lý người dùng.
│   ├── assets/                   # Chứa tài nguyên tĩnh như hình ảnh, biểu tượng, font chữ.
│   │   ├── fonts/                # Thư mục chứa các font chữ.
│   │   │   └── Metropolis/       # Font Metropolis.
│   │   └── base_color.scss       # Định nghĩa các biến màu sắc SCSS chung.
│   ├── components/               # Chứa các UI components dùng chung.
│   │   ├── ActionMenu/           # Component menu hành động (dropdown).
│   │   ├── DraggableChatbot/     # Component chatbot có thể kéo thả trên UI.
│   │   ├── GlobalLoading/        # Component hiển thị trạng thái loading toàn trang.
│   │   ├── LanguageSwitcher/     # Component chuyển đổi ngôn ngữ.
│   │   ├── VButton/              # Component nút bấm (Button) dùng chung.
│   │   ├── VCheckbox/            # Component Checkbox.
│   │   ├── VDialog/              # Component hộp thoại (Modal/Dialog).
│   │   ├── VFilterPage/          # Component thanh lọc/tìm kiếm chung.
│   │   ├── VHeaderPage/          # Component tiêu đề các trang.
│   │   ├── Viewlogo/             # Component hiển thị logo.
│   │   ├── VInput/               # Component input văn bản dùng chung.
│   │   ├── VNoData/              # Component hiển thị trạng thái không có dữ liệu.
│   │   ├── VPagination/          # Component phân trang.
│   │   ├── VSelectFilter/        # Component dropdown lựa chọn bộ lọc.
│   │   ├── VStatus/              # Component hiển thị thẻ trạng thái.
│   │   └── VTextarea/            # Component input văn bản dài (Textarea).
│   ├── constants/                # Chứa các hằng số, thông báo, enum dùng chung.
│   │   ├── alertConstants.js     # Hằng số cho module cảnh báo.
│   │   ├── authConstants.js      # Hằng số xác thực.
│   │   ├── chatbotConstants.js   # Hằng số chatbot.
│   │   ├── common.js             # Hằng số thông dụng chung.
│   │   ├── deviceConstants.js    # Hằng số thiết bị.
│   │   ├── incidentConstants.js  # Hằng số sự cố.
│   │   ├── routes.js             # Hằng số đường dẫn các trang.
│   │   ├── ruleConstants.js      # Hằng số hệ thống luật.
│   │   └── uiConstants.js        # Hằng số cấu hình UI (theme, padding).
│   ├── Dialog/                   # Chứa các components liên quan đến hộp thoại chuyên biệt.
│   │   ├── DeleteConfirmModal/   # Dialog xác nhận xóa.
│   │   └── IdleTimeout/          # Dialog thông báo timeout (hết phiên làm việc).
│   ├── hooks/                    # Chứa các custom hooks React (useAuth, useFetch...).
│   │   ├── useAuth.js            # Hook xử lý logic authentication.
│   │   ├── useExpandable.js      # Hook xử lý việc đóng/mở (expand) row trong table.
│   │   ├── useFetchList.js       # Hook tiện ích fetch data danh sách và phân trang.
│   │   ├── useLoader.js          # Hook quản lý trạng thái loading toàn trang.
│   │   └── useSelection.js       # Hook xử lý việc chọn các checkbox.
│   ├── http/                     # Cấu hình HTTP client (như Axios), interceptors, token.
│   │   └── clients/              # Thư mục client HTTP.
│   │       └── api.js            # Khởi tạo instance Axios và setup interceptor.
│   ├── i18n/                     # Chứa cấu hình và file ngôn ngữ phục vụ đa ngôn ngữ.
│   │   ├── locales/              # Thư mục chứa các file json ngôn ngữ.
│   │   │   ├── en/               # Tiếng Anh.
│   │   │   └── vi/               # Tiếng Việt.
│   │   └── config.js             # Cấu hình i18next khởi tạo đa ngôn ngữ.
│   ├── layouts/                  # Chứa các components bố cục trang (Header, Sidebar, Footer).
│   │   ├── AuthLayout/           # Layout dành cho các trang đăng nhập/đăng ký.
│   │   ├── CustomerLayout/       # Layout dành cho người dùng là khách hàng (Customer).
│   │   ├── MainLayout/           # Layout chính của hệ thống.
│   │   └── StatusLayout/         # Layout hiển thị các trạng thái như lỗi 404, Under construction.
│   ├── pages/                    # Chứa các components đại diện cho từng trang (views).
│   │   ├── AlertManagement/      # Trang quản lý cảnh báo.
│   │   ├── AttackSimulator/      # Trang giả lập tấn công.
│   │   ├── AuditManagement/      # Trang quản lý nhật ký hệ thống.
│   │   ├── Customer/             # Các trang dành riêng cho tài khoản Customer.
│   │   │   ├── AlertManagement/  # Trang cảnh báo của Customer.
│   │   │   ├── Dashboard/        # Dashboard của Customer.
│   │   │   ├── DeviceManagement/ # Trang thiết bị của Customer.
│   │   │   └── IncidentManagement/# Trang sự cố của Customer.
│   │   ├── Dashboard/            # Trang chủ hệ thống chung (Dashboard).
│   │   ├── DeviceManagement/     # Trang quản lý thiết bị.
│   │   └── IncidentManagement/   # Trang quản lý sự cố.
│   │   ├── Login/                # Trang đăng nhập.
│   │   ├── NotFound/             # Trang thông báo lỗi 404 (Không tìm thấy).
│   │   ├── Register/             # Trang đăng ký.
│   │   ├── RuleManagement/       # Trang cấu hình luật cảnh báo.
│   │   └── UnderConstruction/    # Trang thông báo tính năng đang bảo trì / xây dựng.
│   │   └── UserManagement/       # Trang quản lý người dùng.
│   ├── routes/                   # Định nghĩa hệ thống định tuyến (routing) của ứng dụng.
│   │   └── AppRoutes.jsx         # File tổng hợp và khai báo toàn bộ Router (React Router).
│   ├── sections/                 # Chứa các vùng/khối giao diện phức tạp tách ra từ Page.
│   │   ├── AlertManagement/      # Các section của trang cảnh báo.
│   │   ├── AttackSimulator/      # Các section của giả lập tấn công.
│   │   ├── AuditManagement/      # Các section nhật ký hệ thống.
│   │   ├── Dashboard/            # Các section của Dashboard.
│   │   ├── DeviceManagement/     # Các section của thiết bị.
│   │   └── IncidentManagement/   # Các section sự cố.
│   │   ├── Layout/               # Các block giao diện cho Layout (Header, Sidebar).
│   │   │   ├── Customer/         # Sidebar, header của customer.
│   │   │   │   ├── Header/
│   │   │   │   └── Sidebar/
│   │   │   ├── Header/           # Header chính.
│   │   │   └── Sidebar/          # Sidebar chính.
│   │   ├── Profile/              # Section hồ sơ cá nhân.
│   │   ├── RuleManagement/       # Các section của luật.
│   │   └── UserManagement/       # Các section của quản lý người dùng.
│   ├── utils/                    # Chứa các hàm tiện ích (helpers) chung.
│   │   ├── errorHandler.js       # Xử lý format lỗi chung (API Errors).
│   │   ├── formatDate.js         # Hàm định dạng chuỗi ngày tháng.
│   │   ├── loadingEvent.js       # Trình phát/lắng nghe event (EventBus) bật tắt loading.
│   │   ├── statusHelpers.js      # Map các class màu dựa theo trạng thái.
│   │   └── toast.jsx             # Cấu hình và helper gọi thông báo Toast nhanh.
│   ├── App.jsx                   # Component gốc để render ứng dụng React, bọc Providers.
│   ├── index.scss                # File chứa các style CSS/SCSS chung cho toàn cục.
│   └── main.jsx                  # File entry point (root) khởi tạo ứng dụng React (React DOM).
├── Dockerfile                    # Cấu hình Docker để build image cho frontend (Nginx/Node).
├── index.html                    # Khung HTML gốc, điểm mount cho React.
├── nginx.conf                    # File cấu hình Nginx để phục vụ frontend production.
├── package-lock.json             # File lock phiên bản thư viện (npm).
├── package.json                  # Quản lý các thư viện, dependencies của project frontend.
├── pnpm-lock.yaml                # File lock phiên bản (pnpm).
├── vite.config.js                # File cấu hình cho Vite (công cụ build và dev server).
└── vite.config.js.timestamp-*    # File cache của Vite (auto-generated).
```

## 8. Cấu trúc thư mục Backend

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
