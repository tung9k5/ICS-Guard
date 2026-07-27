// Script to seed InfluxDB for ICS-Guard
// Located in backend/src/database/seed_influx.js
const http = require('http');

const INFLUX_URL = 'http://localhost:8086';
const DB_NAME = 'ics_telemetry';

// 1. Tạo Database & Retention Policy 14 ngày
const initQueries = [
    `CREATE DATABASE ${DB_NAME}`,
    `CREATE RETENTION POLICY two_weeks_telemetry ON ${DB_NAME} DURATION 14d REPLICATION 1 DEFAULT`
];

async function sendQuery(query) {
    return new Promise((resolve, reject) => {
        const url = `${INFLUX_URL}/query?q=${encodeURIComponent(query)}`;
        
        const req = http.request(url, { method: 'POST' }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        
        req.on('error', reject);
        req.end();
    });
}

// 2. Gửi dữ liệu mẫu (Line Protocol)
async function writeData(lines) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8086,
            path: `/write?db=${DB_NAME}&precision=s`,
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }
        };
        
        const req = http.request(options, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve();
            else reject(new Error(`InfluxDB write status: ${res.statusCode}`));
        });
        
        req.on('error', reject);
        req.write(lines.join('\n'));
        req.end();
    });
}

async function main() {
    try {
        console.log('Initializing InfluxDB...');
        for (const query of initQueries) {
            await sendQuery(query);
        }
        console.log(`✅ Database "${DB_NAME}" and Retention Policy initialized.`);

        // Tạo dữ liệu mẫu mô phỏng 24 giờ qua (mỗi 5 phút một điểm dữ liệu)
        console.log('Generating seed telemetry data...');
        const lines = [];
        const nowInSeconds = Math.floor(Date.now() / 1000);
        
        for (let i = 288; i >= 0; i--) {
            const timestamp = nowInSeconds - (i * 300); // lùi lại mỗi 5 phút (300s)
            
            // Mẫu đo đạc của plc-factory-01
            const cpu = (Math.sin(i / 10) * 15 + 40 + Math.random() * 5).toFixed(2);
            const ram = (50 + Math.random() * 3).toFixed(2);
            const temp = (35 + Math.random() * 2).toFixed(2);
            lines.push(`iot_telemetry,device_id=plc-factory-01,device_type=plc,zone=Zone-A cpu_usage=${cpu},memory_usage=${ram},temperature=${temp},status=1 ${timestamp}`);
            
            // Mẫu lưu lượng mạng
            const baseTraffic = 15000; // 15KB/s
            const traffic = (i === 50) ? (baseTraffic * 9) : (baseTraffic + Math.random() * 2000);
            lines.push(`network_traffic,device_id=plc-factory-01,zone=Zone-A,protocol=mqtt bytes_per_second=${traffic.toFixed(2)},packets_per_second=${(traffic/120).toFixed(2)} ${timestamp}`);
        }
        
        await writeData(lines);
        console.log('✅ InfluxDB Seed Data written successfully!');
    } catch (e) {
        console.error('❌ Error seeding InfluxDB:', e.message);
        console.log('Vui lòng đảm bảo InfluxDB đang chạy tại http://localhost:8086');
    }
}

main();
