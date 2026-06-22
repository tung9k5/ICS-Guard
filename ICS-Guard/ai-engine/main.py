import os
import json
import time
import pika
from dotenv import load_dotenv

# Load env variables
load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
AI_ANALYSIS_QUEUE = "ai_analysis_queue"
AI_RESPONSE_QUEUE = "ai_response_queue"

def connect_rabbitmq():
    """Establish connection to RabbitMQ with retry logic."""
    retries = 10
    connection = None
    while retries > 0:
        try:
            print(f"[AI-Engine] Connecting to RabbitMQ at: {RABBITMQ_URL}...")
            # Parse connection URL for pika
            params = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            
            # Assert queues
            channel.queue_declare(queue=AI_ANALYSIS_QUEUE, durable=True)
            channel.queue_declare(queue=AI_RESPONSE_QUEUE, durable=True)
            print("[AI-Engine] Successfully connected to RabbitMQ.")
            return connection, channel
        except Exception as e:
            print(f"[AI-Engine] Connection failed ({retries - 1} retries left): {e}")
            retries -= 1
            time.sleep(5)
    raise Exception("[AI-Engine] Could not connect to RabbitMQ.")

def process_message(ch, method, properties, body):
    try:
        data = json.loads(body.decode('utf-8'))
        print(f"[AI-Engine] Received analysis request: {data}")

        alert_id = data.get("alertId")
        description = data.get("description", "")
        device_id = data.get("deviceId", "unknown")

        # Simulate Anomaly Detection / Security Analysis logic
        is_anomaly = False
        attack_type = "NORMAL"
        ai_desc = "Hoạt động bình thường không có dấu hiệu bất thường."
        reremedy = []

        desc_lower = description.lower()
        if "brute" in desc_lower or "failed" in desc_lower or "lockout" in desc_lower:
            is_anomaly = True
            attack_type = "SSH_BRUTE_FORCE"
            ai_desc = f"Phát hiện hành vi brute force mật khẩu từ nguồn ngoài vào thiết bị {device_id}."
            reremedy = [
                "Chặn IP nguồn tấn công trên Router biên hoặc Firewall.",
                "Cập nhật lại mật khẩu truy cập của thiết bị với độ phức tạp cao.",
                "Tắt cổng dịch vụ quản trị từ xa (SSH) nếu không cần thiết."
            ]
        elif "spike" in desc_lower or "traffic" in desc_lower or "bytes" in desc_lower:
            is_anomaly = True
            attack_type = "TRAFFIC_SPIKE_DDoS"
            ai_desc = f"Lưu lượng mạng tăng đột biến bất thường trên thiết bị {device_id}, nghi ngờ tấn công từ chối dịch vụ (DDoS) hoặc rò rỉ dữ liệu."
            reremedy = [
                "Cách ly thiết bị khỏi vùng mạng sản xuất để điều tra.",
                "Giới hạn băng thông (Rate limiting) cho thiết bị.",
                "Kiểm tra các tiến trình lạ đang chạy ngầm trên thiết bị."
            ]

        response_payload = {
            "alertId": alert_id,
            "isAnomaly": is_anomaly,
            "attackType": attack_type,
            "description": ai_desc,
            "remediationSteps": reremedy
        }

        # Send response payload
        ch.basic_publish(
            exchange='',
            routing_key=AI_RESPONSE_QUEUE,
            body=json.dumps(response_payload),
            properties=pika.BasicProperties(
                delivery_mode=2, # make message persistent
            )
        )
        print(f"[AI-Engine] Sent analysis response: {response_payload}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"[AI-Engine] Error processing message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def main():
    connection, channel = connect_rabbitmq()
    
    # Configure QoS to process 1 message at a time
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=AI_ANALYSIS_QUEUE, on_message_callback=process_message)

    print(f"[AI-Engine] Waiting for messages in queue '{AI_ANALYSIS_QUEUE}'...")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
    connection.close()

if __name__ == '__main__':
    main()
