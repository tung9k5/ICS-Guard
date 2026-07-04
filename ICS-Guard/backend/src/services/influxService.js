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

export default {
  initInflux,
  writeTelemetry,
  queryTelemetry
};
