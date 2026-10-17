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

const INITIAL_QUERIES: CustomerQuery[] = [];

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

// In-memory cache fallback (starts empty for clean testing)
let memoryQueries: CustomerQuery[] = [];

export function getServerCustomerQueries(): CustomerQuery[] {
  try {
    const filePath = getFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
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
