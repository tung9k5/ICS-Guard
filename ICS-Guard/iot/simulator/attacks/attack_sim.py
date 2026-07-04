import asyncio

async def run_attack_continuous(device_id, attack_type, device_anomaly_states):
    """Kích hoạt cuộc tấn công tương ứng cho thiết bị mục tiêu."""
    print(f"\n🚨 [Simulator Anomaly] Kích hoạt tấn công '{attack_type.upper()}' trên thiết bị {device_id}...")
    device_anomaly_states[device_id] = attack_type

async def stop_attack_continuous(device_id, device_anomaly_states):
    """Dừng cuộc tấn công và khôi phục trạng thái hoạt động bình thường của thiết bị."""
    print(f"✅ [Simulator Anomaly] Dừng tấn công và khôi phục {device_id} về trạng thái bình thường.\n")
    device_anomaly_states[device_id] = "normal"
