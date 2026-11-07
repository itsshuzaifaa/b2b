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

function deduplicateQueries(list: CustomerQuery[]): CustomerQuery[] {
  const result: CustomerQuery[] = [];
  const seenIds = new Set<string>();

  for (const q of list) {
    if (!q || !q.id || seenIds.has(q.id)) continue;

    const qEmail = (q.email || '').trim().toLowerCase();
    const qMsg = (q.message || '').trim().toLowerCase();
    const qParts = q.id.split('-');
    const qTs = qParts.length >= 2 ? parseInt(qParts[1], 10) : NaN;

    // Check if an existing query in result has the same email and message within a 10-minute window
    const isDuplicate = result.some((existing) => {
      if ((existing.email || '').trim().toLowerCase() !== qEmail) return false;
      if ((existing.message || '').trim().toLowerCase() !== qMsg) return false;

      const exParts = existing.id.split('-');
      const exTs = exParts.length >= 2 ? parseInt(exParts[1], 10) : NaN;
      if (!isNaN(qTs) && !isNaN(exTs)) {
        return Math.abs(qTs - exTs) < 10 * 60 * 1000;
      }
      return true;
    });

    if (!isDuplicate) {
      seenIds.add(q.id);
      result.push(q);
    }
  }

  return result;
}

export function getServerCustomerQueries(): CustomerQuery[] {
  try {
    const filePath = getFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const cleaned = deduplicateQueries(parsed);
        // Persist deduplicated list if duplicates were pruned
        if (cleaned.length !== parsed.length) {
          try {
            fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
          } catch {}
        }
        memoryQueries = cleaned;
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('[SERVER QUERIES READ WARNING]', err);
  }
  return memoryQueries;
}

export function saveServerCustomerQueries(queries: CustomerQuery[]): void {
  const cleaned = deduplicateQueries(queries);
  memoryQueries = cleaned;
  try {
    const filePath = getFilePath();
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SERVER QUERIES WRITE WARNING]', err);
  }
}

export interface AddCustomerQueryResult {
  query: CustomerQuery;
  isDuplicate: boolean;
}

export function addServerCustomerQuery(data: {
  name: string;
  company: string;
  email: string;
  phone?: string;
  topic?: string;
  message: string;
}): AddCustomerQueryResult {
  const queries = getServerCustomerQueries();
  const trimmedEmail = (data.email || '').trim().toLowerCase();
  const trimmedMsg = (data.message || '').trim().toLowerCase();

  // Deduplication guard: check if an identical query was submitted within the last 5 minutes
  const existing = queries.find((q) => {
    if ((q.email || '').trim().toLowerCase() !== trimmedEmail) return false;
    if ((q.message || '').trim().toLowerCase() !== trimmedMsg) return false;

    const parts = q.id.split('-');
    if (parts.length >= 2) {
      const ts = parseInt(parts[1], 10);
      if (!isNaN(ts) && Date.now() - ts < 5 * 60 * 1000) {
        return true;
      }
    }
    return true;
  });

  if (existing) {
    return { query: existing, isDuplicate: true };
  }

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
  return { query: newQuery, isDuplicate: false };
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
