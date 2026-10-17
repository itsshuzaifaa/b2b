import fs from 'fs';
import path from 'path';

export interface CustomerQuery {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
  created_at: string;
  status: 'new' | 'replied';
  reply_text?: string;
  replied_at?: string;
}

const INITIAL_QUERIES: CustomerQuery[] = [
  {
    id: 'query-101',
    name: 'Markus Weber',
    company: 'Bavaria Global Trade GmbH',
    email: 'm.weber@bavariatrade.de',
    phone: '+49 89 2345 6789',
    topic: 'verification',
    message: 'Hello Support Desk,\n\nWe recently created our account and would like to confirm whether our Munich Commercial Registry excerpt and DE VAT ID are sufficient for instant verified status, or if you need a utility bill for our warehouse.\n\nThank you,\nMarkus Weber',
    created_at: '17 Oct 2026, 01:25 AM',
    status: 'new',
  },
  {
    id: 'query-102',
    name: "Sarah O'Connor",
    company: 'Emerald Logistics Ireland',
    email: 's.oconnor@emeraldwholesalegoods.ie',
    phone: '+353 1 496 0123',
    topic: 'technical',
    message: 'Hi team,\n\nCould you please provide the CSV bulk ingestion column template for consumer electronics inventory? We have approximately 1,200 SKUs we want to import into the wholesale catalog.\n\nBest regards,\nSarah',
    created_at: '16 Oct 2026, 04:18 PM',
    status: 'new',
  },
  {
    id: 'query-103',
    name: 'Marco Bellini',
    company: 'Milano Distribuzione Srl',
    email: 'm.bellini@milanowholesale.it',
    phone: '+39 02 8765 4321',
    topic: 'billing',
    message: 'Greetings,\n\nWe wish to subscribe to the Gold Tier package via corporate Wise wire transfer in EUR. Please send us the official proforma invoice with your Tallinn IBAN.\n\nCordiali saluti,\nMarco Bellini',
    created_at: '15 Oct 2026, 11:40 AM',
    status: 'replied',
    reply_text: 'Dear Marco,\n\nThank you for reaching out. We have generated proforma invoice B2B-PRO-2026-8849 with our dedicated Wise EUR IBAN for Milano Distribuzione Srl. Your Gold membership will be activated immediately upon wire reference receipt.\n\nBest regards,\nB2B LINK Support',
    replied_at: '15 Oct 2026, 01:10 PM',
  },
];

function getFilePath(): string {
  // Store safely in project directory or fallback to temp
  const dataDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // fallback
    }
  }
  return path.join(dataDir, 'b2b_customer_queries.json');
}

// In-memory cache fallback
let memoryQueries: CustomerQuery[] = [...INITIAL_QUERIES];

export function getServerCustomerQueries(): CustomerQuery[] {
  try {
    const filePath = getFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryQueries = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[SERVER QUERIES READ WARNING]', err);
  }
  return memoryQueries;
}

export function saveServerCustomerQueries(queries: CustomerQuery[]): void {
  memoryQueries = queries;
  try {
    const filePath = getFilePath();
    fs.writeFileSync(filePath, JSON.stringify(queries, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SERVER QUERIES WRITE WARNING]', err);
  }
}

export function addServerCustomerQuery(data: {
  name: string;
  company: string;
  email: string;
  phone?: string;
  topic?: string;
  message: string;
}): CustomerQuery {
  const queries = getServerCustomerQueries();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const newQuery: CustomerQuery = {
    id: `query-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: data.name?.trim() || 'Wholesale Trader',
    company: data.company?.trim() || 'Direct Inquiry',
    email: data.email?.trim() || '',
    phone: data.phone?.trim() || '',
    topic: data.topic || 'general',
    message: data.message?.trim() || '',
    created_at: dateStr,
    status: 'new',
  };

  queries.unshift(newQuery);
  saveServerCustomerQueries(queries);
  return newQuery;
}

export function replyServerCustomerQuery(id: string, replyText: string): CustomerQuery | null {
  const queries = getServerCustomerQueries();
  const target = queries.find((q) => q.id === id);
  if (!target) return null;

  const now = new Date();
  target.status = 'replied';
  target.reply_text = replyText.trim();
  target.replied_at = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  saveServerCustomerQueries(queries);
  return target;
}

export function deleteServerCustomerQuery(id: string): boolean {
  const queries = getServerCustomerQueries();
  const filtered = queries.filter((q) => q.id !== id);
  if (filtered.length !== queries.length) {
    saveServerCustomerQueries(filtered);
    return true;
  }
  return false;
}
