import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectEnvPath = path.resolve(__dirname, '..', '..', '.env');

const result = dotenv.config({ path: projectEnvPath });
if (result.error && process.env.NODE_ENV !== 'test') {
  console.warn(`[Bootstrap] Root environment file was not loaded: ${projectEnvPath}`);
}

await import('./app.js');
