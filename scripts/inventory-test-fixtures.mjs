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
  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  const testUsers = (usersData?.users || []).filter((u) => {
    const em = (u.email || '').toLowerCase();
    return em.includes('test') || em.includes('example.com') || em.endsWith('@b2btest.com') || em.endsWith('@test.internal');
  });

  console.log('=== TEST USERS (' + testUsers.length + ') ===');
  testUsers.forEach((u) => console.log(` - User ID: ${u.id} | Email: ${u.email}`));

  const { data: comps } = await admin.from('companies').select('id, user_id, company_name, contact_email, created_at');
  const testComps = (comps || []).filter((c) => {
    const em = (c.contact_email || '').toLowerCase();
    const nm = (c.company_name || '').toLowerCase();
    return em.includes('test') || em.includes('example.com') || nm.includes('test') || nm.includes('approved wholesale') || nm.includes('owner company');
  });

  console.log('\n=== TEST COMPANIES (' + testComps.length + ') ===');
  testComps.forEach((c) => console.log(` - Company ID: ${c.id} | Name: ${c.company_name} | Email: ${c.contact_email} | UserID: ${c.user_id}`));

  const { data: prods } = await admin.from('products').select('id, company_id, title, created_at');
  const testProds = (prods || []).filter((p) => {
    const t = (p.title || '').toLowerCase();
    return t.includes('approved wholesale') || t.includes('legitimate owned') || t.includes('test');
  });

  console.log('\n=== TEST PRODUCTS (' + testProds.length + ') ===');
  testProds.forEach((p) => console.log(` - Product ID: ${p.id} | Title: ${p.title} | CompanyID: ${p.company_id}`));
}

run();
