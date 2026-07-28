FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create ai-services directory with correct permissions for the anonymous volume
RUN mkdir -p /ai-services/node_modules && chown -R appuser:appgroup /ai-services

USER appuser

EXPOSE 8000

CMD ["npm", "start"]
