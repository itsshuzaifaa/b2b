import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const test1 = await admin.auth.admin.generateLink({ type: 'recovery', email: 'nonexistent_test_12345@b2blink.eu' });
  console.log('Non-existent user result:');
  console.log(' - error:', test1.error?.message);
  console.log(' - user:', test1.data?.user?.id);

  const test2 = await admin.auth.admin.generateLink({ type: 'recovery', email: 'admin@b2blink.eu' });
  console.log('Existing user result:');
  console.log(' - error:', test2.error?.message);
  console.log(' - user id:', test2.data?.user?.id);
  console.log(' - contact name:', test2.data?.user?.user_metadata?.contact_name);
}

run();
