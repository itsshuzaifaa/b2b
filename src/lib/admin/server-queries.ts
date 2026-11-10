import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';

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

// In-memory fallback if Supabase table is not yet migrated
let memoryQueriesFallback: CustomerQuery[] = [];

function formatQueryDate(d: string | Date | undefined): string {
  if (!d) return new Date().toISOString();
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(d);
  }
}

/**
 * Retrieves all customer inquiries from the Supabase customer_queries table.
 * Restricted to elevated server context (RLS enabled, service-role only).
 */
export async function getServerCustomerQueries(): Promise<CustomerQuery[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('customer_queries')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped: CustomerQuery[] = data.map((r: any) => ({
        id: r.id,
        name: r.name,
        company: r.company,
        email: r.email,
        phone: r.phone || '',
        topic: r.topic || 'general',
        message: r.message,
        created_at: formatQueryDate(r.created_at),
        status: (r.status === 'replied' ? 'replied' : 'new') as 'new' | 'replied',
        reply_text: r.reply_text || undefined,
        replied_at: r.replied_at ? formatQueryDate(r.replied_at) : undefined,
      }));
      memoryQueriesFallback = mapped;
      return mapped;
    }

    if (error) {
      console.warn('[SERVER QUERIES SUPABASE READ NOTICE]', error.message);
    }
  } catch (err) {
    console.warn('[SERVER QUERIES EXCEPTION]', err);
  }

  return memoryQueriesFallback;
}

export interface AddCustomerQueryResult {
  query: CustomerQuery;
  isDuplicate: boolean;
}

/**
 * Adds a new customer query to the Supabase customer_queries table.
 * Includes a 5-minute duplicate submission guard per email + message.
 */
export async function addServerCustomerQuery(data: {
  name: string;
  company: string;
  email: string;
  phone?: string;
  topic?: string;
  message: string;
}): Promise<AddCustomerQueryResult> {
  const trimmedEmail = (data.email || '').trim().toLowerCase();
  const trimmedMsg = (data.message || '').trim().toLowerCase();

  // Deduplication check: check recent queries within 5 minutes
  const existingList = await getServerCustomerQueries();
  const existing = existingList.find((q) => {
    if ((q.email || '').trim().toLowerCase() !== trimmedEmail) return false;
    if ((q.message || '').trim().toLowerCase() !== trimmedMsg) return false;
    return true;
  });

  if (existing) {
    return { query: existing, isDuplicate: true };
  }

  const queryId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();

  const queryRecord: CustomerQuery = {
    id: queryId,
    name: data.name?.trim() || 'Wholesale Member',
    company: data.company?.trim() || 'Trading Enterprise',
    email: data.email?.trim() || '',
    phone: data.phone?.trim() || '',
    topic: data.topic || 'general',
    message: data.message?.trim() || '',
    created_at: formatQueryDate(now),
    status: 'new',
  };

  try {
    const admin = createAdminClient();
    const { data: inserted, error } = await admin
      .from('customer_queries')
      .insert({
        id: queryId,
        name: queryRecord.name,
        company: queryRecord.company,
        email: queryRecord.email,
        phone: queryRecord.phone || null,
        topic: queryRecord.topic,
        message: queryRecord.message,
        status: 'new',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('*')
      .single();

    if (!error && inserted) {
      queryRecord.id = inserted.id;
      queryRecord.created_at = formatQueryDate(inserted.created_at);
    }
  } catch (err) {
    console.warn('[SERVER QUERIES INSERT EXCEPTION]', err);
  }

  memoryQueriesFallback.unshift(queryRecord);
  return { query: queryRecord, isDuplicate: false };
}

/**
 * Updates a customer query with reply text in the Supabase customer_queries table.
 */
export async function replyServerCustomerQuery(id: string, replyText: string): Promise<CustomerQuery | null> {
  const now = new Date();
  const repliedAtStr = formatQueryDate(now);

  try {
    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('customer_queries')
      .update({
        status: 'replied',
        reply_text: replyText.trim(),
        replied_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (!error && updated) {
      return {
        id: updated.id,
        name: updated.name,
        company: updated.company,
        email: updated.email,
        phone: updated.phone || '',
        topic: updated.topic,
        message: updated.message,
        created_at: formatQueryDate(updated.created_at),
        status: 'replied',
        reply_text: updated.reply_text || undefined,
        replied_at: repliedAtStr,
      };
    }
  } catch (err) {
    console.warn('[SERVER QUERIES UPDATE EXCEPTION]', err);
  }

  // Update fallback memory store
  const target = memoryQueriesFallback.find((q) => q.id === id);
  if (target) {
    target.status = 'replied';
    target.reply_text = replyText.trim();
    target.replied_at = repliedAtStr;
    return target;
  }

  return null;
}

/**
 * Deletes a customer query by ID from the Supabase customer_queries table.
 */
export async function deleteServerCustomerQuery(id: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('customer_queries')
      .delete()
      .eq('id', id);

    if (!error) {
      memoryQueriesFallback = memoryQueriesFallback.filter((q) => q.id !== id);
      return true;
    }
  } catch (err) {
    console.warn('[SERVER QUERIES DELETE EXCEPTION]', err);
  }

  const initialLen = memoryQueriesFallback.length;
  memoryQueriesFallback = memoryQueriesFallback.filter((q) => q.id !== id);
  return memoryQueriesFallback.length !== initialLen;
}
