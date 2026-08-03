FROM node:20-alpine

# Install network tools (iptables, tcpdump, iproute2)
RUN apk add --no-cache iptables ip6tables tcpdump iproute2

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

# PCAP output directory
RUN mkdir -p /pcap && chmod 777 /pcap

EXPOSE 5050

CMD ["node", "src/server.js"]
