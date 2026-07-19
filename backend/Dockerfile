FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./

RUN npm install --only=production

COPY backend/ ./
COPY shared/ /shared/

EXPOSE 5000

CMD ["npm", "start"]
