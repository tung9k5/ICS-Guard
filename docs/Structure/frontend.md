# Cấu trúc thư mục Frontend

Dưới đây là cấu trúc thư mục của phần frontend trong dự án:

```text
frontend/
├── src/                      # Thư mục chứa toàn bộ mã nguồn của giao diện ứng dụng.
│   ├── App.jsx               # Component gốc để render ứng dụng React.
│   ├── main.jsx              # File entry point để khởi tạo React.
│   ├── index.scss            # File chứa các style CSS/SCSS chung cho toàn cục.
│   ├── api/                  # Chứa các định nghĩa và hàm gọi API giao tiếp với backend.
│   │   ├── alerts.js
│   │   ├── attacks.js
│   │   ├── audit.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── device.js
│   │   ├── incidents.js
│   │   ├── rules.js
│   │   └── users.js
│   ├── assets/               # Chứa tài nguyên tĩnh như hình ảnh, biểu tượng, font chữ.
│   │   ├── base_color.scss
│   │   └── fonts/
│   ├── components/           # Chứa các UI components dùng chung.
│   │   ├── ActionMenu/
│   │   ├── DraggableChatbot/
│   │   ├── GlobalLoading/
│   │   ├── LanguageSwitcher/
│   │   ├── VButton/
│   │   ├── VCheckbox/
│   │   ├── VDialog/
│   │   ├── VFilterPage/
│   │   ├── VHeaderPage/
│   │   ├── VInput/
│   │   ├── VNoData/
│   │   ├── VPagination/
│   │   ├── VSelectFilter/
│   │   ├── VStatus/
│   │   ├── VTextarea/
│   │   └── Viewlogo/
│   ├── constants/            # Chứa các hằng số, thông báo, enum dùng chung.
│   │   ├── alertConstants.js
│   │   ├── chatbotConstants.js
│   │   ├── deviceConstants.js
│   │   ├── idleTimeoutConstants.js
│   │   ├── ruleConstants.js
│   │   └── uiConstants.js
│   ├── Dialog/               # Chứa các components liên quan đến hộp thoại (modal, popup).
│   │   ├── DeleteConfirmModal/
│   │   └── IdleTimeout/
│   ├── hooks/                # Chứa các custom hooks React (useAuth, useFetch...).
│   │   └── useAuth.js
│   │   └── useLoader.js
│   ├── http/                 # Cấu hình HTTP client (như Axios), interceptors, token.
│   │   └── clients/
│   ├── i18n/                 # Chứa cấu hình và file ngôn ngữ phục vụ đa ngôn ngữ.
│   │   ├── config.js
│   │   └── locales/
│   │       ├── vi.json
│   │       └── en.json 
│   ├── layouts/              # Chứa các components bố cục trang (Header, Sidebar, Footer).
│   │   ├── AuthLayout/
│   │   ├── CustomerLayout/
│   │   ├── MainLayout/
│   │   └── StatusLayout/
│   ├── pages/                # Chứa các components đại diện cho từng trang (views).
│   │   ├── AlertManagement/
│   │   ├── AttackSimulator/
│   │   ├── AuditManagement/
│   │   ├── Customer/
│   │   ├── Dashboard/
│   │   ├── DeviceManagement/
│   │   ├── IncidentManagement/
│   │   ├── Login/
│   │   ├── NotFound/
│   │   ├── Register/
│   │   ├── RuleManagement/
│   │   ├── UnderConstruction/
│   │   └── UserManagement/
│   ├── routes/               # Định nghĩa hệ thống định tuyến (routing) của ứng dụng.
│   │   └── AppRoutes.jsx
│   ├── sections/             # Chứa các vùng giao diện lớn của một trang.
│   │   ├── AlertManagement/
│   │   ├── AttackSimulator/
│   │   ├── AuditManagement/
│   │   ├── Dashboard/
│   │   ├── DeviceManagement/
│   │   ├── IncidentManagement/
│   │   ├── Layout/
│   │   ├── Profile/
│   │   ├── RuleManagement/
│   │   └── UserManagement/
│   ├── services/             # Chứa logic xử lý nghiệp vụ ở frontend.
│   │   └── api.js
│   └── utils/                # Chứa các hàm tiện ích (helpers) format dữ liệu, thời gian.
│       ├── formatDate.js
│       ├── loadingEvent.js
│       └── toast.jsx
├── public/                   # Chứa các file tài nguyên tĩnh không cần build tool (favicon).
├── Dockerfile                # Cấu hình Docker để build image cho frontend.
├── vite.config.js            # File cấu hình cho Vite (công cụ build và dev server).
├── package.json              # Quản lý các thư viện, dependencies của project frontend.
├── package-lock.json         # File lock phiên bản (npm).
└── pnpm-lock.yaml            # File lock phiên bản (pnpm).
```
