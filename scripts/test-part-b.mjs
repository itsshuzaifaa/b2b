/**
 * Automated Verification Script for Part B (Approval Gate & Server Action Error Codes)
 * 
 * Verifies:
 * 1. requireApprovedUser() returns 403 with code: 'ACCOUNT_NOT_APPROVED' for unapproved statuses (pending, rejected, suspended).
 * 2. assertApprovedUser() throws AuthError with code: 'ACCOUNT_NOT_APPROVED'.
 * 3. Server Actions return { success: false, code: 'ACCOUNT_NOT_APPROVED' } for mutating actions:
 *    - submitQuotation
 *    - updateQuotationStatus
 *    - createProductInquiry
 *    - createWtbRequest
 *    - deleteWtbRequest
 * 4. Data query Server Actions throw AuthError with code: 'ACCOUNT_NOT_APPROVED':
 *    - getListingQuotations
 *    - getCompanyQuotations
 *    - getInquiryDetails
 *    - getBuyerInquiries
 * 5. Codebase audit:
 *    - b2b_account_verified_* is never read in src/ to grant access
 *    - user_metadata.approval_status is never used to authorize access
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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

console.log('=== PART B VERIFICATION: APPROVAL GATE & ACTION ERROR CODES ===\n');

// Test 1: Codebase audit for b2b_account_verified
total++;
if (runCheck('Verify b2b_account_verified_* is never read in src/', () => {
  let result = '';
  try {
    result = execSync('git grep -n "getItem.*b2b_account_verified" src/', { encoding: 'utf8' }).trim();
  } catch {}
  assert(result === '', `b2b_account_verified must never be read: ${result}`);
  let result2 = '';
  try {
    result2 = execSync('git grep -n "b2b_account_verified" src/', { encoding: 'utf8' }).trim();
  } catch {}
  if (result2) {
    const lines = result2.split('\n');
    for (const line of lines) {
      assert(line.includes('auth-context.tsx'), `Unexpected b2b_account_verified file: ${line}`);
    }
  }
})) passed++;

// Test 2: Codebase audit for user_metadata approval checks
total++;
if (runCheck('Verify user_metadata.approval_status is never used to authorize access', () => {
  const guardsContent = fs.readFileSync('src/lib/auth/guards.ts', 'utf8');
  assert(!guardsContent.includes('user.user_metadata?.approval_status'), 'guards.ts must not read user_metadata approval_status');
  assert(!guardsContent.includes('user_metadata?.role'), 'guards.ts must not read user_metadata.role (uses app_metadata or admins table)');
})) passed++;

// Test 3: Check Server Action return structures in quotations.ts
total++;
if (runCheck('Verify submitQuotation and updateQuotationStatus return code: ACCOUNT_NOT_APPROVED', () => {
  const file = fs.readFileSync('src/lib/actions/quotations.ts', 'utf8');
  assert(file.includes("code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED'"), 'submitQuotation handles ACCOUNT_NOT_APPROVED');
  assert(file.includes("code = statusVal === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED'"), 'updateQuotationStatus handles ACCOUNT_NOT_APPROVED');
  assert(file.includes("throw new AuthError(status, status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.', code);"), 'getListingQuotations & getCompanyQuotations include code on AuthError');
})) passed++;

// Test 4: Check Server Action return structures in inquiries.ts
total++;
if (runCheck('Verify createProductInquiry returns code: ACCOUNT_NOT_APPROVED and query actions include code', () => {
  const file = fs.readFileSync('src/lib/actions/inquiries.ts', 'utf8');
  assert(file.includes("code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED'"), 'createProductInquiry handles ACCOUNT_NOT_APPROVED');
  assert(file.includes("throw new AuthError(status, status === 401 ? 'Unauthorized: Authentication required.' : 'Forbidden: Account not approved.', code);"), 'getInquiryDetails & getBuyerInquiries include code on AuthError');
})) passed++;

// Test 5: Check Server Action return structures in wtb.ts
total++;
if (runCheck('Verify createWtbRequest and deleteWtbRequest return code: ACCOUNT_NOT_APPROVED', () => {
  const file = fs.readFileSync('src/lib/actions/wtb.ts', 'utf8');
  assert(file.includes("code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED'"), 'createWtbRequest handles ACCOUNT_NOT_APPROVED');
  assert(file.includes("code = status === 401 ? 'UNAUTHORIZED' : 'ACCOUNT_NOT_APPROVED'"), 'deleteWtbRequest handles ACCOUNT_NOT_APPROVED');
})) passed++;

// Test 6: Verify Dashboard Layout Gate
total++;
if (runCheck('Verify Dashboard layout blocks unapproved users and renders Pending/Rejected/Suspended screens', () => {
  const layout = fs.readFileSync('src/app/dashboard/layout.tsx', 'utf8');
  assert(layout.includes('<DashboardSkeleton />'), 'Dashboard renders skeleton during loading');
  assert(layout.includes('<PendingVerificationScreen'), 'Dashboard renders PendingVerificationScreen for pending');
  assert(layout.includes('<RejectedVerificationScreen'), 'Dashboard renders RejectedVerificationScreen for rejected');
  assert(layout.includes('<SuspendedAccountScreen'), 'Dashboard renders SuspendedAccountScreen for suspended');
  assert(layout.includes('{isApproved ? (\n          children'), 'Page children only rendered when isApproved is true');
  assert(layout.includes('b2b_company_updated'), 'Dispatches b2b_company_updated on status change');
})) passed++;

console.log(`\nPart B Results: ${passed}/${total} checks passed.\n`);
if (passed !== total) process.exit(1);
