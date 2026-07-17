import nodemailer from 'nodemailer';
import { User } from '../models/index.js';
import { ROLES } from '../constants/index.js';

let transporter = null;

// Initialize transporter lazily or with Ethereal fallback
const getTransporter = async () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    console.log(`[EmailService] Initializing with custom SMTP (${host}:${port})`);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: { user, pass },
    });
  } else {
    console.log('[EmailService] No SMTP credentials in .env. Creating Ethereal testing account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[EmailService] Ethereal account created! User: ${testAccount.user}`);
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.error('[EmailService] Failed to create Ethereal SMTP test account, fallback to console log.', err);
      // Fallback dummy transporter that prints to console
      transporter = {
        sendMail: async (mailOptions) => {
          console.log('\n--- DUMMY EMAIL ALERT ---');
          console.log(`From: ${mailOptions.from}`);
          console.log(`To: ${mailOptions.to}`);
          console.log(`Subject: ${mailOptions.subject}`);
          console.log(`Text: ${mailOptions.text}`);
          console.log(`HTML: ${mailOptions.html}`);
          console.log('-------------------------\n');
          return { messageId: 'dummy-id', previewUrl: 'http://localhost' };
        }
      };
    }
  }

  return transporter;
};

export const _testSpies = {
  sendEmailAlertCalls: [],
  reset() {
    this.sendEmailAlertCalls = [];
  }
};

export const sendEmailAlert = async ({ subject, text, html }) => {
  if (process.env.NODE_ENV === 'test') {
    _testSpies.sendEmailAlertCalls.push({ subject, text, html });
    return 'http://ethereal.email/preview/test';
  }

  try {
    const mailTransporter = await getTransporter();
    const from = process.env.SMTP_FROM || '"ICS-Guard Alerts" <alerts@ics-guard.local>';
    
    // Fetch all active Admin user emails dynamically
    let recipients = [];
    try {
      const admins = await User.find({ role: ROLES.ADMIN, is_active: true }, 'email');
      recipients = admins.map(admin => admin.email).filter(Boolean);
    } catch (dbErr) {
      console.error('[EmailService] Failed to query admin emails:', dbErr);
    }

    if (recipients.length === 0) {
      const fallbackTo = process.env.SMTP_TO || 'admin@ics-guard.local';
      recipients.push(fallbackTo);
    }

    const to = recipients.join(', ');

    const info = await mailTransporter.sendMail({
      from,
      to,
      subject: `[ICS-Guard Alert] ${subject}`,
      text,
      html,
    });

    console.log(`[EmailService] Email alert sent: ${info.messageId}`);
    
    // If it's an Ethereal test account, print the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[EmailService] Preview Ethereal Email URL: ${previewUrl}`);
      return previewUrl;
    }
  } catch (error) {
    console.error('[EmailService] Failed to send email alert:', error);
  }
  return null;
};

export default { sendEmailAlert };
