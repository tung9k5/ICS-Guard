/**
 * Module logParser.js hỗ trợ phân tích log Syslog và CSV thành cấu trúc dữ liệu chuẩn của hệ thống ICS-Guard
 */

/**
 * Phân tích bản tin Syslog (RFC 3164 hoặc RFC 5424)
 * @param {string} syslogLine Dòng log syslog thô
 * @returns {Object|null} Payload chuẩn của Telemetry hoặc null
 */
export const parseSyslog = (syslogLine) => {
  if (!syslogLine || typeof syslogLine !== 'string') return null;

  try {
    // 1. Phân tích Priority/Facility/Severity (ví dụ: <34> hoặc <165>)
    const priMatch = syslogLine.match(/^<(\d+)>/);
    let pri = 30;
    let severityCode = 3; // default Warning/Error
    if (priMatch) {
      pri = parseInt(priMatch[1], 10);
      severityCode = pri % 8; // 0: Emergency, 1: Alert, 2: Critical, 3: Error, 4: Warning...
    }

    // Xóa tiền tố priority khỏi dòng log để phân tích tiếp
    const cleanedLine = syslogLine.replace(/^<\d+>/, '').trim();

    // 2. Nhận dạng định dạng RFC 5424 (bắt đầu bằng version số, ví dụ "1 2003-10-11T...")
    // RFC 5424 format: VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
    const rfc5424Match = cleanedLine.match(/^1\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(-|\[.*?\])\s*(.*)$/);

    let timestamp = new Date();
    let hostname = 'unknown-device';
    let appName = 'syslog';
    let message = cleanedLine;

    if (rfc5424Match) {
      const [_, tsStr, host, app, procId, msgId, structData, msg] = rfc5424Match;
      if (tsStr !== '-') timestamp = new Date(tsStr);
      hostname = host !== '-' ? host : hostname;
      appName = app !== '-' ? app : appName;
      message = msg || cleanedLine;
    } else {
      // 3. Nhận dạng định dạng RFC 3164
      // RFC 3164 format: Mmm dd hh:mm:ss HOSTNAME MSG
      const rfc3164Match = cleanedLine.match(/^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)$/);
      if (rfc3164Match) {
        const [_, tsStr, host, msg] = rfc3164Match;
        timestamp = new Date(tsStr + ' ' + new Date().getFullYear()); // Tự chèn năm hiện tại
        hostname = host;
        message = msg;
      }
    }

    // 4. Phân loại loại log và sự kiện dựa vào nội dung log
    let log_type = 'system';
    let event = 'INFO';
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('failed') || lowerMsg.includes('unauthorized') || lowerMsg.includes('denied') || lowerMsg.includes('auth_failed')) {
      log_type = 'auth';
      event = 'AUTH_FAILED';
    } else if (lowerMsg.includes('success') || lowerMsg.includes('login') || lowerMsg.includes('authenticated')) {
      log_type = 'auth';
      event = 'SUCCESS';
    } else if (lowerMsg.includes('attack') || lowerMsg.includes('exploit') || lowerMsg.includes('malicious') || severityCode <= 2) {
      log_type = 'security';
      event = 'SECURITY_ANOMALY';
    }

    // 5. Trích xuất các tham số đo lường (metrics) nếu có trong log thô (ví dụ: temp=45 hoặc temperature: 45)
    const metrics = {
      bytes_per_second: 1000,
      connection_rate: 2
    };

    const kvRegex = /(\b\w+)[=:]\s*([\d.]+)/g;
    let match;
    while ((match = kvRegex.exec(message)) !== null) {
      const [_, key, val] = match;
      const numericVal = parseFloat(val);
      if (!isNaN(numericVal)) {
        if (key.includes('temp')) metrics.temperature = numericVal;
        else if (key.includes('press')) metrics.pressure = numericVal;
        else if (key.includes('flow')) metrics.flow_rate = numericVal;
        else if (key.includes('conn')) metrics.connection_rate = numericVal;
        else if (key.includes('byte')) metrics.bytes_per_second = numericVal;
        else metrics[key] = numericVal;
      }
    }

    return {
      device_id: hostname,
      zone: 'Default-Zone',
      log_type,
      event,
      timestamp,
      message,
      metrics
    };
  } catch (error) {
    console.error('[SyslogParser] Phân tích thất bại:', error.message);
    return null;
  }
};

/**
 * Phân tích file CSV log chứa telemetry
 * @param {string} csvContent Nội dung CSV thô
 * @returns {Array<Object>} Danh sách các dòng payload telemetry chuẩn
 */
export const parseCSV = (csvContent) => {
  if (!csvContent || typeof csvContent !== 'string') return [];

  const lines = csvContent.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  try {
    // Lấy tiêu đề cột (headers)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map(c => c.trim());
      if (columns.length < headers.length) continue;

      const record = {
        metrics: {}
      };

      headers.forEach((header, index) => {
        const val = columns[index];
        if (!val) return;

        // Map các cột cơ bản
        if (header === 'device_id' || header === 'deviceid') {
          record.device_id = val;
        } else if (header === 'zone') {
          record.zone = val;
        } else if (header === 'log_type' || header === 'logtype') {
          record.log_type = val;
        } else if (header === 'event') {
          record.event = val;
        } else if (header === 'message' || header === 'msg') {
          record.message = val;
        } else {
          // Coi các cột khác là các thông số metrics đo lường
          const numVal = parseFloat(val);
          if (!isNaN(numVal)) {
            if (['temperature', 'pressure', 'flow_rate', 'bytes_per_second', 'connection_rate'].includes(header)) {
              record.metrics[header] = numVal;
            } else {
              record.metrics[header] = numVal;
            }
          }
        }
      });

      // Bổ sung các giá trị mặc định nếu thiếu
      if (!record.device_id) record.device_id = 'unknown-device';
      if (!record.zone) record.zone = 'CSV-Zone';
      if (!record.log_type) record.log_type = 'system';
      if (!record.event) record.event = 'CSV_IMPORT';
      
      // Đảm bảo có các chỉ số cơ bản
      if (!record.metrics.bytes_per_second) record.metrics.bytes_per_second = 1000;
      if (!record.metrics.connection_rate) record.metrics.connection_rate = 2;

      result.push(record);
    }

    return result;
  } catch (error) {
    console.error('[CSVParser] Phân tích file thất bại:', error.message);
    return [];
  }
};

export default {
  parseSyslog,
  parseCSV
};
