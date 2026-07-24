import auditRepository from '../repositories/auditRepository.js';
import blockedIpRepository from '../repositories/blockedIpRepository.js';
import socketService from './socketService.js';
import { sendEmailAlert } from './emailService.js';
import { sendTelegramAlert } from './telegramService.js';
import { publishMqtt } from './mqttService.js';
import { AUTH_CONSTANTS, ATTACK_TYPES, AUDIT_STATUSES, DEVICE_STATUSES } from '../constants/index.js';

// In-memory tracker for failed IP attempts
// Format: { '192.168.1.1': [timestamp1, timestamp2, ...] }
const failedIpAttempts = {};

export const registerFailedIpAttempt = async (ipAddress) => {
  const now = Date.now();
  const maxAttempts = parseInt(process.env.MAX_FAILED_REQUESTS_IP || '10');
  const windowMs = AUTH_CONSTANTS.LOCKOUT_WINDOW_MS; // default 5 minutes window
  const blockHours = parseInt(process.env.IP_BLOCK_TIME_HOURS || '24');

  if (!failedIpAttempts[ipAddress]) {
    failedIpAttempts[ipAddress] = [];
  }

  // Add current attempt and filter out attempts older than window
  failedIpAttempts[ipAddress].push(now);
  failedIpAttempts[ipAddress] = failedIpAttempts[ipAddress].filter(ts => now - ts < windowMs);

  console.log(`[SecurityService] IP ${ipAddress} failed attempt count: ${failedIpAttempts[ipAddress].length}/${maxAttempts}`);

  if (failedIpAttempts[ipAddress].length >= maxAttempts) {
    // Block IP!
    const expiresAt = new Date(now + blockHours * 60 * 60 * 1000);
    const reason = `Auto Block: Exceeded ${maxAttempts} failed requests within 5 minutes.`;

    try {
      await blockedIpRepository.upsertByIp(ipAddress, { reason, expiresAt });

      // Clear memory
      delete failedIpAttempts[ipAddress];

      // Audit Log
      await auditRepository.create({
        action: 'IP_AUTO_BLOCK',
        username: 'System',
        ipAddress,
        userAgent: 'Internal Security System',
        details: { ipAddress, reason, blockDurationHours: blockHours },
        status: AUDIT_STATUSES.SUCCESS,
      });

      // Send Alert Email
      const emailText = `Security Alert: The IP address ${ipAddress} has been automatically blocked for ${blockHours} hours due to suspicious behavior (exceeding login failure thresholds).`;
      await sendEmailAlert({
        subject: `IP ADDRESS BLOCKED: ${ipAddress}`,
        text: emailText,
        html: `<p><strong>Security Alert:</strong> The IP address <code>${ipAddress}</code> has been automatically blocked for <strong>${blockHours} hours</strong> due to suspicious behavior.</p>
               <p>Reason: ${reason}</p>`,
      });

      // Send Alert Telegram
      const telegramText = `🚨 *SECURITY ALERT: IP BLOCKED*\n\nIP Address *${ipAddress}* has been auto-blocked for ${blockHours} hours.\n*Reason:* ${reason}`;
      await sendTelegramAlert(telegramText);

      console.log(`[SecurityService] IP ${ipAddress} successfully auto-blocked.`);
    } catch (error) {
      console.error('[SecurityService] Failed to auto-block IP:', error);
    }
  }
};

export const handleFailedLogin = async (user, ipAddress) => {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || AUTH_CONSTANTS.LOGIN_MAX_ATTEMPTS);
  const lockMinutes = parseInt(process.env.LOCK_TIME_MINUTES || AUTH_CONSTANTS.LOCKOUT_MINUTES);

  if (!user.login_failures) {
    user.login_failures = { count: 0, last_failed_at: null, lockout_until: null };
  }

  user.login_failures.count += 1;
  user.login_failures.last_failed_at = new Date();

  if (user.login_failures.count >= maxAttempts) {
    user.login_failures.lockout_until = new Date(Date.now() + lockMinutes * 60 * 1000);

    // Audit Log
    await auditRepository.create({
      userId: user._id,
      username: user.username,
      action: 'USER_LOCKOUT',
      ipAddress,
      details: { reason: `Exceeded ${maxAttempts} failed login attempts. Locked for ${lockMinutes} mins.` },
      status: AUDIT_STATUSES.SUCCESS,
    });

    // Send Alert Notification
    const alertSubject = `USER ACCOUNT LOCKEDOUT: ${user.username}`;
    const alertText = `Security Alert: User account "${user.username}" has been locked for ${lockMinutes} minutes due to ${maxAttempts} consecutive failed login attempts. Origin IP: ${ipAddress}`;

    await sendEmailAlert({
      subject: alertSubject,
      text: alertText,
      html: `<p><strong>Security Alert:</strong> User account <strong>${user.username}</strong> has been locked for <strong>${lockMinutes} minutes</strong>.</p>
             <p>Reason: Exceeded ${maxAttempts} login attempts.</p>
             <p>Origin IP: <code>${ipAddress}</code></p>`,
    });

    await sendTelegramAlert(
      `🚨 *SECURITY ALERT: ACCOUNT LOCKEDOUT*\n\nUser *${user.username}* has been locked for ${lockMinutes} minutes due to multiple login failures.\n*Origin IP:* ${ipAddress}`,
      [
        { text: `🚫 Block IP ${ipAddress}`, callback_data: `block_ip:${ipAddress}` }
      ]
    );
  }

  await user.save();
};

export const handleSuccessfulLogin = async (user) => {
  if (user.login_failures && (user.login_failures.count > 0 || user.login_failures.lockout_until)) {
    user.login_failures.count = 0;
    user.login_failures.lockout_until = null;
    await user.save();
  }
};

export const isolateDevice = async (device, triggeredBy = 'System', ipAddress = 'Internal') => {
  if (device.status === DEVICE_STATUSES.ISOLATED) return;

  device.status = DEVICE_STATUSES.ISOLATED;
  await device.save();

  // Automatically stop attack simulation on isolated device
  try {
    publishMqtt('ics/control/attack', { device_id: device._id, attack_type: ATTACK_TYPES.STOP });
  } catch (error) {
    console.error('[SecurityService] Failed to publish stop attack command to MQTT:', error);
  }

  // Audit Log
  await auditRepository.create({
    action: 'DEVICE_ISOLATION_TRIGGERED',
    username: triggeredBy,
    ipAddress,
    details: { deviceId: device._id, name: device.name, ipAddress: device.ipAddress },
    status: AUDIT_STATUSES.SUCCESS,
  });

  // Notifications
  const subject = `DEVICE ISOLATED: ${device.name}`;
  const text = `Critical Alert: Device "${device.name}" (IP: ${device.ipAddress}, Type: ${device.type}) has been isolated from the network. Triggered by ${triggeredBy}.`;

  await sendEmailAlert({
    subject,
    text,
    html: `<h3>Critical Infrastructure Alert</h3>
           <p>Device <strong>${device.name}</strong> (IP: <code>${device.ipAddress}</code>, Type: ${device.type}) has been <strong>ISOLATED</strong> from the network.</p>
           <p>Triggered by: ${triggeredBy}</p>`,
  });

  await sendTelegramAlert(
    `🚨 *CRITICAL INFRASTRUCTURE ALERT*\n\nDevice *${device.name}* (IP: ${device.ipAddress}) has been *ISOLATED* from the network.\nTriggered by: ${triggeredBy}`
  );
};

export default {
  registerFailedIpAttempt,
  handleFailedLogin,
  handleSuccessfulLogin,
  isolateDevice,
};
