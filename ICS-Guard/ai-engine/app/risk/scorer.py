from typing import List
from app.core.models import Device, DeviceCVE, Alert
from app.core.constants import Severity, AlertStatus

class RiskScorer:
    """Đánh giá và cập nhật Risk Score cho thiết bị."""
    
    @staticmethod
    def calculate_risk(device: Device, cves: List[DeviceCVE], active_alerts: List[Alert]) -> float:
        """
        Tính điểm rủi ro (0 -> 100) dựa trên:
        - Điểm CVSS của các CVE (trọng số 60%)
        - Mức độ các cảnh báo chưa xử lý (trọng số 40%)
        """
        base_score = 0.0
        
        # Tính điểm từ CVEs
        if cves:
            cve_score = sum([c.cvss_score for c in cves]) / len(cves)
            # Normalize to 0-60
            base_score += (cve_score / 10.0) * 60.0
            
        # Tính điểm từ Alerts
        if active_alerts:
            alert_weight = 0.0
            for a in active_alerts:
                if a.status in [AlertStatus.NEW, AlertStatus.ACKNOWLEDGED]:
                    if a.severity == Severity.CRITICAL:
                        alert_weight += 20.0
                    elif a.severity == Severity.HIGH:
                        alert_weight += 10.0
                    elif a.severity == Severity.MEDIUM:
                        alert_weight += 5.0
                    elif a.severity == Severity.LOW:
                        alert_weight += 2.0
            
            # Capping at 40 max points for alerts
            alert_weight = min(40.0, alert_weight)
            base_score += alert_weight
            
        device.risk_score = min(100.0, base_score)
        return device.risk_score
