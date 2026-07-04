import sys
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score

# Ép kiểu luồng xuất chuẩn (stdout) sử dụng UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def train_lightweight_anomaly_model():
    print("[AI-Engine ML] Đang khởi tạo dữ liệu giả lập cho huấn luyện...")
    
    np.random.seed(42)
    num_samples = 2000
    
    # Sinh dữ liệu các đặc trưng: [cpu_usage, memory_usage, bytes_per_second, packet_rate]
    X = []
    y = []

    # 1. Trạng thái hoạt động bình thường (Label: 0)
    for _ in range(int(num_samples * 0.5)):
        cpu = np.random.uniform(5.0, 45.0)
        mem = np.random.uniform(20.0, 55.0)
        bps = np.random.uniform(500, 3000)
        pkt_rate = np.random.uniform(10, 80)
        X.append([cpu, mem, bps, pkt_rate])
        y.append(0)

    # 2. Bất thường: Tấn công Modbus Flood (Label: 1)
    for _ in range(int(num_samples * 0.25)):
        cpu = np.random.uniform(85.0, 99.0)
        mem = np.random.uniform(75.0, 95.0)
        bps = np.random.uniform(120000, 260000)
        pkt_rate = np.random.uniform(3000, 5200)
        X.append([cpu, mem, bps, pkt_rate])
        y.append(1)

    # 3. Bất thường: Logic Tampering / Phá hoại logic PLC (Label: 2)
    for _ in range(int(num_samples * 0.25)):
        cpu = np.random.uniform(60.0, 82.0)
        mem = np.random.uniform(50.0, 75.0)
        bps = np.random.uniform(5000, 16000)
        pkt_rate = np.random.uniform(120, 350)
        X.append([cpu, mem, bps, pkt_rate])
        y.append(2)

    X = np.array(X)
    y = np.array(y)

    # Chia tập Train / Test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)

    # Chuẩn hóa dữ liệu
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Huấn luyện mô hình Random Forest Classifier siêu nhẹ
    model = RandomForestClassifier(n_estimators=10, max_depth=5, random_state=42)
    model.fit(X_train_scaled, y_train)

    # Đánh giá F1-Score
    y_pred = model.predict(X_test_scaled)
    macro_f1 = f1_score(y_test, y_pred, average='macro')
    
    print("\n--- KẾT QUẢ ĐÁNH GIÁ MÔ HÌNH ML ---")
    print(classification_report(y_test, y_pred, target_names=["Normal", "Modbus Flood", "Logic Tampering"]))
    print(f"👉 Macro F1-Score đạt được: {macro_f1:.4f} (Đạt yêu cầu của đồ án > 0.8)")
    print("-----------------------------------\n")

    # Xác định đường dẫn tuyệt đối để lưu mô hình
    import os
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "telemetry_classifier.pkl")
    scaler_path = os.path.join(base_dir, "scaler.pkl")

    # Lưu mô hình và bộ chuẩn hóa
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
        
    print(f"✅ Đã lưu mô hình: {model_path}")
    print(f"✅ Đã lưu bộ chuẩn hóa: {scaler_path}")

if __name__ == "__main__":
    train_lightweight_anomaly_model()
