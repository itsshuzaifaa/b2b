const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const routesToTest = [
  // Admin Routes (Expected: 401 or 403)
  { method: 'GET', url: '/api/admin/accounts', expected: 401, desc: 'Admin accounts list' },
  { method: 'POST', url: '/api/admin/accounts', body: { action: 'verify' }, expected: 401, desc: 'Admin account mutation' },
  { method: 'DELETE', url: '/api/admin/accounts', body: { companyId: 'some-id' }, expected: 401, desc: 'Admin account deletion' },
  { method: 'GET', url: '/api/admin/campaigns', expected: 401, desc: 'Admin campaigns list' },
  { method: 'POST', url: '/api/admin/campaigns', body: { name: 'Test' }, expected: 401, desc: 'Admin campaign creation' },
  { method: 'GET', url: '/api/admin/payments', expected: 401, desc: 'Admin payments list' },
  { method: 'POST', url: '/api/admin/payments', body: {}, expected: 401, desc: 'Admin payment creation' },
  { method: 'DELETE', url: '/api/admin/payments', body: {}, expected: 401, desc: 'Admin payment deletion' },
  { method: 'POST', url: '/api/admin/products/bulk', body: {}, expected: 401, desc: 'Admin bulk products' },
  { method: 'GET', url: '/api/admin/queries', expected: 401, desc: 'Admin customer queries' },
  { method: 'POST', url: '/api/admin/queries', body: {}, expected: 401, desc: 'Admin query mutation' },

  // Member / Approved-User Routes (Expected: 401)
  { method: 'POST', url: '/api/auth/dispatch-kyc', body: {}, expected: 401, desc: 'Dispatch KYC request' },
  { method: 'GET', url: '/api/matches', expected: 401, desc: 'Matching engine GET' },
  { method: 'POST', url: '/api/matches', body: {}, expected: 401, desc: 'Matching engine POST' },
  { method: 'POST', url: '/api/presence', body: {}, expected: 401, desc: 'Presence ping' },
  { method: 'POST', url: '/api/listings/notify-inactivated', body: {}, expected: 401, desc: 'Notify listing inactivated' },
  { method: 'POST', url: '/api/products', body: { title: 'Test' }, expected: 401, desc: 'Create product' },
  { method: 'PUT', url: '/api/products', body: { title: 'Test' }, expected: 401, desc: 'Update product' },
  { method: 'PATCH', url: '/api/products', body: { ids: ['p1'] }, expected: 401, desc: 'Batch patch product' },
  { method: 'DELETE', url: '/api/products', body: { id: 'p1' }, expected: 401, desc: 'Delete product' },

  // Inquiries Actions (Expected: 401)
  { method: 'GET', url: '/api/inquiries', expected: 401, desc: 'Inquiries default conversation list' },
  { method: 'GET', url: '/api/inquiries?role=admin', expected: 401, desc: 'Inquiries admin conversation list' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'get_sellers' }, expected: 401, desc: 'Inquiries get_sellers action' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'mark_read', conversationId: 'c1' }, expected: 401, desc: 'Inquiries mark_read action' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'admin_direct_message', sellerCompanyId: 'c1', text: 'hi' }, expected: 401, desc: 'Inquiries admin_direct_message action' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'send_message', conversationId: 'c1', message: { text: 'hi' } }, expected: 401, desc: 'Inquiries send_message action' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'create_broadcast', text: 'hi' }, expected: 401, desc: 'Inquiries create_broadcast action' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'create_member_broadcast', title: 'hi' }, expected: 401, desc: 'Inquiries create_member_broadcast action' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'contact_admin', initialMessage: 'help' }, expected: 401, desc: 'Inquiries contact_admin action' },
  { method: 'POST', url: '/api/inquiries', body: { action: 'create_inquiry', productId: 'p1', initialMessage: 'quote' }, expected: 401, desc: 'Inquiries create_inquiry action' },

  // Cron Routes without secret (Expected: 401)
  { method: 'GET', url: '/api/cron/inactivity-reminders', expected: 401, desc: 'Inactivity reminders cron GET' },
  { method: 'POST', url: '/api/cron/inactivity-reminders', expected: 401, desc: 'Inactivity reminders cron POST' },
  { method: 'GET', url: '/api/listings/lifecycle', expected: 401, desc: 'Listing lifecycle cron GET' },
  { method: 'POST', url: '/api/listings/lifecycle', expected: 401, desc: 'Listing lifecycle cron POST' },

  // Disabled Routes (Expected: 403 FEATURE_DISABLED)
  { method: 'POST', url: '/api/billing/activate-tier', expected: 403, desc: 'Direct tier activation (disabled)' },

  // Intentionally Public Routes (Expected: 200 or 400 for bad input)
  { method: 'GET', url: '/api/products', expected: 200, desc: 'Public products catalog feed' },
  { method: 'GET', url: '/api/auth/me', expected: 200, desc: 'Public auth state inspector (authenticated: false)' },
  { method: 'GET', url: '/api/auth/check-username?username=testuser', expected: 200, desc: 'Check username availability' },
];

async function runTests() {
  console.log('========================================================================================');
  console.log('                 LOGGED-OUT INVOCATION STATUS TEST FOR ALL API HANDLERS                 ');
  console.log('========================================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const t of routesToTest) {
    try {
      const options = {
        method: t.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (t.body) {
        options.body = JSON.stringify(t.body);
      }

      const res = await fetch(`${BASE_URL}${t.url}`, options);
      const isOk = res.status === t.expected || (t.expected === 401 && (res.status === 401 || res.status === 403));
      
      const statusTag = isOk ? `[PASS: ${res.status}]` : `[FAIL: Expected ${t.expected}, Got ${res.status}]`;
      if (isOk) passed++;
      else failed++;

      console.log(`${t.method.padEnd(7)} ${t.url.padEnd(46)} ${statusTag.padEnd(20)} ${t.desc}`);
    } catch (err) {
      failed++;
      console.log(`${t.method.padEnd(7)} ${t.url.padEnd(46)} [ERROR: ${err.message}] ${t.desc}`);
    }
  }

  console.log('\n========================================================================================');
  console.log(`TOTAL LOGGED-OUT TESTS: ${routesToTest.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================================\n');
}

runTests();
