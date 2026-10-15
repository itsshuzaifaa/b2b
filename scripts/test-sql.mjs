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

async function testSql() {
  // Test pg meta sql endpoint
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/pg/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: 'SELECT 1;' }),
  });
  console.log('/pg/query status:', res.status);
  if (res.ok) {
    console.log('/pg/query result:', await res.json());
  } else {
    console.log('/pg/query text:', await res.text());
  }

  // Also check /rest/v1/rpc/exec_sql or similar
  const res2 = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    }
  });
  console.log('/rest/v1/rpc status:', res2.status);
}

testSql().catch(console.error);
