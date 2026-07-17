FROM node:18-alpine

WORKDIR /app

# Copy file cấu hình package
COPY package.json ./

# Cài đặt thư viện bằng npm
RUN npm install

# Copy toàn bộ mã nguồn
COPY . .

# Chạy ở chế độ phát triển (Dev)
CMD ["npm", "run", "dev", "--", "--host"]
