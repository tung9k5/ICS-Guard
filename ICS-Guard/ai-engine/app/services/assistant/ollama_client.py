import httpx
import os

# Docker supplies http://ollama:11434 explicitly. Direct Windows/Linux runs use
# the Ollama default port on the local machine.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

SYSTEM_PROMPTS = {
    "vi": """Ban la chuyen gia phan tich bao mat ICS/SCADA. Phan tich su co bang tieng Viet theo:
1. Anh xa MITRE ATT&CK (ma ky thuat)
2. Phan tich nguyen nhan goc re
3. De xuat khac phuc cu the""",
    "en": """You are a professional ICS/SCADA security analyst. Analyze in English:
1. MITRE ATT&CK Mapping (technique ID)
2. Root Cause Analysis
3. Specific Remediation Steps"""
}

async def analyze_incident(data: dict, language: str = "vi") -> str:
    system_prompt = SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS["vi"])
    user_prompt = f"""
Su co: {data.get('title')}
Mo ta: {data.get('description')}
Thiet bi: {data.get('device_name')} (IP: {data.get('device_ip')})
Telemetry: {data.get('telemetry', {})}
    """
    try:
        timeout = httpx.Timeout(120.0, connect=3.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": user_prompt,
                      "system": system_prompt, "stream": False}
            )
            resp.raise_for_status()
            analysis = resp.json().get("response", "").strip()
            if analysis:
                return analysis
            raise ValueError("Ollama returned an empty analysis")
    except Exception as e:
        # A temporary Ollama outage must not leave the operator without a safe
        # remediation path. Keep the technical error in service logs and return
        # an incident-aware deterministic recommendation to the dashboard.
        print(f"[AI Engine] Ollama unavailable at {OLLAMA_URL}: {e}")
        return build_fallback_recommendation(data, language)


def build_fallback_recommendation(data: dict, language: str = "vi") -> str:
    """Return safe incident-response guidance when the local LLM is unavailable."""
    title = str(data.get("title") or "")
    description = str(data.get("description") or "")
    context = f"{title} {description}".lower()
    device_name = data.get("device_name") or "thiết bị chưa xác định"
    device_ip = data.get("device_ip") or "chưa xác định"

    if language != "vi":
        return (
            "Fallback remediation (local LLM is unavailable).\n"
            f"Affected asset: {device_name} ({device_ip}).\n"
            "1. Keep the device isolated and preserve logs/configuration.\n"
            "2. Identify the entry point, remove unauthorized changes, and patch the root cause.\n"
            "3. Validate configuration, credentials, firmware, and clean telemetry in a test zone.\n"
            "4. Restore connectivity gradually and monitor closely; re-isolate on recurrence."
        )

    if any(keyword in context for keyword in ("brute force", "đăng nhập", "login", "credential", "xác thực")):
        technique = "MITRE ATT&CK T1110 - Brute Force"
        cause = "Có dấu hiệu thử thông tin xác thực nhiều lần hoặc tài khoản/khóa truy cập đã bị lộ."
        actions = [
            "Khóa phiên và tài khoản nghi vấn; đổi mật khẩu, khóa API hoặc chứng thư liên quan.",
            "Rà soát nhật ký đăng nhập, IP nguồn và quyền của tài khoản bị tác động; chặn nguồn tấn công.",
            "Bật giới hạn số lần đăng nhập, MFA nếu thiết bị hỗ trợ và chỉ cho phép truy cập từ mạng quản trị."
        ]
    elif any(keyword in context for keyword in ("flood", "ddos", "dos", "traffic", "lưu lượng", "packet rate")):
        technique = "MITRE ATT&CK for ICS T0814 - Denial of Service"
        cause = "Lưu lượng hoặc tần suất yêu cầu vượt ngưỡng vận hành, có khả năng làm cạn tài nguyên thiết bị."
        actions = [
            "Xác định IP/port/protocol nguồn và áp dụng rate-limit hoặc ACL tại gateway của zone.",
            "Kiểm tra CPU, RAM, hàng đợi kết nối và dịch vụ OT; dừng các phiên hoặc tiến trình bất thường.",
            "Đối chiếu lưu lượng với baseline trước khi mở lại kết nối sản xuất."
        ]
    elif any(keyword in context for keyword in ("logic", "tamper", "modbus", "register", "plc", "ghi trái phép")):
        technique = "MITRE ATT&CK for ICS T0836 - Modify Parameter"
        cause = "Logic điều khiển, thanh ghi hoặc tham số vận hành có thể đã bị thay đổi trái phép."
        actions = [
            "Sao lưu trạng thái hiện tại để điều tra, sau đó so sánh logic/cấu hình với bản chuẩn đã phê duyệt.",
            "Khôi phục chương trình và tham số từ bản sao lưu tin cậy; đổi khóa/mật khẩu kỹ thuật.",
            "Kiểm thử liên động an toàn và giá trị I/O trong zone thử nghiệm trước khi nối lại mạng."
        ]
    elif any(keyword in context for keyword in ("cve", "vulnerability", "lỗ hổng", "firmware", "exploit")):
        technique = "MITRE ATT&CK for ICS T0882 - Exploitation for Client Execution"
        cause = "Thiết bị hoặc dịch vụ có thể đang dùng firmware/phần mềm chứa lỗ hổng có khả năng khai thác."
        actions = [
            "Xác minh mã CVE, phiên bản firmware/phần mềm và khuyến cáo chính thức của nhà sản xuất.",
            "Sao lưu cấu hình rồi cài bản vá hoặc firmware đã được kiểm tra; nếu chưa vá được, áp dụng ACL/virtual patching.",
            "Quét lại lỗ hổng và xác nhận dịch vụ không cần thiết đã được tắt."
        ]
    else:
        technique = "MITRE ATT&CK for ICS - Cần xác minh thêm từ log và telemetry"
        cause = "Dữ liệu hiện có cho thấy hành vi bất thường nhưng chưa đủ để kết luận một nguyên nhân duy nhất."
        actions = [
            "Giữ thiết bị trong trạng thái cô lập và lưu lại log, telemetry, cấu hình cùng mốc thời gian sự cố.",
            "So sánh firmware, tiến trình, tài khoản, kết nối và cấu hình với baseline vận hành bình thường.",
            "Loại bỏ thay đổi trái phép, cập nhật bản vá phù hợp và đổi thông tin xác thực có nguy cơ lộ."
        ]

    action_text = "\n".join(f"{index}. {action}" for index, action in enumerate(actions, start=1))
    return (
        "KHUYẾN NGHỊ DỰ PHÒNG (Ollama chưa sẵn sàng)\n\n"
        f"Thiết bị: {device_name} (IP: {device_ip})\n"
        f"Ánh xạ tham khảo: {technique}\n"
        f"Nhận định: {cause}\n\n"
        "Các bước khắc phục:\n"
        f"{action_text}\n\n"
        "Điều kiện bắt buộc trước khi khôi phục:\n"
        "- Xác nhận nguyên nhân gốc hoặc biện pháp giảm thiểu đã được áp dụng.\n"
        "- Kiểm tra cấu hình/firmware và chạy thử trong vùng cách ly.\n"
        "- Chỉ kết nối lại từng bước, giám sát telemetry và tự cô lập lại nếu bất thường tái diễn."
    )
