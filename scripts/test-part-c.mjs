/**
 * Automated Verification Script for Part C:
 * 1. Payments SQL migration verification (RLS enabled, no public policies, text length checks)
 * 2. /api/admin/payments route security and response format verification
 * 3. Elimination of localStorage reads affecting admin data (including messages page deleted-accounts filter)
 */

import { execSync } from 'child_process';
import fs from 'fs';

function runCheck(title, fn) {
  process.stdout.write(`Testing: ${title}... `);
  try {
    fn();
    console.log('\x1b[32m[PASS]\x1b[0m');
    return true;
  } catch (err) {
    console.log('\x1b[31m[FAIL]\x1b[0m');
    console.error('  Error:', err.message);
    return false;
  }
}

let passed = 0;
let total = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('=== PART C VERIFICATION: PAYMENTS TABLE & ADMIN LOCAL DATA PURGE ===\n');

// Test 1: Verify SQL migration file exists and contains all required security constraints
total++;
if (runCheck('Verify 20261110_create_payments.sql has RLS, checks, and no public policies', () => {
  const sqlPath = 'supabase/migrations/20261110_create_payments.sql';
  assert(fs.existsSync(sqlPath), `${sqlPath} must exist`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert(sql.includes('create table if not exists public.payments'), 'Must create public.payments table');
  assert(sql.includes('char_length(company_name) <= 255'), 'Must check company_name length <= 255');
  assert(sql.includes('char_length(contact_email) <= 255'), 'Must check contact_email length <= 255');
  assert(sql.includes('char_length(plan_or_service) <= 100'), 'Must check plan_or_service length <= 100');
  assert(sql.includes('amount_gbp numeric(10, 2) not null check (amount_gbp >= 0)'), 'Must check amount_gbp >= 0');
  assert(sql.includes('char_length(payment_method) <= 100'), 'Must check payment_method length <= 100');
  assert(sql.includes('char_length(invoice_number) <= 100'), 'Must check invoice_number length <= 100');
  assert(sql.includes('status in (\'Completed\', \'Pending Verification\', \'Failed\', \'Refunded\')'), 'Must validate payment status');
  assert(sql.includes('alter table public.payments enable row level security'), 'Must enable RLS');
  assert(sql.includes('alter table public.payments force row level security'), 'Must force RLS');
  assert(!sql.toLowerCase().includes('create policy') && !sql.toLowerCase().includes('to anon') && !sql.toLowerCase().includes('to authenticated'), 'Must define NO public policies (service-role only)');
})) passed++;

// Test 2: Verify /api/admin/payments uses Supabase admin client and requireAdmin()
total++;
if (runCheck('Verify /api/admin/payments route uses createAdminClient and requireAdmin', () => {
  const file = fs.readFileSync('src/app/api/admin/payments/route.ts', 'utf8');
  assert(file.includes('requireAdmin'), 'Route must enforce requireAdmin');
  assert(file.includes('createAdminClient'), 'Route must use createAdminClient');
  assert(file.includes(".from('payments')"), 'Route must query public.payments');
  assert(!file.includes('let manualPayments'), 'In-memory ledger array must be removed');
})) passed++;

// Test 3: Verify messages page does not use isAccountDeleted or localStorage
total++;
if (runCheck('Verify Messages page has no isAccountDeleted or deleted-accounts localStorage filter', () => {
  const file = fs.readFileSync('src/app/site-admin/messages/page.tsx', 'utf8');
  assert(!file.includes('isAccountDeleted'), 'Messages page must not use isAccountDeleted');
  assert(!file.includes('markAccountAsDeleted'), 'Messages page must not use markAccountAsDeleted');
  assert(!file.includes('localStorage'), 'Messages page must not read or write localStorage');
})) passed++;

// Test 4: Verify site-admin pages do not read localStorage for admin accounts, listings, payments, or queries
total++;
if (runCheck('Verify site-admin pages do not read localStorage for admin data', () => {
  const adminPages = [
    'src/app/site-admin/page.tsx',
    'src/app/site-admin/users/page.tsx',
    'src/app/site-admin/listings/page.tsx',
    'src/app/site-admin/payments/page.tsx',
    'src/app/site-admin/queries/page.tsx',
    'src/app/site-admin/messages/page.tsx',
  ];

  for (const page of adminPages) {
    const content = fs.readFileSync(page, 'utf8');
    assert(!content.includes("localStorage.getItem('b2b_admin_accounts"), `${page} must not read b2b_admin_accounts from localStorage`);
    assert(!content.includes("localStorage.getItem('b2b_admin_listings"), `${page} must not read b2b_admin_listings from localStorage`);
    assert(!content.includes("localStorage.getItem('b2b_admin_payments"), `${page} must not read b2b_admin_payments from localStorage`);
    assert(!content.includes("localStorage.getItem('b2b_customer_queries"), `${page} must not read b2b_customer_queries from localStorage`);
    assert(!content.includes("localStorage.getItem('b2b_seller_listings"), `${page} must not read b2b_seller_listings from localStorage`);
    assert(!content.includes("localStorage.getItem('b2b_user_wtb_requests"), `${page} must not read b2b_user_wtb_requests from localStorage`);
  }
})) passed++;

// Test 5: Verify admin-store functions return empty arrays without localStorage reads
total++;
if (runCheck('Verify admin-store functions do not read localStorage for admin data', () => {
  const file = fs.readFileSync('src/lib/admin/admin-store.ts', 'utf8');
  assert(file.includes('export function getAdminPayments(): AdminPaymentRecord[] {\n  return [];'), 'getAdminPayments returns empty array');
  assert(file.includes('export function getAdminAccounts(): AdminClientAccount[] {\n  return [];'), 'getAdminAccounts returns empty array');
  assert(file.includes('export function getAdminListings(): AdminModeratedListing[] {\n  return [];'), 'getAdminListings returns empty array');
  assert(file.includes('export function getCustomerQueries(): CustomerQuery[] {\n  return [];'), 'getCustomerQueries returns empty array');
  assert(file.includes('export function isAccountDeleted(_id?: string | null, _email?: string | null): boolean {\n  return false;'), 'isAccountDeleted returns false');
})) passed++;

console.log(`\nPart C Results: ${passed}/${total} checks passed.\n`);
if (passed !== total) process.exit(1);
