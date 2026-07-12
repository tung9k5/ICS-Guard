# Kịch Bản Thuyết Trình & Demo Hệ Thống ICS-Guard (Cá Nhân Hóa Chức Năng)
> **Tài liệu hướng dẫn phân vai chi tiết: Mỗi thành viên tự thuyết trình và demo thực tế các chức năng do mình tự đảm nhiệm.**

Để thuận tiện cho việc đánh giá năng lực của từng thành viên trước lớp, kịch bản dưới đây được thiết kế để **mỗi thành viên tự trình bày lý thuyết/mã nguồn và tự thực hiện demo trực tiếp** các chức năng mà mình đã phát triển theo đúng phân chia trong [work_plan.md](file:///d:/New%20folder/ICS-Guard/docs/work_plan.md).

---

## 👥 THÀNH VIÊN BAN DỰ ÁN & CHỨC NĂNG PHỤ TRÁCH
1. **Nguyễn Tùng Lâm**: IoT & Infrastructure (Thiết lập Docker, Broker TLS 1.3, Simulator)
2. **Nguyễn Trí Dũng**: Backend API & Security Gateway (JWT Auth, RBAC, Audit Log, Alert Dispatcher)
3. **Tòng Quốc Hưng**: Security AI Backend (Log Parser, ML Detector, Rule Engine, AI Assistant)
4. **Nguyễn Hữu Thắng**: SOC Frontend Dashboard (React UI, Topology Map, WebSocket Alert Feed)

---

## 📊 TỔNG QUAN HIỆN TRẠNG HỆ THỐNG (ĐÃ LÀM & CHƯA LÀM)

Dưới đây là bảng đánh giá hiện trạng tiến độ toàn hệ thống để thầy cô và cả lớp có cái nhìn tổng quan trước khi đi vào chi tiết kịch bản thuyết trình:

### 🟢 Các chức năng ĐÃ HOÀN THÀNH (Sẵn sàng Demo)
* **Lớp Thu thập & Hạ tầng (IoT & Infra):**
  - Đóng gói toàn bộ 9 microservices bằng Docker Compose, chạy local ổn định qua mạng nội bộ Docker.
  - Cấu hình MQTT Broker Mosquitto bảo mật bằng **TLS 1.3** qua cổng `8883` với chứng chỉ CA tự ký.
  - Viết Python Device Simulator giả lập gửi telemetry chuẩn từ PLC, Smart Meter và Sensor.
  - Cấu hình **Retention Policy** 14 ngày cho InfluxDB để tự động dọn dẹp dung lượng.
* **Lớp API & Bảo mật (Backend API):**
  - Xây dựng hệ thống REST API hoàn thiện tích hợp xác thực **JWT**, cơ chế phân quyền **RBAC** và khóa đăng nhập Brute-force.
  - Xây dựng cơ chế **Audit Log** lưu vết mọi thao tác quản lý thiết bị/quy tắc.
  - Xác thực cấu trúc JSON Schema log nhận được và chặn tấn công phát lại (**Replay Attack**).
  - Hoàn thiện module **Severity Routing** gửi email cho sự kiện Info/Medium và tin nhắn Telegram Bot cho sự kiện High/Critical.
* **Lớp Phân tích & AI (AI & Threat Detection):**
  - Lập trình Log Parser chuẩn hóa nhiều loại log thô về dạng JSON.
  - Huấn luyện mô hình Học máy phát hiện telemetry bất thường (Anomaly Detector) và phân loại tấn công (Attack Classifier).
  - Tích hợp **Rule Engine & Correlation Engine** phát hiện tấn công theo kịch bản (ví dụ SSH Brute Force).
  - Tích hợp thành công **Trợ lý SOC ảo bằng AI (LLM)** giải thích log thô, ánh xạ khung MITRE ATT&CK, đưa ra Remediation Playbook và xuất báo cáo PDF.
* **Lớp Giao diện (Frontend SOC Dashboard):**
  - Hoàn thành giao diện Dark Mode SOC Dashboard.
  - Bản đồ **Topology Map** cập nhật động màu sắc an toàn/nguy hiểm theo trạng thái thiết bị.
  - Alert Feed cập nhật thời gian thực qua **WebSocket (Socket.io)** và các biểu đồ KPI (MTTD, MTTR).

### 🔴 Các nội dung TỒN ĐỌNG & HƯỚNG PHÁT TRIỂN (Pending / In-Progress)
* **Triển khai Cloud & HTTPS công cộng:** Hệ thống mới chỉ chạy local trên Docker Compose. Việc đưa hệ thống lên các đám mây (AWS/GCP/Azure) kèm chứng chỉ HTTPS (Let's Encrypt) qua Nginx Proxy được xếp vào hạng mục nâng cao đang tiếp tục nghiên cứu để lấy điểm xuất sắc.
* **Tối ưu hóa độ chính xác mô hình ML:** Cần thu thập thêm nhiều mẫu dữ liệu tấn công công nghiệp thực tế hơn để cải thiện độ chính xác (F1-score) của mô hình phát hiện bất thường.
* **Hoàn thiện tài liệu & Quay Video:** Đang hoàn thiện Báo cáo đồ án (>40 trang), Slide thuyết trình (<20 slide) và quay Video Demo 5-10 phút để nộp hội đồng bảo vệ.

---

## 📋 KỊCH BẢN CHI TIẾT CHO TỪNG THÀNH VIÊN

### PHẦN 1: HẠ TẦNG DOCKER, GIẢ LẬP THIẾT BỊ & BẢO MẬT MQTT TLS 1.3
* 👤 **Người trình bày & thực hiện**: **Nguyễn Tùng Lâm**
* 🛠️ **Chức năng phụ trách**: Xây dựng hạ tầng container, Mosquitto MQTT Broker TLS 1.3, Python Device Simulator, InfluxDB Retention Policy.

| Ai phải nói những gì? (Nội dung thuyết trình) | Cái đó được thực hiện ở đâu? (Thao tác & Minh họa) |
| :--- | :--- |
**1. Giới thiệu tổng quan & Hạ tầng:**<br>- Chào thầy cô và các bạn, em là Tùng Lâm. Em phụ trách thiết lập hạ tầng Docker và lớp thu thập dữ liệu IoT.<br>- Dự án **ICS-Guard** của chúng em được đóng gói hoàn toàn trong tệp [docker-compose.yml](file:///d:/New%20folder/ICS-Guard/docker-compose.yml) gồm 9 dịch vụ, giúp triển khai tức thì trên máy chủ cục bộ hoặc đám mây.<br><br>
**2. Thiết bị giả lập & Kênh truyền bảo mật MQTT TLS 1.3:**<br>- Em đã xây dựng bộ giả lập thiết bị bằng Python [simulator.py](file:///d:/New%20folder/ICS-Guard/iot/simulator/simulator.py) để mô phỏng dữ liệu telemetry từ 3 thiết bị công nghiệp thực tế: PLC, Smart Meter và Sensor.<br>- Để đảm bảo an toàn, tránh bị nghe lén dữ liệu trên đường truyền, em cấu hình MQTT Broker Mosquitto bắt buộc chạy mã hóa **TLS 1.3** trên cổng bảo mật `8883`. Client Simulator và Node.js Backend bắt buộc phải xác thực thông qua chứng chỉ CA tự ký.<br><br>
**3. Tối ưu InfluxDB:**<br>- Thiết lập cơ chế tự động cài đặt chính sách lưu trữ (**Retention Policy 14 ngày**) cho InfluxDB để dọn dẹp các telemetry cũ, tránh làm đầy đĩa cứng hệ thống. |       
**1. Thao tác trên Terminal (Dòng lệnh):**<br>- Chạy lệnh khởi động hệ thống:<br>  `docker-compose up -d --build`<br><br>
**2. Trình diễn kết nối TLS 1.3 thời gian thực:**<br>- Chạy lệnh xem log của Mosquitto:<br>  `docker-compose logs -f mosquitto`<br>  *(Show cho cả lớp dòng log xác nhận kết nối TLS 1.3 thành công: `OpenSSL connection using TLSv1.3...`)*<br>- Chạy lệnh xem log của Simulator gửi telemetry:<br>  `docker-compose logs -f simulator`<br>  *(Show log gửi dữ liệu liên tục qua cổng bảo mật 8883)*<br><br>
**3. Trỏ đường dẫn Code cấu hình:**<br>- Cấu hình TLS Broker: [mosquitto.conf](file:///d:/New%20folder/ICS-Guard/infrastructure/mosquitto/config/mosquitto.conf)<br>- Cấu hình Retention Policy: [seed_influx.js](file:///d:/New%20folder/ICS-Guard/backend/src/database/seed_influx.js) |

---

### PHẦN 2: BACKEND API, XÁC THỰC PHÂN QUYỀN & PHÂN LUỒNG CẢNH BÁO
* 👤 **Người trình bày & thực hiện**: **Nguyễn Trí Dũng**
* 🛠️ **Chức năng phụ trách**: JWT Authentication, Role-Based Access Control (RBAC), Audit Log, Email & Telegram Alert Routing.

| Ai phải nói những gì? (Nội dung thuyết trình) | Cái đó được thực hiện ở đâu? (Thao tác & Minh họa) |
| :--- | :--- |
**1. Quản lý API, Xác thực và Phân quyền:**<br>- Chào thầy cô và các bạn, em là Trí Dũng. Em phụ trách xây dựng RESTful API và đảm bảo an ninh cho hệ thống Backend.<br>- Hệ thống sử dụng cơ chế xác thực **JWT (JSON Web Token)** để bảo vệ các endpoints. Tích hợp phân quyền chi tiết (RBAC) với 3 vai trò: **Admin** (quản lý), **Analyst** (xử lý sự cố), và **Viewer** (chỉ xem dashboard).<br>- Tích hợp cơ chế khóa tài khoản đăng nhập tạm thời nếu phát hiện dấu hiệu tấn công Brute-force mật khẩu.<br><br>
**2. Audit Log (Ghi vết hoạt động):**<br>- Mọi hoạt động cấu hình hệ thống (như tạo rule mới, xóa thiết bị, thay đổi quyền) đều được ghi lại trong bảng Audit Log kèm timestamp, IP nguồn và User Agent của trình duyệt để phục vụ điều tra sự cố.<br><br>
**3. Phân luồng cảnh báo đa kênh (Severity Routing):**<br>- Em đã xây dựng module cảnh báo tự động:<br>  - Các sự kiện có độ nghiêm trọng thấp/trung bình (Info/Medium) sẽ tự động gửi email thông báo.<br>  - Các sự cố khẩn cấp (High/Critical) sẽ gửi tin nhắn khẩn cấp qua **Telegram Bot** kèm theo các nút bấm hành động nhanh giúp đội ứng cứu phản ứng lập tức. | 
**1. Thao tác trên Swagger UI:**<br>- Truy cập [http://localhost:8000/docs](http://localhost:8000/docs).<br>- Thực hiện gọi API đăng nhập (`POST /api/auth/login`) bằng tài khoản Analyst để nhận token JWT.<br>- Copy token nạp vào nút `Authorize` trên Swagger để chạy thử một API quản lý thiết bị.<br><br>
**2. Trình diễn Audit Log:**<br>- Mở MongoDB Compass, kết nối tới Database và truy xuất bảng `audit_logs` để cho thầy cô xem các dòng log thao tác được lưu trữ.<br><br>
**3. Trình diễn Kênh cảnh báo:**<br>- Show mã nguồn cấu hình gửi email SMTP tại [emailService.js](file:///d:/New%20folder/ICS-Guard/backend/src/services/emailService.js) và Telegram Bot tích hợp nút phản ứng nhanh tại [telegramService.js](file:///d:/New%20folder/ICS-Guard/backend/src/services/telegramService.js).<br>- *(Telegram Bot sẽ được kích hoạt gửi tin nhắn trực tiếp ở phần demo sự cố tiếp theo)* |

---

### PHẦN 3: PHÂN TÍCH LOG, PHÁT HIỆN TẤN CÔNG & TRỢ LÝ AN NINH AI
* 👤 **Người trình bày & thực hiện**: **Tòng Quốc Hưng**
* 🛠️ **Chức năng phụ trách**: Log Parser & Normalizer, Anomaly Detector (Học máy), Rule Engine, AI Security Assistant.

| Ai phải nói những gì? (Nội dung thuyết trình) | Cái đó được thực hiện ở đâu? (Thao tác & Minh họa) |
| :--- | :--- |
**1. Chuẩn hóa Log & Rule Engine:**<br>- Chào thầy cô và các bạn, em là Quốc Hưng. Em đảm nhiệm lớp phân tích sự cố bảo mật.<br>- Hệ thống sử dụng Log Parser để đọc logs thô từ RabbitMQ và chuẩn hóa về cấu trúc JSON chung.<br>- Em xây dựng **Rule Engine & Correlation Engine** để so khớp dữ liệu theo thời gian thực (ví dụ quy tắc: nếu phát hiện IP gửi liên tiếp > 10 bản tin đăng nhập thất bại `AUTH_FAILED` trong 1 phút, hệ thống sẽ kích hoạt phản ứng tự động).<br><br>
**2. Phát hiện bất thường bằng Học máy (Machine Learning):**<br>- Sử dụng mô hình Machine Learning phát hiện bất thường (Anomaly Detection) để nhận diện các thay đổi telemetry đột ngột ngoài tầm kiểm soát của quy tắc thông thường (như lưu lượng mạng tăng đột biến).<br><br>
**3. Trợ lý SOC ảo bằng AI (AI Security Assistant):**<br>- Em đã tích hợp API mô hình ngôn ngữ lớn (LLM) để làm trợ lý bảo mật ảo. AI sẽ giúp giải thích các đoạn log thô khó hiểu, đối chiếu sự cố với cơ sở dữ liệu **MITRE ATT&CK** và đề xuất quy trình Remediation Playbook để khắc phục sự cố, sau đó tự động xuất báo cáo sự cố PDF. | 
**1. Thao tác trên Web Dashboard:**<br>- Mở màn hình quản trị Rule để chỉ ra các luật an ninh được cấu hình động.<br><br>
**2. Trình diễn tính năng AI Assistant:**<br>- Mở giao diện Dashboard tại [http://localhost:3000](http://localhost:3000).<br>- Chọn một sự cố đang có trên bảng giám sát, nhấn nút **"Ask AI Assistant"**.<br>- Trình diễn phản hồi của AI giải thích chi tiết log thô, chiến thuật tấn công và các khuyến nghị xử lý bằng tiếng Việt.<br>- Nhấn nút xuất báo cáo sự cố để tải xuống tệp PDF phân tích sự cố.<br><br>
**3. Trỏ đường dẫn Code xử lý:**<br>- Xem code phân tích log và correlation: [securityService.js](file:///d:/New%20folder/ICS-Guard/backend/src/services/securityService.js) |

---

### PHẦN 4: GIAO DIỆN SOC DASHBOARD & TRỰC QUAN HÓA THỜI GIAN THỰC
* 👤 **Người trình bày & thực hiện**: **Nguyễn Hữu Thắng**
* 🛠️ **Chức năng phụ trách**: Thiết kế giao diện SOC Dashboard (React, Tailwind), Bản đồ Topology Map, KPI Metrics, WebSocket Alerts.

| Ai phải nói những gì? (Nội dung thuyết trình) | Cái đó được thực hiện ở đâu? (Thao tác & Minh họa) |
| :--- | :--- |
**1. Thiết kế Giao diện SOC Dashboard:**<br>- Chào thầy cô và các bạn, em là Hữu Thắng. Em chịu trách nhiệm thiết kế và phát triển giao diện giám sát SOC Dashboard bằng ReactJS và Tailwind CSS.<br>- Dashboard được tối ưu hiển thị trên màn hình lớn của phòng vận hành an ninh (SOC) với giao diện tối (Dark mode) hiện đại, giảm mỏi mắt cho điều phối viên.<br><br>
**2. Bản đồ Topology Map động:**<br>- Em đã trực quan hóa sơ đồ mạng lưới thiết bị (**Topology Map**) phân chia theo các phân vùng mạng (Control Zone, Process Zone, DMZ).<br>- Các Node thiết bị trên bản đồ thay đổi màu sắc động theo trạng thái bảo mật thời gian thực:<br>  - **Xanh**: An toàn/Bình thường.<br>  - **Vàng**: Cảnh báo bất thường (do mô hình ML phát hiện).<br>  - **Đỏ**: Thiết bị đang bị tấn công hoặc đang bị Cách ly (`Quarantined`).<br><br>
**3. Kết nối WebSocket thời gian thực (Real-time Feed):**<br>- Giao diện sử dụng **Socket.io** để kết nối trực tiếp với Backend. Khi có sự cố mới, dòng sự kiện an ninh (Alert Feed) sẽ tự động xuất hiện trên màn hình tức thời dưới 2 giây mà không cần tải lại trang. Các biểu đồ KPI thống kê sự cố (MTTD, MTTR) cũng tự động cập nhật. | 
**1. Thao tác trên Trình duyệt Web:**<br>- Truy cập giao diện chính [http://localhost:3000](http://localhost:3000).<br>- Di chuột vào các Node thiết bị trên bản đồ Topology Map để hiển thị tooltip thông tin chi tiết (Tên thiết bị, IP, Zone, các chỉ số đo lường như CPU, Nhiệt độ, Băng thông).<br>- Thu nhỏ/Phóng to bản đồ Topology để thể hiện tính năng responsive và thiết kế linh hoạt.<br>- Chỉ lên khu vực **Alert Feed** ở góc màn hình và các biểu đồ KPI (vẽ bằng thư viện Recharts) để chứng minh tính trực quan của giao diện.<br><br>
**2. Trỏ đường dẫn mã nguồn Frontend:**<br>- Show cấu trúc thư mục giao diện React tại `/frontend/src/` để minh họa tính tổ chức của code. |

---

## 🎬 KỊCH BẢN CHẠY LIVE DEMO PHỐI HỢP
> Để kết thúc buổi thuyết trình thuyết phục nhất, cả nhóm sẽ phối hợp chạy trực tiếp 2 kịch bản tấn công mẫu trước lớp để chứng minh toàn bộ hệ thống hoạt động trơn tru từ đầu tới cuối.

### 🔴 Kịch bản Demo 1: Tấn công SSH Brute Force & Tự động Cô lập Thiết bị
* **Người thực hiện:** **Tùng Lâm** (Kích hoạt tấn công) ➡️ **Trí Dũng & Quốc Hưng** (Backend/Rule xử lý & bắn Telegram) ➡️ **Hữu Thắng** (Dashboard hiển thị)

1. **Lâm** thao tác: Mở terminal chạy lệnh tấn công giả lập SSH Brute Force vào `PLC_01` (hoặc nhấn nút trên Attacker Console):
   ```bash
   python iot/simulator/attacks/brute_force.py --target PLC_01
   ```
2. **Thắng** hướng màn hình chiếu lên SOC Dashboard: Cả lớp sẽ thấy Node `PLC_01` trên bản đồ Topology lập tức đổi sang màu **Đỏ nhấp nháy**, đồng thời một cảnh báo khẩn cấp màu đỏ xuất hiện trên đầu Alert Feed: *"Critical: PLC_01 bị tấn công SSH Brute Force!"*.
3. **Hưng** giải thích: Backend phát hiện số log đăng nhập sai từ cùng một IP vượt quá ngưỡng quy tắc (10 lần/phút) nên Rule Engine đã kích hoạt hành động phản ứng tự động (Auto-Response): Thay đổi trạng thái PLC_01 thành cách ly (`Quarantined`) và giả lập gọi API tường lửa chặn IP tấn công.
4. **Dũng** mở điện thoại/màn hình ứng dụng Telegram: Cho thầy cô thấy tin nhắn khẩn cấp từ Telegram Bot hiển thị thông tin sự cố kèm nút bấm `[Mở chặn IP]`. Dũng bấm nút `[Mở chặn IP]` trực tiếp trên Telegram, **Thắng** chỉ lên Dashboard thấy Node `PLC_01` lập tức chuyển lại màu **Xanh**.

---

### 🟡 Kịch bản Demo 2: Đột biến Lưu lượng Telemetry (Traffic Spike Anomaly)
* **Người thực hiện:** **Tùng Lâm** (Tạo đột biến) ➡️ **Quốc Hưng** (ML phát hiện & Hỏi AI) ➡️ **Hữu Thắng** (Trực quan hóa biểu đồ)

1. **Lâm** thao tác: Kích hoạt kịch bản đột biến lưu lượng (Traffic Spike) trên thiết bị cảm biến `Sensor_02`, đẩy băng thông tăng vọt gấp 8 lần mức bình thường.
2. **Thắng** chỉ lên Dashboard: Node `Sensor_02` chuyển sang màu **Vàng (Warning)**. Biểu đồ lưu lượng băng thông Recharts xuất hiện đỉnh nhọn vọt lên cao. Sự cố được ghi nhận vào Incident Timeline.
3. **Hưng** giải thích: Mô hình Machine Learning phát hiện chỉ số này vượt quá độ lệch chuẩn cho phép (Anomaly). 
4. **Hưng** thao tác: Bấm trực tiếp vào sự cố trên Dashboard, bấm nút **"Ask AI Assistant"** ➡️ Màn hình hiển thị câu trả lời của Trợ lý AI phân tích bản ghi log thô, giải thích nguyên nhân và đề xuất phương án xử lý lỗi. Hưng nhấn nút xuất báo cáo sự cố PDF để tải về tệp báo cáo hoàn chỉnh.

---

> [!IMPORTANT]
> **Lưu ý quan trọng cho cả nhóm khi Demo trước lớp:**
> 1. Phải chạy lệnh `docker-compose up -d --build` và chạy các script khởi tạo database mẫu (`seed_local.js`, `seed_influx.js`) từ trước khi bắt đầu thuyết trình để tránh lỗi kết nối cơ sở dữ liệu.
> 2. Đảm bảo máy thuyết trình có kết nối Internet hoạt động để Telegram Bot và API AI Assistant có thể phản hồi bình thường.
