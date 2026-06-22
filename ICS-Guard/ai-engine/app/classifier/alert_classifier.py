from app.core.models import Alert
from app.core.constants import Severity

class AlertClassifier:
    """Phân loại và điều chỉnh mức độ nghiêm trọng của Alert."""
    
    CRITICAL_KEYWORDS = ["brute force", "xâm nhập", "malware", "ransomware", "backdoor"]
    HIGH_KEYWORDS = ["đột biến", "tăng cao", "anomaly", "từ chối dịch vụ", "dos"]

    @staticmethod
    def classify_severity(alert: Alert) -> Alert:
        """Đọc title và description để chuẩn hóa Severity."""
        text = f"{alert.title} {alert.description}".lower()
        
        # Simple rule-based classification (can be replaced by ML models)
        if any(kw in text for kw in AlertClassifier.CRITICAL_KEYWORDS):
            alert.severity = Severity.CRITICAL
        elif any(kw in text for kw in AlertClassifier.HIGH_KEYWORDS):
            alert.severity = Severity.HIGH
            
        return alert
