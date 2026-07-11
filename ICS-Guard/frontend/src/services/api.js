import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});


api.interceptors.response.use(
    response => response.data,
    error => {
        console.error("Lỗi khi gọi API:", error);
        return Promise.reject(error);
    }
);

export default api;
