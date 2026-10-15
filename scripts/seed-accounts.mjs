import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('--- Seeding Admin and Seller Accounts in Supabase ---');
  console.log('Supabase URL:', supabaseUrl);

  const accounts = [
    {
      email: 'admin@b2blink.eu',
      password: 'AdminPassword2026!',
      companyName: 'B2B LINK OÜ (Jeff Admin)',
      contactName: 'Jeff Vetting Director',
      role: 'admin',
      approvalStatus: 'approved',
      membershipTier: 'gold',
      niches: ['0e07e810-fb76-4431-ba0f-6d98d6be357c'],
    },
    {
      email: 'seller@nordictech.eu',
      password: 'SellerPassword2026!',
      companyName: 'Nordic Electro Wholesale Ltd',
      contactName: 'Lars Lindqvist',
      role: 'seller',
      approvalStatus: 'pending', // Pending to allow testing the Wise payment activation banner!
      membershipTier: 'silver',
      niches: ['0e07e810-fb76-4431-ba0f-6d98d6be357c'],
    },
  ];

  for (const acc of accounts) {
    console.log(`\nProcessing account: ${acc.email} (${acc.role})`);

    // 1. Create or get user in Supabase Auth
    let userId;
    const { data: userList } = await supabase.auth.admin.listUsers();
    const existing = userList?.users?.find((u) => u.email === acc.email);

    if (existing) {
      console.log(`  Auth user already exists: ${existing.id}. Updating password...`);
      const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          contact_name: acc.contactName,
          company_name: acc.companyName,
          role: acc.role,
        },
      });
      if (updateErr) {
        console.error('  Failed to update user:', updateErr.message);
      } else {
        userId = updated.user.id;
        console.log('  Updated auth user successfully.');
      }
    } else {
      console.log(`  Creating new auth user...`);
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          contact_name: acc.contactName,
          company_name: acc.companyName,
          role: acc.role,
        },
      });
      if (createErr) {
        console.error('  Failed to create auth user:', createErr.message);
      } else {
        userId = created.user.id;
        console.log(`  Created auth user with ID: ${userId}`);
      }
    }

    // 2. Ensure company record exists in public.companies table
    const { data: compRows, error: compFetchErr } = await supabase
      .from('companies')
      .select('id, contact_email')
      .eq('contact_email', acc.email);

    if (compFetchErr) {
      console.warn('  Notice fetching companies table:', compFetchErr.message);
    } else if (compRows && compRows.length > 0) {
      console.log('  Company row exists, updating details...');
      const { error: compUpdateErr } = await supabase
        .from('companies')
        .update({
          user_id: userId,
          company_name: acc.companyName,
          contact_name: acc.contactName,
          role: acc.role,
          approval_status: acc.approvalStatus,
          tier: acc.membershipTier,
          niches: acc.categories,
          updated_at: new Date().toISOString(),
        })
        .eq('contact_email', acc.email);

      if (compUpdateErr) console.warn('  Company update notice:', compUpdateErr.message);
      else console.log('  Updated company row.');
    } else {
      console.log('  Inserting company row...');
      const { error: compInsertErr } = await supabase.from('companies').insert({
        user_id: userId,
        company_name: acc.companyName,
        contact_name: acc.contactName,
        contact_email: acc.email,
        role: acc.role,
        approval_status: acc.approvalStatus,
        tier: acc.membershipTier,
        niches: acc.categories,
      });

      if (compInsertErr) console.warn('  Company insert notice:', compInsertErr.message);
      else console.log('  Inserted company row.');
    }
  }

  console.log('\n--- Account Provisioning Complete ---');
}

main().catch(console.error);
