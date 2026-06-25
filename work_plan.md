Giai đoạn 1: 
Phân tích và Thiết kế hệ thốngMục tiêu: Thống nhất kiến trúc, luồng dữ liệu và thiết kế giao diện trước khi bắt tay vào code.
Nguyễn Trí Dũng (Backend API):Thiết kế biểu đồ thực thể liên kết (ERD) cho cơ sở dữ liệu hệ thống.  Lên khung API theo chuẩn RESTful và bắt đầu viết tài liệu Swagger/OpenAPI.  
Nguyễn Tùng Lâm (Trưởng nhóm IoT & Infra):Vẽ sơ đồ kiến trúc 4 lớp (Architecture Diagram: IoT → Collection → Analysis → Dashboard).  Nghiên cứu cấu hình mã hóa TLS 1.3 cho MQTT Broker (Mosquitto) và lên cấu trúc bucket/schema cho InfluxDB.  
Tòng Quốc Hưng (Security AI Backend):Phân tích cấu trúc các loại log thô (Syslog, JSON, CSV) để lên thiết kế chuẩn hóa định dạng (unified format).  Khảo sát các thư viện AI/ML (scikit-learn, PyTorch) phục vụ phát hiện bất thường.  
Nguyễn Hữu Thắng (Frontend):Thiết kế wireframe/mockup UI/UX cho Security Operations Dashboard.  Đánh giá và lựa chọn thư viện biểu đồ (D3.js / Recharts) cho bản đồ Topology.  
Đinh Văn Đông (Mentor):Rà soát tài liệu Requirement Specification, đảm bảo phân loại đúng Functional và Non-functional.  Kiểm tra tính hợp lý của các biểu đồ UML (Use Case, Sequence Diagram) và đánh giá tính khả thi của công nghệ.  

Giai đoạn 2: 
Phát triển Chức năng Cốt lõiMục tiêu: Xây dựng hệ thống khung, đảm bảo dữ liệu có thể đi từ thiết bị IoT giả lập lên Backend và hiển thị ra Frontend.
Nguyễn Trí Dũng:Lập trình hệ thống Auth (JWT, refresh token) và cơ chế khóa tài khoản khi có dấu hiệu brute-force.  Phát triển tính năng CRUD và phân quyền Role-Based (Admin, Analyst, Viewer).  Cài đặt Audit Log để ghi lại mọi thao tác quản trị (kèm timestamp và user agent).  
Nguyễn Tùng Lâm:Cài đặt và cấu hình Mosquitto MQTT Broker, thiết lập InfluxDB.  Viết mã Device Simulator để giả lập dữ liệu telemetry từ PLC, cảm biến.  Xây dựng Endpoint nhận log (REST API Ingestion) và module Data Validation chống replay attack.  
Tòng Quốc Hưng:Code Log Parser để chuẩn hóa các loại log đầu vào.  Xây dựng Anomaly Detector và Attack Classifier (nhận diện DDoS, Port Scan, Brute Force, MITM).  
Nguyễn Hữu Thắng:Xây dựng Bản đồ mạng lưới (Network Topology Map) hiển thị theo zone.  Vẽ các biểu đồ KPI Metrics (tổng sự kiện, cảnh báo, MTTD, MTTR).  
Đinh Văn Đông (Mentor):Theo dõi tiến độ theo tuần của Dũng, Lâm, Hưng, Thắng để đảm bảo đồ án chạy đúng mốc thời gian.  

Giai đoạn 3: 
Tích hợp & Kiểm thửMục tiêu: Kết nối toàn bộ các service, đảm bảo hệ thống phản hồi mượt mà và vượt qua các bài kiểm tra bảo mật.
Nguyễn Trí Dũng:Tích hợp hệ thống cảnh báo qua Email và Telegram Bot (có nút bấm inline).  Thiết lập cơ chế Severity Routing (Info/Medium gửi Email, High/Critical gửi Telegram).  Viết Unit Test cho các module Backend.  
Nguyễn Tùng Lâm:Viết file cấu hình docker-compose.yml để đóng gói toàn bộ hạ tầng stack.  Chạy Simulator tạo traffic giả lập và test tải để kiểm tra luồng Ingestion.  
Tòng Quốc Hưng:Hoàn thiện Rule Engine (giao diện cấu hình quy tắc) và Correlation Engine để nhận diện chuỗi sự kiện tấn công.  
Nguyễn Hữu Thắng:Tích hợp WebSocket (Socket.io) để hiển thị thông báo khẩn cấp (Alert Feed) theo thời gian thực.  Tối ưu hiệu năng để dashboard phản hồi dưới 2 giây và hiển thị tốt trên màn hình 1080p.  
Đinh Văn Đông (Mentor):Đánh giá tỷ lệ Code coverage (đảm bảo đạt tối thiểu 60%).  Giám sát việc chạy các kịch bản Integration Test và Attack Simulation.  

Giai đoạn 4: 
Tính năng Nâng cao (Khuyến khích)Mục tiêu: Tập trung phát triển các chức năng khó (Module 4, 7) để lấy điểm "Giỏi" hoặc "Xuất sắc".  
Nguyễn Trí Dũng:Tích hợp tính năng Auto Block IP (gọi API firewall) và Device Isolation (gọi API switch) khi rule bị vi phạm.  
Nguyễn Tùng Lâm:Nghiên cứu và triển khai dự án lên nền tảng Cloud (AWS, GCP, hoặc Azure) có bảo mật HTTPS.  
Tòng Quốc Hưng:Tích hợp API AI (GPT-4o, Claude, hoặc Ollama) làm Trợ lý bảo mật: giải thích log, suy luận kỹ thuật tấn công và đề xuất xử lý.  Phát triển tính năng Risk Scoring đối chiếu lỗ hổng với CVE/NVD.  
Nguyễn Hữu Thắng:Phát triển các tính năng Historical Analysis (biểu đồ xu hướng, top attacker) và Incident Timeline.  
Đinh Văn Đông (Mentor):Đánh giá độ chính xác của mô hình ML (đảm bảo F1-score > 0.8 trên tập test).  Góp ý kiến trúc để đảm bảo hệ thống Cloud hoạt động ổn định.

Giai đoạn 5: 
Đóng gói và Chuẩn bị Bảo vệMục tiêu: Hoàn thiện kết quả đầu ra (Deliverables) theo đúng quy định của trường.  
Nguyễn Trí Dũng:Rà soát và xuất API Documentation (Swagger/Postman UI) đảm bảo có thể chạy được.  Viết Script khởi tạo Database và dữ liệu mẫu (Seeder).  
Nguyễn Tùng Lâm:Làm sạch Source code trên GitHub, viết README và hướng dẫn cài đặt qua Docker (User Manual).  
Tòng Quốc Hưng & Nguyễn Hữu Thắng:Quay Video Demo (5-10 phút) các kịch bản tấn công mẫu như SSH Brute Force hoặc Traffic Spike.  
Đinh Văn Đông (Mentor):Hướng dẫn, rà soát chất lượng của Báo cáo đồ án (đảm bảo tối thiểu 40 trang, logic, chuẩn format).  Review nội dung Slide thuyết trình (tối đa 20 slide) và tập dượt các kịch bản demo bảo vệ cùng cả nhóm.  