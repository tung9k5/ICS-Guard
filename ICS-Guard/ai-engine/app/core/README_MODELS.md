# Hướng Dẫn Sử Dụng Models & Constants

Thư mục `app/core` chứa định nghĩa cấu trúc dữ liệu chung được sử dụng trong toàn bộ module AI Engine, dựa trên `database_design.md`. Các định nghĩa này sử dụng **Pydantic** để xác thực dữ liệu chặt chẽ và an toàn, đồng thời sử dụng **Python Enums** cho các hằng số.

## 1. Cài đặt Dependencies

Trước khi sử dụng, cần cài đặt các thư viện yêu cầu:

```bash
pip install pydantic "pydantic[email]"
```

## 2. Cách Gọi và Sử Dụng Constants

Tất cả các hằng số và loại (enum) được định nghĩa trong `app/core/constants.py`. Nên import từ đây thay vì dùng hardcode chuỗi.

**Ví dụ:**

```python
from app.core.constants import DeviceType, Severity, AlertStatus

# Sử dụng enum cho logic so sánh hoặc gán giá trị
my_device_type = DeviceType.PLC
alert_severity = Severity.CRITICAL

if alert_severity == Severity.CRITICAL:
    print("Cảnh báo mức độ nghiêm trọng cao!")
```

## 3. Cách Sử Dụng Models (Pydantic)

Các model được định nghĩa trong `app/core/models.py`. Pydantic sẽ tự động ép kiểu và xác thực dữ liệu khi bạn khởi tạo object.

**Ví dụ: Khởi tạo dữ liệu từ Dict (Thường từ kết nối Database hoặc API Request)**

```python
from datetime import datetime
from app.core.models import Device
from app.core.constants import DeviceType, DeviceStatus

# Dữ liệu mẫu nhận từ MongoDB
device_data = {
    "_id": "plc-factory-01",
    "name": "PLC Điều Khiển Trạm Trộn Số 3",
    "type": "plc",
    "zone": "Zone A - Nhà máy số 3",
    "ip_address": "192.168.10.15",
    "mac_address": "00:1A:2B:3C:4D:5E",
    "status": "online",
    "risk_score": 75.5,
    "api_key": "sec_key_e3b0c44298fc1c149afbf4c8996fb924",
    "baseline_metrics": {
        "bytes_per_second_max": 25000,
        "connection_rate_max": 20
    },
    "firmware_version": "v2.4.1",
    "hardware_model": "Siemens S7-1200",
    "created_at": datetime.utcnow(),
    "updated_at": datetime.utcnow()
}

# Tự động map dữ liệu và kiểm tra kiểu
device = Device(**device_data)

# Trường `_id` từ Mongo sẽ được map thành `id` trong code Python
print(device.id)  # plc-factory-01
print(device.type)  # DeviceType.PLC

# Xuất ngược lại ra dict để lưu vào MongoDB
device_dict = device.dict(by_alias=True) # by_alias=True sẽ giữ nguyên key là `_id` thay vì `id`
```

## 4. Chú ý về Bảo Mật

- **Không tự định nghĩa lại schema**: Mọi luồng xử lý AI (phân tích, sinh log, cảnh báo...) đều phải import model từ đây, đảm bảo hệ thống không bị crash do sai kiểu.
- **Xác thực tự động**: Thuộc tính như `EmailStr` hoặc ràng buộc điểm CVSS (`ge=0, le=10`) đã được thiết lập sẵn ở cấp model, nên nếu dữ liệu sai lệch (ví dụ điểm CVSS = 15) thì Pydantic sẽ ném ra lỗi `ValidationError` ngay lập tức trước khi chạy vào hàm chính.
