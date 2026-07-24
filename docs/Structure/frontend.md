# Cấu trúc thư mục Frontend

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
