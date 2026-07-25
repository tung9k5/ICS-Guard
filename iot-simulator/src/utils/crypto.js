import crypto from 'crypto';
import { config } from '../config/index.js';

export const encryptPayload = (payload) => {
  const dataStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const iv = crypto.randomBytes(16);
  // Pad the secret key to 32 bytes or slice it
  let key = Buffer.alloc(32);
  Buffer.from(config.aes.secretKey).copy(key);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(dataStr, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const encryptedData = `${iv.toString('base64')}:${encrypted}`;
  return JSON.stringify({ encrypted_data: encryptedData });
};

export const decryptPayload = (encryptedJson) => {
  try {
    const data = typeof encryptedJson === 'string' ? JSON.parse(encryptedJson) : encryptedJson;
    if (!data.encrypted_data) return data;
    
    const parts = data.encrypted_data.split(':');
    if (parts.length !== 2) throw new Error('Invalid encrypted format');
    
    const iv = Buffer.from(parts[0], 'base64');
    const ciphertext = parts[1];
    
    let key = Buffer.alloc(32);
    Buffer.from(config.aes.secretKey).copy(key);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    throw new Error('Decryption failed: ' + err.message);
  }
};
