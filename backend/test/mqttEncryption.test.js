import { jest } from '@jest/globals';
import crypto from 'crypto';
import { decryptPayload } from '../src/services/mqttService.js';

describe('MQTT Encryption & Decryption (AES-256-GCM / AES-256-CBC)', () => {
  const secretKey = 'ics_guard_aes256_secure_key_1234'; // 32 bytes
  const legacyIv = 'ics_guard_iv_012'; // 16 bytes

  beforeAll(() => {
    process.env.AES_SECRET_KEY = secretKey;
    process.env.AES_IV = legacyIv;
  });

  test('should decrypt valid AES-256-GCM payload', () => {
    const originalData = { message: 'hello_gcm', device_id: 'device_gcm' };
    const dataStr = JSON.stringify(originalData);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secretKey), iv);
    let encrypted = cipher.update(dataStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    const payloadObj = {
      encrypted_data: encrypted,
      iv: iv.toString('base64'),
      auth_tag: authTag,
      alg: 'AES-256-GCM'
    };

    const decrypted = decryptPayload(payloadObj);
    expect(decrypted).toEqual(originalData);
  });

  test('should decrypt legacy AES-256-CBC payload', () => {
    const originalData = { message: 'hello_cbc', device_id: 'device_cbc' };
    const dataStr = JSON.stringify(originalData);

    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey), Buffer.from(legacyIv));
    let encrypted = cipher.update(dataStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const payloadObj = {
      encrypted_data: encrypted
    };

    const decrypted = decryptPayload(payloadObj);
    expect(decrypted).toEqual(originalData);
  });

  test('should throw error/fail to decrypt GCM payload if auth_tag is invalid/corrupted', () => {
    const originalData = { message: 'hello_gcm_fail' };
    const dataStr = JSON.stringify(originalData);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secretKey), iv);
    let encrypted = cipher.update(dataStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Corrupt auth tag by changing one character
    const badAuthTag = Buffer.from('corrupted_tag_val').toString('base64');

    const payloadObj = {
      encrypted_data: encrypted,
      iv: iv.toString('base64'),
      auth_tag: badAuthTag,
      alg: 'AES-256-GCM'
    };

    expect(() => {
      decryptPayload(payloadObj);
    }).toThrow();
  });
});
