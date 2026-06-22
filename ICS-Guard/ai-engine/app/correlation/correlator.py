from typing import List, Optional
from datetime import datetime
from app.core.models import Alert, Incident
from app.core.constants import Severity, IncidentStatus

class AlertCorrelator:
    """Gộp các cảnh báo liên quan thành Incident."""
    
    @staticmethod
    def correlate_to_incident(alerts: List[Alert], incident_title: str) -> Optional[Incident]:
        if not alerts:
            return None
            
        # Thu thập thông tin
        device_ids = list(set([a.device_id for a in alerts]))
        alert_ids = [a.id for a in alerts if a.id is not None]
        
        # Chọn mức severity cao nhất
        severity_ranks = {
            Severity.INFO: 1,
            Severity.LOW: 2,
            Severity.MEDIUM: 3,
            Severity.HIGH: 4,
            Severity.CRITICAL: 5
        }
        
        max_severity = Severity.INFO
        for a in alerts:
            if severity_ranks[a.severity] > severity_ranks[max_severity]:
                max_severity = a.severity
                
        # Tổng hợp description
        descriptions = [a.title for a in alerts]
        combined_desc = "Tự động gộp Incident từ các cảnh báo: " + ", ".join(descriptions)
        
        return Incident(
            title=f"{incident_title} trên thiết bị {', '.join(device_ids)}",
            description=combined_desc,
            status=IncidentStatus.OPEN,
            severity=max_severity,
            alert_ids=alert_ids, # Sẽ rỗng nếu chưa insert DB
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
