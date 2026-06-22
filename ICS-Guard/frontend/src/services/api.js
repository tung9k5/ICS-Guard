import axios from 'axios';

// baseURL trỏ tới FastAPI backend (đọc từ .env)
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Cấu hình interceptor để tự động lấy data từ response
api.interceptors.response.use(
    response => response.data,
    error => {
        console.error("Lỗi khi gọi API:", error);
        return Promise.reject(error);
    }
);

export default api;
