import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import bcrypt from 'bcryptjs';
import { 
  User, 
  Device, 
  Alert, 
  Incident, 
  IncidentTimeline, 
  AuditLog, 
  BlockedIp, 
  SimulatorCommand, 
  RefreshToken, 
  Rule, 
  Playbook 
} from '../models/index.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ics-guard';
const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const INFLUX_DB = 'ics_telemetry';

async function resetInfluxDb() {
  return new Promise((resolve) => {
    console.log('[RESET] Đang làm sạch dữ liệu chuỗi thời gian InfluxDB...');
    const dropQuery = `DROP DATABASE ${INFLUX_DB}`;
    const createDbQuery = `CREATE DATABASE ${INFLUX_DB}`;
    const rpQuery = `CREATE RETENTION POLICY two_weeks_telemetry ON ${INFLUX_DB} DURATION 14d REPLICATION 1 DEFAULT`;

    const sendReq = (query) => {
      return new Promise((res) => {
        const url = `${INFLUX_URL}/query?q=${encodeURIComponent(query)}`;
        const req = http.request(url, { method: 'POST' }, (r) => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => res(data));
        });
        req.on('error', (e) => {
          console.warn('[RESET] InfluxDB không phản hồi (có thể dịch vụ chưa bật):', e.message);
          res(null);
        });
        req.end();
      });
    };

    (async () => {
      await sendReq(dropQuery);
      await sendReq(createDbQuery);
      await sendReq(rpQuery);
      console.log('[RESET] [SUCCESS] Đã reset InfluxDB thành công.');
      resolve();
    })();
  });
}

async function runCleanReset() {
  try {
    console.log('====================================================');
    console.log('[RESET] BẮT ĐẦU QUY TRÌNH LÀM SẠCH DATABASE ICS-GUARD');
    console.log('====================================================');

    await mongoose.connect(MONGO_URI);
    console.log('[RESET] [SUCCESS] Đã kết nối MongoDB thành công.');

    // 1. Preserve and Clean Users
    const defaultPasswordHash = await bcrypt.hash('Admin123!', 10);
    const existingUsers = await User.find({}).select('+password_hash');
    for (const u of existingUsers) {
      if (!u.password_hash) {
        u.password_hash = defaultPasswordHash;
      }
      u.login_failures = { count: 0, last_failed_at: null, lockout_until: null };
      u.deletion_pending = false;
      u.deletion_requested_at = null;
      u.deletion_expires_at = null;
      await u.save();
    }

    // Ensure default admin user exists
    let adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        username: 'admin',
        password_hash: defaultPasswordHash,
        email: 'admin@ics-guard.com',
        full_name: 'SOC Administrator',
        role: 'admin',
        is_active: true,
        isFirstLogin: false
      });
    }

    const usersCount = await User.countDocuments({});
    console.log(`[RESET] [BẢO TỒN] Đã giữ nguyên ${usersCount} tài khoản người dùng và thiết lập mật khẩu hợp lệ (Mặc định: Admin123!).`);

    // 2. Preserve and Clean Devices
    const devicesCount = await Device.countDocuments({});
    await Device.updateMany(
      {},
      { 
        $set: { 
          risk_score: 0, 
          aging_score: 0, 
          status: 'active', 
          approval_status: 'approved',
          isolation_status: 'none'
        } 
      }
    );
    console.log(`[RESET] [BẢO TỒN] Đã giữ nguyên ${devicesCount} thiết bị. Reset risk_score = 0, aging_score = 0, status = active.`);

    // 3. Clear Stale Operational & Incident Data
    const deletedAlerts = await Alert.deleteMany({});
    const deletedIncidents = await Incident.deleteMany({});
    const deletedTimelines = await IncidentTimeline.deleteMany({});
    const deletedAuditLogs = await AuditLog.deleteMany({});
    const deletedBlockedIps = await BlockedIp.deleteMany({});
    const deletedSimCmds = await SimulatorCommand.deleteMany({});
    const deletedTokens = await RefreshToken.deleteMany({});

    console.log(`[RESET] [XÓA SẠCH] Cảnh báo (Alerts): ${deletedAlerts.deletedCount} bản ghi.`);
    console.log(`[RESET] [XÓA SẠCH] Sự cố (Incidents): ${deletedIncidents.deletedCount} bản ghi.`);
    console.log(`[RESET] [XÓA SẠCH] Timeline sự cố: ${deletedTimelines.deletedCount} bản ghi.`);
    console.log(`[RESET] [XÓA SẠCH] Audit Logs: ${deletedAuditLogs.deletedCount} bản ghi.`);
    console.log(`[RESET] [XÓA SẠCH] IP bị chặn (Blocked IPs): ${deletedBlockedIps.deletedCount} bản ghi.`);
    console.log(`[RESET] [XÓA SẠCH] Lệnh simulator: ${deletedSimCmds.deletedCount} bản ghi.`);
    console.log(`[RESET] [XÓA SẠCH] Refresh Tokens: ${deletedTokens.deletedCount} bản ghi.`);

    // 4. Seed Essential Clean Rules & Playbooks
    await Rule.deleteMany({});
    await Playbook.deleteMany({});

    const essentialRules = [
      {
        rule_id: 'RULE-MODBUS-FC06',
        rule_name: 'Phát Hiện Ghi Đè Thanh Ghi Modbus Trai Phép (FC06)',
        description: 'Phát hiện gói tin Modbus TCP FC06 ghi đè thanh ghi điều khiển PLC từ IP không nằm trong whitelist',
        conditions: [
          { field: 'modbus.function_code', operator: '==', value: 6 }
        ],
        severity: 'CRITICAL',
        category: 'ICS_PROTOCOL',
        trigger_count: 1,
        time_window_seconds: 60,
        is_active: true
      },
      {
        rule_id: 'RULE-SSH-BRUTEFORCE',
        rule_name: 'Phát Hiện Tấn Công Dò Mật Khẩu SSH (Brute-Force)',
        description: 'Phát hiện trên 5 lần đăng nhập SSH thất bại trong 60 giây tới Gateway/Workstation',
        conditions: [
          { field: 'ssh.login_failures', operator: '>', value: 5 }
        ],
        severity: 'CRITICAL',
        category: 'NETWORK_SCAN',
        trigger_count: 5,
        time_window_seconds: 60,
        is_active: true
      },
      {
        rule_id: 'RULE-ANALOG-OVERTEMP',
        rule_name: 'Phát Hiện Vượt Ngưỡng Nhiệt Độ Cảm Biến An Toàn',
        description: 'Phát hiện tín hiệu 4-20mA từ cảm biến nhiệt độ vượt quá 85°C trong vùng sản xuất',
        conditions: [
          { field: 'telemetry.temperature', operator: '>', value: 85 }
        ],
        severity: 'HIGH',
        category: 'BEHAVIOR',
        trigger_count: 1,
        time_window_seconds: 30,
        is_active: true
      }
    ];

    const createdRules = await Rule.insertMany(essentialRules);
    console.log(`[RESET] [KHỞI TẠO] Đã nạp ${createdRules.length} Quy Tắc Phát Hiện Tiêu Chuẩn (Rules).`);

    const essentialPlaybooks = [
      {
        name: 'Auto Isolate Infected PLC',
        description: 'Tự động ngắt mạng và cô lập PLC ngay lập tức khi phát hiện tấn công vi phạm quy trình ghi đè thanh ghi Modbus',
        trigger_rule: 'RULE-MODBUS-FC06',
        actions: [
          { action_type: 'isolate_device', description: 'Cô lập thiết bị khỏi mạng OT' }
        ],
        is_active: true
      },
      {
        name: 'Auto Block Attacker IP',
        description: 'Tự động bổ sung IP nguồn tấn công Brute-force SSH vào danh sách chặn IP',
        trigger_rule: 'RULE-SSH-BRUTEFORCE',
        actions: [
          { action_type: 'block_ip', description: 'Chặn IP nguồn tại Firewall' }
        ],
        is_active: true
      }
    ];

    const createdPlaybooks = await Playbook.insertMany(essentialPlaybooks);
    console.log(`[RESET] [KHỞI TẠO] Đã nạp ${createdPlaybooks.length} Kịch Bản Ứng Cứu Tự Động SOAR (Playbooks).`);

    // 5. Seed Initial Audit Log
    await AuditLog.create({
      action: 'SYSTEM_CLEAN_RESET',
      actor: 'System Administrator',
      ip_address: '127.0.0.1',
      details: 'Hệ thống đã được làm sạch toàn bộ dữ liệu sự cố/cảnh báo. Bảo tồn tài khoản người dùng và sơ đồ thiết bị để thực hiện kiểm thử toàn diện.',
      severity: 'INFO'
    });
    console.log('[RESET] [KHỞI TẠO] Đã ghi 1 nhật ký AuditLog khởi tạo hệ thống mới.');

    // 6. Reset InfluxDB
    await resetInfluxDb();

    console.log('====================================================');
    console.log('[RESET] [SUCCESS] HOÀN TẤT DỌN DẸP! DỰ ÁN SẴN SÀNG ĐỂ KIỂM THỬ.');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error('[RESET] [ERROR] Lỗi khi thực hiện dọn dẹp Database:', error);
    process.exit(1);
  }
}

runCleanReset();
