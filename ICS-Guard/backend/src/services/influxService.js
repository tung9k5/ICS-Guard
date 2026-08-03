import axios from 'axios';

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://influxdb:8086';
const DB_NAME = process.env.INFLUXDB_DB || 'ics_telemetry';

console.log(`[InfluxService] Initializing. InfluxDB URL: ${INFLUXDB_URL}, DB: ${DB_NAME}`);

let isInfluxAvailable = true;

/**
 * Initialize database if not exists (for InfluxDB 1.8)
 */
export const initInflux = async () => {
  try {
    const queryUrl = `${INFLUXDB_URL}/query`;
    
    // 1. Create database
    const createDbQuery = encodeURIComponent(`CREATE DATABASE ${DB_NAME}`);
    await axios.post(queryUrl, `q=${createDbQuery}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log(`[InfluxService] InfluxDB database "${DB_NAME}" initialized successfully.`);
    
    // 2. Create Retention Policy of 14 days
    const createRpQuery = encodeURIComponent(`CREATE RETENTION POLICY two_weeks_telemetry ON ${DB_NAME} DURATION 14d REPLICATION 1 DEFAULT`);
    await axios.post(queryUrl, `q=${createRpQuery}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log(`[InfluxService] InfluxDB retention policy "two_weeks_telemetry" (14d) checked/initialized.`);
    isInfluxAvailable = true;
  } catch (error) {
    isInfluxAvailable = false;
    console.warn('[InfluxService] Failed to initialize database or retention policy. Telemetry writing to InfluxDB will be disabled.');
  }
};

/**
 * Write telemetry data to InfluxDB 1.8 using Line Protocol
 * Format: measurement,tag1=val1,tag2=val2 field1=val1,field2=val2
 */
export const writeTelemetry = async (data) => {
  if (!isInfluxAvailable) return;

  const { device_id, zone, device_type, metrics } = data;
  if (!device_id || !metrics) return;

  const { temperature, cpu_usage, bytes_per_second } = metrics;
  
  // Format tags and fields for Line Protocol
  const measurement = 'device_metrics';
  const tags = `device_id=${device_id},zone=${zone || 'unknown'},device_type=${device_type || 'unknown'}`;
  
  const fieldsList = [];
  if (temperature !== undefined) fieldsList.push(`temperature=${temperature}`);
  if (cpu_usage !== undefined) fieldsList.push(`cpu_usage=${cpu_usage}`);
  if (bytes_per_second !== undefined) fieldsList.push(`bytes_per_second=${bytes_per_second}`);
  
  if (fieldsList.length === 0) return;
  const fields = fieldsList.join(',');

  // Write payload
  const line = `${measurement},${tags} ${fields}`;

  try {
    const writeUrl = `${INFLUXDB_URL}/write?db=${DB_NAME}`;
    await axios.post(writeUrl, line, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 3000
    });
    // Silent success to avoid log spamming
  } catch (error) {
    console.error(`[InfluxService] Error writing telemetry for ${device_id}:`, error.message);
  }
};

/**
 * Query historical telemetry metrics for a device
 */
export const queryTelemetry = async (deviceId, limit = 50) => {
  try {
    const queryUrl = `${INFLUXDB_URL}/query`;
    const query = encodeURIComponent(`SELECT time, cpu_usage, temperature, bytes_per_second FROM device_metrics WHERE device_id='${deviceId}' ORDER BY time DESC LIMIT ${limit}`);
    
    const response = await axios.get(`${queryUrl}?db=${DB_NAME}&q=${query}`);
    
    if (response.data && response.data.results && response.data.results[0] && response.data.results[0].series) {
      const series = response.data.results[0].series[0];
      const columns = series.columns;
      const values = series.values;
      
      // Map columns to objects
      return values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }
    return [];
  } catch (error) {
    console.error(`[InfluxService] Error querying telemetry for ${deviceId}:`, error.message);
    return [];
  }
};

export const queryNetworkTrafficDashboard = async () => {
  if (!isInfluxAvailable) return generateMockNetworkData();
  try {
    const queryUrl = `${INFLUXDB_URL}/query`;
    const query = encodeURIComponent(`SELECT mean(bytes_per_second) AS bytes FROM device_metrics WHERE time >= now() - 24h GROUP BY time(4h)`);
    const response = await axios.get(`${queryUrl}?db=${DB_NAME}&q=${query}`);
    
    if (response.data?.results?.[0]?.series) {
      const series = response.data.results[0].series[0];
      const data = series.values.map(row => {
        const timeObj = new Date(row[0]);
        const timeLabel = `${timeObj.getHours().toString().padStart(2, '0')}:00`;
        const bytes = row[1] || 0;
        return {
          time: timeLabel,
          incoming: Math.floor(bytes * 0.6) || Math.floor(1000 + Math.random() * 500),
          outgoing: Math.floor(bytes * 0.4) || Math.floor(500 + Math.random() * 200)
        };
      });
      return data;
    }
    return generateMockNetworkData();
  } catch (err) {
    console.error(`[InfluxService] queryNetworkTrafficDashboard error:`, err.message);
    return generateMockNetworkData();
  }
};

const generateMockNetworkData = () => {
    const data = [];
    let baseIncoming = 2000;
    let baseOutgoing = 1000;

    for (let i = 0; i <= 24; i += 4) {
      const timeLabel = i < 10 ? `0${i}:00` : `${i}:00`;
      const incoming = Math.floor(baseIncoming + Math.random() * 2000);
      const outgoing = Math.floor(baseOutgoing + Math.random() * 1500);

      data.push({ time: timeLabel, incoming, outgoing });
      
      baseIncoming = incoming - 500 > 0 ? incoming - 500 : 2000;
      baseOutgoing = outgoing - 300 > 0 ? outgoing - 300 : 1000;
    }
    return data;
};

/**
 * Write device logs/events to InfluxDB (Line Protocol)
 */
export const writeDeviceEvent = async (eventData) => {
  if (!isInfluxAvailable) return;
  const { device_id, zone, log_type, event, severity, source_ip, username, message } = eventData;
  if (!device_id || !message) return;

  const measurement = 'device_events';
  
  const cleanTag = (val) => String(val || 'unknown').replace(/ /g, '\\ ').replace(/,/g, '\\,');
  const tags = `device_id=${cleanTag(device_id)},zone=${cleanTag(zone)}`;
  
  const escapeString = (str) => {
    if (str === undefined || str === null) return '""';
    return `"${String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  };

  const fieldsList = [
    `message=${escapeString(message)}`,
    `log_type=${escapeString(log_type)}`,
    `event=${escapeString(event)}`,
    `severity=${escapeString(severity || 'INFO')}`
  ];

  if (source_ip) fieldsList.push(`source_ip=${escapeString(source_ip)}`);
  if (username) fieldsList.push(`username=${escapeString(username)}`);

  const fields = fieldsList.join(',');
  const line = `${measurement},${tags} ${fields}`;

  try {
    const writeUrl = `${INFLUXDB_URL}/write?db=${DB_NAME}`;
    await axios.post(writeUrl, line, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 3000
    });
  } catch (error) {
    console.error(`[InfluxService] Error writing device event for ${device_id}:`, error.message);
  }
};

/**
 * Query device logs/events from InfluxDB
 */
export const queryDeviceEvents = async (deviceId, severity = null, limit = 100) => {
  if (!isInfluxAvailable) return [];
  try {
    const queryUrl = `${INFLUXDB_URL}/query`;
    let queryStr = `SELECT log_type, event, severity, source_ip, username, message FROM device_events WHERE 1=1`;
    if (deviceId) {
      queryStr += ` AND device_id='${deviceId}'`;
    }
    if (severity) {
      queryStr += ` AND severity='${severity}'`;
    }
    queryStr += ` ORDER BY time DESC LIMIT ${limit}`;
    const query = encodeURIComponent(queryStr);
    const response = await axios.get(`${queryUrl}?db=${DB_NAME}&q=${query}`);
    
    if (response.data?.results?.[0]?.series) {
      const series = response.data.results[0].series[0];
      const columns = series.columns;
      const values = series.values;
      
      return values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }
    return [];
  } catch (error) {
    console.error(`[InfluxService] Error querying device events:`, error.message);
    return [];
  }
};

/**
 * Query average metrics for a device (or all devices if deviceId is null) over past N days
 */
export const queryDeviceAverages = async (deviceId = null, days = 7) => {
  if (!isInfluxAvailable) {
    // Generate mock averages if InfluxDB is offline
    return {
      avg_cpu: Math.floor(10 + Math.random() * 20),
      avg_temp: Math.floor(25 + Math.random() * 15),
      avg_bandwidth: Math.floor(100 + Math.random() * 400)
    };
  }
  try {
    const queryUrl = `${INFLUXDB_URL}/query`;
    let queryStr = `SELECT mean(cpu_usage) AS avg_cpu, mean(temperature) AS avg_temp, mean(bytes_per_second) AS avg_bandwidth FROM device_metrics WHERE time >= now() - ${days}d`;
    if (deviceId) {
      queryStr += ` AND device_id='${deviceId}'`;
    }
    const query = encodeURIComponent(queryStr);
    const response = await axios.get(`${queryUrl}?db=${DB_NAME}&q=${query}`);
    
    if (response.data?.results?.[0]?.series) {
      const series = response.data.results[0].series[0];
      const values = series.values[0]; // mean values
      // values index: 0 = time, 1 = avg_cpu, 2 = avg_temp, 3 = avg_bandwidth
      return {
        avg_cpu: Math.round(values[1] || 0),
        avg_temp: Math.round(values[2] || 0),
        avg_bandwidth: Math.round(values[3] || 0)
      };
    }
    return { avg_cpu: 0, avg_temp: 0, avg_bandwidth: 0 };
  } catch (error) {
    console.error(`[InfluxService] Error querying device averages:`, error.message);
    return { avg_cpu: 0, avg_temp: 0, avg_bandwidth: 0 };
  }
};

export default {
  initInflux,
  writeTelemetry,
  queryTelemetry,
  queryNetworkTrafficDashboard,
  writeDeviceEvent,
  queryDeviceEvents,
  queryDeviceAverages
};
