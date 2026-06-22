FROM node:18-alpine

WORKDIR /app

# Cài đặt pnpm
RUN npm install -g pnpm

# Copy file cấu hình package
COPY package.json ./

# Cài đặt thư viện bằng pnpm
RUN pnpm install

# Copy toàn bộ mã nguồn
COPY . .

# Chạy ở chế độ phát triển (Dev)
CMD ["pnpm", "dev", "--host"]
