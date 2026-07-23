#include <WiFi.h>
#include <PubSubClient.h>

// ==========================================
// 1. CẤU HÌNH MẠNG VÀ HỆ THỐNG
// ==========================================
const char* ssid = "TEN_WIFI_CUA_BAN";         // Tên WiFi
const char* password = "MAT_KHAU_WIFI_CUA_BAN";// Mật khẩu WiFi

// ĐỊA CHỈ IP LAN CỦA MÁY TÍNH ĐANG CHẠY DOCKER (Ví dụ: 192.168.1.10)
const char* mqtt_server = "192.168.1.X"; 
const int mqtt_port = 1883;

// Topic để gửi dữ liệu telemetry. Cấu trúc chuẩn: ics/telemetry/<device_id>
const char* mqtt_topic = "ics/telemetry/esp-sensor-01";
const char* device_id = "esp-sensor-01";

// Khởi tạo các đối tượng mạng
WiFiClient espClient;
PubSubClient client(espClient);

// Biến quản lý thời gian gửi dữ liệu
unsigned long lastMsg = 0;
const long interval = 5000; // Chu kỳ gửi dữ liệu: 5000ms = 5 giây

// ==========================================
// 2. HÀM KẾT NỐI WIFI
// ==========================================
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Đang kết nối tới WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  // Chờ cho đến khi kết nối thành công
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nĐã kết nối WiFi thành công!");
  Serial.print("Địa chỉ IP của ESP: ");
  Serial.println(WiFi.localIP());
}

// ==========================================
// 3. HÀM KẾT NỐI VÀ TỰ ĐỘNG KẾT NỐI LẠI MQTT
// ==========================================
void reconnect() {
  // Lặp cho đến khi kết nối được tới Broker
  while (!client.connected()) {
    Serial.print("Đang cố gắng kết nối MQTT Broker...");
    
    // Tạo một ID Client ngẫu nhiên để không bị trùng lặp
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    // Thử kết nối
    if (client.connect(clientId.c_str())) {
      Serial.println(" -> Đã kết nối!");
    } else {
      Serial.print(" -> Thất bại, mã lỗi (rc)=");
      Serial.print(client.state());
      Serial.println(" - Thử lại sau 5 giây.");
      delay(5000); // Đợi 5 giây trước khi thử lại
    }
  }
}

// ==========================================
// 4. HÀM KHỞI TẠO (CHẠY 1 LẦN KHI KHỞI ĐỘNG)
// ==========================================
void setup() {
  // Bật Serial với tốc độ 115200 để theo dõi qua Serial Monitor
  Serial.begin(115200);
  
  // Gọi hàm cấu hình WiFi
  setup_wifi();
  
  // Cấu hình máy chủ MQTT
  client.setServer(mqtt_server, mqtt_port);
}

// ==========================================
// 5. VÒNG LẶP CHÍNH (CHẠY LIÊN TỤC)
// ==========================================
void loop() {
  // Đảm bảo luôn giữ kết nối tới Broker MQTT
  if (!client.connected()) {
    reconnect();
  }
  
  // Xử lý các gói tin nhận được (nếu có) và duy trì kết nối (keep-alive)
  client.loop();

  // Kiểm tra xem đã đến lúc gửi dữ liệu mới chưa
  unsigned long now = millis();
  if (now - lastMsg > interval) {
    lastMsg = now;

    // ----- A. Đọc cảm biến (Giả lập) -----
    // Trong thực tế, bạn sẽ dùng code đọc cảm biến DHT11, DS18B20, v.v. tại đây
    float temperature = 25.0 + random(-20, 20) / 10.0;
    float humidity = 60.0 + random(-50, 50) / 10.0;
    
    // ----- B. Thu thập thông tin trạng thái của thiết bị (Metadata) -----
    long uptime = millis() / 1000;         // Thời gian mạch đã chạy (giây)
    long free_heap = ESP.getFreeHeap();    // Bộ nhớ RAM còn trống
    long rssi = WiFi.RSSI();               // Cường độ tín hiệu WiFi

    // ----- C. Đóng gói chuỗi JSON chuẩn hóa -----
    // Lưu ý: Chuỗi này phải khớp chuẩn thiết kế của Backend
    String payload = "{";
    payload += "\"device_id\":\"" + String(device_id) + "\",";
    payload += "\"zone\":\"Zone-A\",";
    payload += "\"device_type\":\"sensor\",";
    
    // Metrics: Các thông số biến thiên
    payload += "\"metrics\":{";
    payload += "\"temperature\":" + String(temperature) + ",";
    payload += "\"humidity\":" + String(humidity);
    payload += "},";
    
    // Metadata: Trạng thái của mạch
    payload += "\"metadata\":{";
    payload += "\"uptime_seconds\":" + String(uptime) + ",";
    payload += "\"free_heap\":" + String(free_heap) + ",";
    payload += "\"wifi_rssi\":" + String(rssi);
    payload += "}";
    
    payload += "}";

    // In ra Serial Monitor để dễ theo dõi
    Serial.print("\n[MQTT] Đang gửi dữ liệu: ");
    Serial.println(payload);
    
    // ----- D. Bắn lên MQTT Broker -----
    client.publish(mqtt_topic, payload.c_str());
  }
}
