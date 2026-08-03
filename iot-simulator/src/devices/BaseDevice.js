import { v4 as uuidv4 } from 'uuid';
import { DEVICE_STATUSES, SCENARIOS, TRAFFIC, BATTERY_DRAIN_RATE } from '../constants/index.js';

export class BaseDevice {
  constructor(id, name, zone, type = 'IoT Device') {
    this.id = id || `sim-dev-${uuidv4().substring(0, 8)}`;
    this.name = name || `Simulated ${type} ${this.id}`;
    this.zone = zone || 'Zone-Sim';
    this.type = type;
    this.status = DEVICE_STATUSES.ACTIVE;
    this.scenario = SCENARIOS.NORMAL;
    
    this.sensors = [];
    this.battery = 100;
    this.networkTraffic = TRAFFIC.BASE; // bytes per second

    // New Physical & Logical states
    this.isPowerConnected = true;
    this.isNetworkConnected = false; // Starts disconnected until wire dragged!
    this.activeAttacks = []; // Stores active incidents/attacks (e.g. ['FIRE', 'TRAFFIC_SPIKE'])
    this.logs = []; // Local log queue (Syslog format, max 50 entries)
    this.securityLogsPending = []; // JSON logs queue to be sent in next MQTT payload

    // Approvals, IP/MAC parameters
    this.approvalStatus = 'PENDING'; // 'PENDING' or 'APPROVED'
    this.ipAddress = `192.168.10.${Math.floor(10 + Math.random() * 240)}`;
    this.macAddress = `00:60:2F:${this.randomHex()}:${this.randomHex()}:${this.randomHex()}`;
    this.intervalMs = 5000;
    this.x = 0;
    this.y = 0;

    // Add initial log
    this.addLog('INFO', `Device ${this.name} initialized successfully. Current state: PENDING APPROVAL.`);
  }

  randomHex() {
    return Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
  }

  addLog(level, message, eventCode = null, sourceIp = null) {
    const timestamp = new Date().toISOString();
    const syslogLine = `<${level === 'CRITICAL' ? 131 : level === 'ERROR' ? 132 : level === 'WARN' ? 133 : 134}>1 ${timestamp} ${this.id} ics-guard - - [meta severity="${level}"] ${message}`;
    
    this.logs.push(syslogLine);
    if (this.logs.length > 50) {
      this.logs.shift();
    }

    // Queue security event logs for MQTT telemetry if there is an eventCode
    if (eventCode && this.approvalStatus === 'APPROVED') {
      this.securityLogsPending.push({
        event: eventCode,
        log_level: level,
        source_ip: sourceIp || this.ipAddress,
        message: message
      });
    }
  }

  triggerAttack(attackType, mode = 'interactive') {
    if (!this.isPowerConnected) return;
    if (!this.activeAttacks.includes(attackType)) {
      this.activeAttacks.push(attackType);
      
      let eventCode = null;
      let logMsg = `Anomaly detected: ${attackType} mode activated.`;
      
      // Match event codes from main system backend processStructuredLogs
      if (attackType === 'FIRE') {
        logMsg = `[CRITICAL_INCIDENT] Smoke concentration exceeded safety threshold. Potential fire detected.`;
      } else if (attackType === 'FLOOD') {
        logMsg = `[CRITICAL_INCIDENT] Water level sensors report overflow condition. Potential flood detected.`;
      } else if (attackType === 'OVERHEAT') {
        logMsg = `[CRITICAL_INCIDENT] Processor junction temperature exceeded critical limits. Thermal throttle active.`;
      } else if (attackType === 'TRAFFIC_SPIKE') {
        logMsg = `[CRITICAL_INCIDENT] Network interface flooding detected. Receiving excessive UDP packets.`;
      } else if (attackType === 'LOGIC_TAMPERING') {
        eventCode = 'FIRMWARE_CHECKSUM_ERROR';
        logMsg = `[CRITICAL_ATTACK] PLC Firmware checksum mismatch. Expected 0x9A4F, got 0x33A2. Unauthorized logic tampering.`;
      } else if (attackType === 'DATA_SPOOFING') {
        eventCode = 'SENSOR_SPOOFING_DETECTED';
        logMsg = `[CRITICAL_ATTACK] Sensor correlation failure: temperature value frozen. Suspicious data spoofing.`;
      } else if (attackType === 'BRUTE_FORCE') {
        eventCode = 'UNAUTHORIZED_CMD';
        logMsg = `[CRITICAL_ATTACK] SSH/HMI Brute force: 12 consecutive failed login attempts from IP 185.220.101.45.`;
      } else if (attackType === 'REPLAY_COMMAND') {
        eventCode = 'UNAUTHORIZED_CMD';
        logMsg = `[CRITICAL_ATTACK] Unauthorized write command to register address 40002 from IP 192.168.10.155.`;
      } else if (attackType === 'FIRMWARE_ATTACK') {
        eventCode = 'OTA_HASH_MISMATCH';
        logMsg = `[CRITICAL_ATTACK] OTA update rejected: SHA-256 hash mismatch for firmware package. Verification failed.`;
      } else if (attackType === 'ROUTE_POISONING') {
        eventCode = 'ROUTE_MODIFIED';
        logMsg = `[CRITICAL_ATTACK] Gateway routing table entry modified: default gateway redirected to 192.168.10.254.`;
      } else if (attackType === 'WAN_DOS') {
        eventCode = 'TLS_HANDSHAKE_FAILED';
        logMsg = `[CRITICAL_ATTACK] WAN port flooding. TLS handshakes failing continuously due to socket exhaustion.`;
      }

      this.addLog('WARN', `ANOMALY_MILESTONE: Device detected suspicious operational shift towards ${attackType}.`);
      this.addLog('CRITICAL', logMsg, eventCode);
    }
  }

  stopAttack(attackType) {
    const idx = this.activeAttacks.indexOf(attackType);
    if (idx !== -1) {
      this.activeAttacks.splice(idx, 1);
      this.addLog('INFO', `RECOVERY: Incident/Attack ${attackType} has been successfully mitigated. Normal operations resumed.`);
    }
  }

  clearAllAttacks() {
    if (this.activeAttacks.length > 0) {
      this.activeAttacks = [];
      this.addLog('INFO', 'RECOVERY: All incidents and attacks cleared. System restored to baseline.');
    }
  }

  mitigate(incidentType) {
    // Interactive mitigation via / page
    if (incidentType === 'FIRE' && this.activeAttacks.includes('FIRE')) {
      this.addLog('INFO', 'PHYSICAL_ACTION: Extinguisher triggered manually at device location.');
      this.stopAttack('FIRE');
    } else if (incidentType === 'FLOOD' && this.activeAttacks.includes('FLOOD')) {
      this.addLog('INFO', 'PHYSICAL_ACTION: Water pump started manually. Water level decreasing.');
      this.stopAttack('FLOOD');
    } else if (incidentType === 'OVERHEAT' && this.activeAttacks.includes('OVERHEAT')) {
      this.addLog('INFO', 'PHYSICAL_ACTION: Auxiliary cooling fan turned on. Temperature dropping.');
      this.stopAttack('OVERHEAT');
    }
  }

  // To be overridden or extended by subclasses
  generateSpecificMetrics(metrics) {
    return metrics;
  }

  generatePayload() {
    if (!this.isPowerConnected) {
      return null;
    }
    
    let metrics = {};
    const hasActiveFire = this.activeAttacks.includes('FIRE');
    const hasActiveFlood = this.activeAttacks.includes('FLOOD');
    const hasActiveOverheat = this.activeAttacks.includes('OVERHEAT');
    const hasActiveTrafficSpike = this.activeAttacks.includes('TRAFFIC_SPIKE') || this.activeAttacks.includes('WAN_DOS');

    // Run sensor generation
    for (const sensor of this.sensors) {
      // Determine what scenario to feed into the sensor based on active attacks
      let sensorScenario = 'NORMAL';
      if (hasActiveFire) sensorScenario = 'FIRE';
      else if (hasActiveFlood) sensorScenario = 'FLOOD';
      else if (hasActiveOverheat) sensorScenario = 'OVERHEAT';
      
      metrics[sensor.type.toLowerCase()] = sensor.generate(sensorScenario);
    }
    
    // Simulate battery drain
    this.battery = Math.max(0, this.battery - BATTERY_DRAIN_RATE);
    metrics.battery = parseFloat(this.battery.toFixed(1));
    
    // Simulate network traffic
    if (hasActiveTrafficSpike) {
      metrics.bytes_per_second = TRAFFIC.SPIKE_BASE + Math.random() * TRAFFIC.SPIKE_VARIANCE;
    } else {
      metrics.bytes_per_second = TRAFFIC.BASE + Math.random() * TRAFFIC.VARIANCE;
    }

    // Explicitly inject extreme metrics for scenarios to guarantee backend alert triggers
    if (hasActiveOverheat) {
      metrics.temperature = 95.0 + Math.random() * 5; // > 85.0
    }
    if (hasActiveFire) {
      metrics.smoke = 600 + Math.random() * 100; // > 400
      metrics.temperature = 90.0 + Math.random() * 10;
    }
    if (hasActiveFlood) {
      metrics.water_level = 90 + Math.random() * 10; // > 70
    }

    // Call subclass specific metrics
    metrics = this.generateSpecificMetrics(metrics);

    // Dynamic log generator for normal operations (20% chance per cycle to avoid flooding)
    if (this.activeAttacks.length === 0 && Math.random() < 0.2) {
      if (this.approvalStatus === 'PENDING') {
        const pendingMsgs = [
          `Device registration broadcast sent. Awaiting approval...`,
          `Status: PENDING_APPROVAL. Modbus and telemetry engines paused.`,
          `Local loopback test passed. MAC: ${this.macAddress}. IP: ${this.ipAddress}.`
        ];
        this.addLog('WARN', pendingMsgs[Math.floor(Math.random() * pendingMsgs.length)]);
      } else {
        const normalMsgs = [
          `Sensor readings within normal margins (battery = ${metrics.battery}%, traffic = ${Math.round(metrics.bytes_per_second)} Bps).`,
          `MQTT keep-alive ping response received from broker.`,
          `All hardware threads reporting nominal state.`
        ];
        this.addLog('INFO', normalMsgs[Math.floor(Math.random() * normalMsgs.length)]);
      }
    }

    // Capture logs to send and clear them
    const logsToSend = [...this.securityLogsPending];
    this.securityLogsPending = [];

    const payload = {
      device_id: this.id,
      device_type: this.type,
      zone: this.zone,
      metrics
    };

    if (logsToSend.length > 0) {
      payload.logs = logsToSend;
    }

    return payload;
  }
}

