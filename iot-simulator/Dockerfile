FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY src ./src

# Create logs directory for file transport
RUN mkdir -p logs

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["npm", "start"]
