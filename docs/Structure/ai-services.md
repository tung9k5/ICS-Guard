# Cấu trúc thư mục Ai-services

Mô tả module AI tích hợp trong hệ thống ICS-Guard. Module này đóng vai trò xử lý các nghiệp vụ thông minh như phân tích cảnh báo, mô phỏng tấn công, và cung cấp chatbot hỗ trợ tự động.

## Cấu trúc thư mục

Dưới đây là cấu trúc thư mục của phần ai-services trong dự án:

```text
ai-services/
├── adapters/                     # Áp dụng Design Pattern Adapter để tương tác với các nhà cung cấp AI.
│   ├── GeminiAdapter.js          # Adapter kết nối và chuẩn hóa request cho API Google Gemini.
│   └── OpenAIAdapter.js          # Adapter kết nối và chuẩn hóa request cho OpenAI API.
├── constants/                    # Chứa các hằng số cấu hình hệ thống AI.
│   └── config.js                 # Cấu hình chứa API key, model version và URL.
├── prompts/                      # Chứa các template (Prompt Engineering) cho từng nghiệp vụ.
│   ├── analysis.prompt.js        # Prompt dùng để phân tích log và sự cố.
│   ├── chatbot.prompt.js         # Prompt định hướng tính cách và ngữ cảnh dành cho chatbot.
│   └── index.js                  # Xuất (Export) các file prompt.
├── services/                     # Lớp logic (Business Logic) xử lý AI chính.
│   ├── analysis.service.js       # Gọi mô hình để phân tích rủi ro hệ thống.
│   └── chat.service.js           # Xử lý chuỗi hội thoại, gửi câu hỏi từ người dùng lên mô hình.
├── AiFactory.js                  # Factory Pattern tạo ra các AI Adapter instance dựa trên config động.
├── client.js                     # Cấu hình khởi tạo và kết nối HTTP cơ sở tới các AI endpoint.
├── index.js                      # Entry point của module AI, khởi tạo các kết nối.
├── package-lock.json             # File lock lưu cấu trúc phiên bản chính xác (npm).
└── package.json                  # Quản lý thư viện phụ thuộc (dependencies) của ai-services.
```