import axios from 'axios';

const INFLUXDB_URL = process.env.INFLUXDB_URL;
const DB_NAME = process.env.INFLUXDB_DB;

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

  const { device_id, zone, device_type, metrics, metadata, timestamp } = data;
  if (!device_id || !metrics) return;
  
  // Format tags and fields for Line Protocol
  const measurement = 'device_metrics';
  const tags = [`device_id=${device_id}`, `zone=${zone || 'unknown'}`, `device_type=${device_type || 'unknown'}`];
  
  const fieldsList = [];
  
  // Parse metrics
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === 'number') {
      fieldsList.push(`${key}=${value}`);
    } else if (typeof value === 'string') {
      fieldsList.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    } else if (typeof value === 'boolean') {
      fieldsList.push(`${key}=${value ? 'true' : 'false'}`);
    }
  }

  // Parse metadata
  if (metadata && typeof metadata === 'object') {
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'number') {
        fieldsList.push(`meta_${key}=${value}`);
      } else if (typeof value === 'string') {
        fieldsList.push(`meta_${key}="${value.replace(/"/g, '\\"')}"`);
      } else if (typeof value === 'boolean') {
        fieldsList.push(`meta_${key}=${value ? 'true' : 'false'}`);
      }
    }
  }
  
  if (fieldsList.length === 0) return;
  
  const tagsStr = tags.join(',');
  const fieldsStr = fieldsList.join(',');

  // Write payload
  let line = `${measurement},${tagsStr} ${fieldsStr}`;
  
  // Append timestamp if provided (InfluxDB expects nanoseconds by default if not specified in precision param,
  // but if timestamp is provided from python as seconds/ms, we should format it.
  // We'll let influx generate the server timestamp if no timestamp is sent)
  if (timestamp) {
    // timestamp from python is usually seconds, convert to nanoseconds
    const tsNano = Math.floor(timestamp * 1e9);
    line += ` ${tsNano}`;
  }

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

export const writePoint = async (measurement, data) => {
  if (!isInfluxAvailable) return;
  const { tags = {}, fields = {}, timestamp } = data;
  
  const tagList = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(',');
  const fieldList = Object.entries(fields).map(([k, v]) => {
    if (typeof v === 'string') return `${k}="${v.replace(/"/g, '\\"')}"`;
    return `${k}=${v}`;
  }).join(',');
  
  const time = timestamp ? (new Date(timestamp).getTime() * 1000000) : '';
  const line = `${measurement}${tagList ? ',' + tagList : ''} ${fieldList} ${time}`.trim();
  
  try {
    const writeUrl = `${INFLUXDB_URL}/write?db=${DB_NAME}`;
    await axios.post(writeUrl, line, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 3000
    });
  } catch (error) {
    console.error(`[InfluxService] Error writing point to InfluxDB:`, error.message);
  }
};

export default {
  initInflux,
  writeTelemetry,
  queryTelemetry,
  writePoint
};
