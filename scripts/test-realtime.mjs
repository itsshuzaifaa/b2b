import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const client1 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const client2 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testRealtime() {
  console.log('Testing Supabase Realtime Broadcast...');
  const ch1 = client1.channel('test-channel');
  const ch2 = client2.channel('test-channel');

  let received = false;

  ch2.on('broadcast', { event: 'test-event' }, ({ payload }) => {
    console.log('Client 2 received broadcast payload:', payload);
    received = true;
  });

  await ch2.subscribe();
  await ch1.subscribe();

  console.log('Channels subscribed. Sending broadcast from client 1...');
  await ch1.send({
    type: 'broadcast',
    event: 'test-event',
    payload: { message: 'Hello from client 1!', timestamp: new Date().toISOString() },
  });

  await new Promise(r => setTimeout(r, 2000));
  console.log('Broadcast received successfully?:', received);

  await ch1.unsubscribe();
  await ch2.unsubscribe();
}

testRealtime().catch(console.error);
