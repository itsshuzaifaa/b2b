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

async function check() {
  const { data: companies } = await supabase.from('companies').select('*');
  console.log('Companies in Supabase:', companies?.length);
  console.log(companies?.map(c => ({ id: c.id, name: c.company_name, email: c.contact_email, role: c.role })));

  const { data: prods } = await supabase.from('products').select('*');
  console.log('Products in Supabase:', prods);

  const { data: cats } = await supabase.from('categories').select('*');
  console.log('Categories in Supabase:', cats?.length, cats?.map(c => ({ id: c.id, slug: c.slug, name: c.name })));
}

check().catch(console.error);
