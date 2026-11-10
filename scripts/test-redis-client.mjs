import { redis } from '../src/lib/redis.ts';

async function test() {
  console.log('Testing Upstash Redis client connection...');
  try {
    const pingRes = await redis.ping();
    console.log('PING response:', pingRes);

    const testKey = `test:b2b-link:${Date.now()}`;
    await redis.set(testKey, { project: 'B2B LINK', status: 'online' }, { ex: 60 });
    const val = await redis.get(testKey);
    console.log('SET/GET response:', val);
    await redis.del(testKey);
    console.log('Redis client is 100% operational!');
  } catch (err) {
    console.error('Redis test failed:', err);
    process.exit(1);
  }
}

test();
