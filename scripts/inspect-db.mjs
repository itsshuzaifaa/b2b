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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const testTables = ['companies', 'profiles', 'products', 'categories', 'product_inquiries', 'inquiries', 'messages', 'inquiry_messages', 'conversations'];
  for (const t of testTables) {
    const { data, error } = await supabase.from(t).select('*').limit(2);
    if (error) {
      console.log(`Table ${t}: Error -> ${error.message} (${error.code})`);
    } else {
      console.log(`Table ${t}: EXISTS! Sample count: ${data.length}`, data.length > 0 ? Object.keys(data[0]) : '(empty)');
      if (data.length > 0) {
        console.log(`Sample item 0 from ${t}:`, JSON.stringify(data[0], null, 2));
      }
    }
  }

  // Also check auth users
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  console.log('Auth users count:', users?.users?.length, users?.users?.map(u => ({ id: u.id, email: u.email, role: u.user_metadata?.role })));
}

inspect().catch(console.error);
