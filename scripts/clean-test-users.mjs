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

async function clean() {
  const { data: users } = await admin.auth.admin.listUsers();
  for (const u of users?.users || []) {
    if (u.email && (u.email.includes('live-qa') || u.email.includes('testcorp'))) {
      console.log('Cleaning up user:', u.email, u.id);
      await admin.auth.admin.deleteUser(u.id);
      await admin.from('companies').delete().eq('user_id', u.id);
      await admin.from('product_inquiries').delete().eq('buyer_email', u.email);
    }
  }
  console.log('Finished cleaning test users.');
}

clean();
