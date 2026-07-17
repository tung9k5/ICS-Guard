# Cấu trúc thư mục Frontend

Dưới đây là cấu trúc thư mục của phần frontend trong dự án:

```text
frontend/
├── src/                      # Thư mục chứa toàn bộ mã nguồn của giao diện ứng dụng.
│   ├── App.jsx               # Component gốc để render ứng dụng React.
│   ├── main.jsx              # File entry point để khởi tạo React.
│   ├── index.scss            # File chứa các style CSS/SCSS chung cho toàn cục.
│   ├── api/                  # Chứa các định nghĩa và hàm gọi API giao tiếp với backend.
│   ├── assets/               # Chứa tài nguyên tĩnh như hình ảnh, biểu tượng, font chữ.
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
│   ├── Dialog/               # Chứa các components liên quan đến hộp thoại (modal, popup).
│   ├── hooks/                # Chứa các custom hooks React (useAuth, useFetch...).
│   ├── http/                 # Cấu hình HTTP client (như Axios), interceptors, token.
│   ├── i18n/                 # Chứa cấu hình và file ngôn ngữ phục vụ đa ngôn ngữ.
│   ├── layouts/              # Chứa các components bố cục trang (Header, Sidebar, Footer).
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
│   ├── sections/             # Chứa các vùng giao diện lớn của một trang.
│   ├── services/             # Chứa logic xử lý nghiệp vụ ở frontend.
│   └── utils/                # Chứa các hàm tiện ích (helpers) format dữ liệu, thời gian.
├── public/                   # Chứa các file tài nguyên tĩnh không cần build tool (favicon).
├── Dockerfile                # Cấu hình Docker để build image cho frontend.
├── vite.config.js            # File cấu hình cho Vite (công cụ build và dev server).
├── package.json              # Quản lý các thư viện, dependencies của project frontend.
├── package-lock.json         # File lock phiên bản (npm).
└── pnpm-lock.yaml            # File lock phiên bản (pnpm).
```
