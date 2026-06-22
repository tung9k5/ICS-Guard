# ICS-Guard AI Engine

Đây là phân hệ lõi chịu trách nhiệm phân tích bảo mật bằng Trí Tuệ Nhân Tạo (AI) và Học Máy (Machine Learning) cho hệ thống giám sát SCADA/ICS. AI Engine hoạt động hoàn toàn độc lập, giao tiếp thông qua **FastAPI REST API** và sử dụng **Ollama** để chạy các Large Language Models (LLM) nội bộ, đảm bảo tính bảo mật dữ liệu mạng OT (không cần gọi API ra Internet).

## 1. Cấu Trúc Thư Mục Chuẩn

- `app/core/`: Chứa định nghĩa toàn bộ **Pydantic Models** và **Constants** (dựa trên cấu trúc CSDL) để đảm bảo an toàn kiểu dữ liệu (Type Safety) cho toàn hệ thống.
- `app/parser/`: Chuyển đổi dữ liệu thô (JSON, log hệ thống, telemetry) thành các chuẩn Object Pydantic.
- `app/anomaly/`: Phân tích Telemetry và Network Traffic, kiểm tra các bất thường (Ví dụ: CPU > 90% hoặc lưu lượng tăng đột biến) để sinh `Alert`.
- `app/classifier/`: Phân tích và dự đoán mức độ nghiêm trọng (Severity) của các `Alert` dựa trên từ khoá.
- `app/correlation/`: (Rule Engine) Gộp nhiều `Alert` đơn lẻ có liên quan trên cùng thiết bị thành một Sự cố tổng hợp (`Incident`).
- `app/risk/`: Tính điểm rủi ro an toàn thông tin (`risk_score`) cho một thiết bị dựa trên CVE và Alert.
- `app/assistant/`: Giao tiếp với **Ollama LLM** để dịch nghĩa log và đề xuất cách xử lý tự động (Remediation).
- `tests/`: Chứa các script giả lập kịch bản chạy toàn bộ pipeline.
- `main.py`: File entrypoint mở cổng API (FastAPI) để Backend hoặc các nền tảng thứ 3 gọi tới AI Engine.

---

## 2. Hướng Dẫn Cài Đặt (Setup Môi Trường)

### Bước 1: Yêu cầu phần mềm
- **Python**: Phiên bản 3.10 trở lên.
- **Ollama**: Nền tảng chạy AI cục bộ. Tải và cài đặt tại [ollama.com](https://ollama.com/).

### Bước 2: Cài đặt thư viện Python
Mở Terminal/CMD, trỏ tới thư mục `ai-engine` và cài đặt các thư viện cần thiết qua `requirements.txt` (tôi vừa tạo sẵn):

```bash
cd d:\Deadline\ICS-Guard\ICS-Guard\ai-engine
pip install -r requirements.txt
```
*(Bao gồm: `fastapi`, `uvicorn`, `pydantic`, `requests`, v.v...)*

---

## 3. Cài đặt Model AI (Local LLM)

AI Engine sử dụng **Ollama** để phân tích. Bạn cần khởi chạy Ollama và pull model về trước khi chạy ứng dụng. Model mặc định được thiết lập là `llama3.1:latest`.

Mở một cửa sổ Terminal/CMD **mới** và chạy lệnh:

```bash
ollama run llama3.1
```
*Lưu ý: Lần đầu tiên chạy, hệ thống sẽ mất vài phút để tải bộ trọng số (Weights) của model về máy.*

---

## 4. Cách Khởi Chạy Ứng Dụng

Sau khi các thư viện và mô hình AI đã sẵn sàng, bạn có 2 cách để chạy:

### Cách 1: Chạy API Server (Chế độ thật)
Để Backend Node.js hoặc các dịch vụ khác có thể đẩy dữ liệu vào cho AI phân tích, chạy lệnh:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Server sẽ chạy ở địa chỉ `http://localhost:8000`.

- **Swagger UI / API Docs**: Truy cập vào `http://localhost:8000/docs` trên trình duyệt để thấy giao diện Web quản lý API, nơi bạn có thể gửi thẳng file JSON vào hàm `POST /api/v1/analyze` để test thử nghiệm mà không cần code Backend.
