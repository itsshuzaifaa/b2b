import { Redis } from '@upstash/redis';

/**
 * Upstash Redis Serverless Client
 * Initialized from UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export default redis;
