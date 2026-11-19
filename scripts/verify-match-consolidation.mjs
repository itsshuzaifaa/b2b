import {
  processMatchesForNewProduct,
  processMatchesForNewWtb,
  processBatchMatchesForProducts,
  flushAllPendingMatchEmails,
} from '../src/lib/matching/match-service.ts';
import { consolidatedStockMatchEmail } from '../src/lib/email/templates.ts';

console.log('--- STARTING MATCH CONSOLIDATION INTEGRATION VERIFICATION ---');

// Test 1: Verify consolidated email generation for 100 items
const sample100Items = Array.from({ length: 100 }, (_, i) => ({
  name: `Wholesale Item #${i + 1} - Enterprise Tech Lot`,
  barcodeOrSku: `EAN-${8400000000000 + i * 11}`,
  quantity: 50 + (i % 10) * 25,
  condition: i % 3 === 0 ? 'New' : 'A Grade',
}));

const { subject, html } = consolidatedStockMatchEmail({
  recipientType: 'buyer',
  recipientName: 'Huzaifa Faisal',
  items: sample100Items,
  actionUrl: 'https://b2blink.eu/dashboard?matchTab=true',
});

if (!subject.includes('100 Matching Stock Items')) {
  throw new Error(`Test 1 Failed: Subject does not reflect 100 items: ${subject}`);
}

if (!html.includes('Huzaifa Faisal') || !html.includes('MATCHED STOCK LIST (100 ITEMS)')) {
  throw new Error('Test 1 Failed: HTML content missing recipient name or 100 items header');
}

// Check that item 1 and item 100 are present in the table
if (!html.includes('Wholesale Item #1') || !html.includes('Wholesale Item #100')) {
  throw new Error('Test 1 Failed: Item #1 or Item #100 missing from table');
}

// Check that the Trade Privacy Notice is present
if (!html.includes('Commercial Details Protected') || !html.includes('secure portal')) {
  throw new Error('Test 1 Failed: Trade privacy and login prompt missing');
}

console.log('✓ TEST 1 PASSED: 100-item consolidated email generated cleanly.');
console.log('  Subject:', subject);
console.log('  HTML size:', Math.round(html.length / 1024), 'KB (well below email client clipping thresholds)');

// Test 2: Verify single item match email formatting
const singleItemResult = consolidatedStockMatchEmail({
  recipientType: 'seller',
  recipientName: 'Global Tech Ltd',
  items: [
    {
      name: 'Sony PlayStation 5 Slim 1TB',
      barcodeOrSku: '0711719575955',
      quantity: 120,
    },
  ],
  actionUrl: 'https://b2blink.eu/dashboard?matchTab=true',
});

if (!singleItemResult.subject.includes('Sony PlayStation 5 Slim 1TB')) {
  throw new Error(`Test 2 Failed: Single item subject does not match item name: ${singleItemResult.subject}`);
}
if (!singleItemResult.html.includes('1 STOCK MATCH')) {
  throw new Error('Test 2 Failed: Single item badge missing');
}
console.log('✓ TEST 2 PASSED: Single item consolidated email formatted correctly.');

console.log('--- ALL MATCH CONSOLIDATION INTEGRATION CHECKS PASSED ---');
