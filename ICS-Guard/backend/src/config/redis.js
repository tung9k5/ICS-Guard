import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

const redisClient = createClient({
  url: REDIS_URL
});

redisClient.on('error', (err) => console.error('[Redis Error]', err));
redisClient.on('connect', () => console.log(`[Redis] Connected successfully to ${REDIS_URL}`));

// Connect immediately, but handle errors gracefully without crashing the app
// if Redis is not yet running in Docker.
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('[Redis] Initial connection failed. Will retry or fail gracefully.');
  }
})();

export default redisClient;
