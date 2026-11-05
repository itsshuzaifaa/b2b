import { createAdminClient } from '@/lib/supabase/server';
import { MOCK_COMPANIES } from '@/lib/mock-data';
import { getAllRegisteredUsers } from '@/lib/auth/user-registry';

export interface CampaignLead {
  id: string;
  email: string;
  whatsapp: string;
  contact_name: string;
  company_name: string;
  role: 'buyer' | 'seller';
  membership_tier: string;
  country?: string;
  status: 'active' | 'subscribed' | 'unsubscribed';
  source: 'registration' | 'manual' | 'wtb_request';
  tags: string[];
  created_at: string;
}

// Clean phone number for WhatsApp international standard
export function formatWhatsAppNumber(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.substring(2);
  return '+' + cleaned;
}

// Fetch all campaign leads (merging MOCK_COMPANIES, user-registry, and Supabase)
export async function getCampaignLeadsFromDatabase(): Promise<CampaignLead[]> {
  const leadsMap = new Map<string, CampaignLead>();

  // 1. Add from MOCK_COMPANIES
  MOCK_COMPANIES.forEach((c) => {
    if (c.role === 'admin' || c.email?.toLowerCase() === 'admin@b2blink.eu') return;
    const email = (c.email || c.contact_email || '').toLowerCase().trim();
    if (!email) return;
    leadsMap.set(email, {
      id: c.id,
      email,
      whatsapp: formatWhatsAppNumber(c.phone),
      contact_name: c.contact_name || 'Commercial Contact',
      company_name: c.company_name || c.name || 'B2B Enterprise',
      role: c.role === 'buyer' ? 'buyer' : 'seller',
      membership_tier: c.membership_tier || c.tier || 'bronze',
      country: c.country || 'Global',
      status: 'active',
      source: 'registration',
      tags: [c.role || 'seller', c.membership_tier || 'silver', 'verified-account'],
      created_at: c.created_at || new Date().toISOString(),
    });
  });

  // 2. Add from server user registry
  try {
    const regUsers = getAllRegisteredUsers();
    regUsers.forEach((u) => {
      if (u.role === 'admin' || u.email?.toLowerCase() === 'admin@b2blink.eu') return;
      const email = u.email.toLowerCase().trim();
      if (!email) return;
      if (!leadsMap.has(email)) {
        leadsMap.set(email, {
          id: u.companyId || u.id,
          email,
          whatsapp: formatWhatsAppNumber(u.phone),
          contact_name: u.contactName || 'Trader',
          company_name: u.companyName || 'Wholesale Enterprise',
          role: (u.role as any) === 'buyer' ? 'buyer' : 'seller',
          membership_tier: u.tier || 'bronze',
          country: 'Global',
          status: 'active',
          source: 'registration',
          tags: [u.role || 'seller', u.tier || 'bronze', 'user-registry'],
          created_at: u.createdAt || new Date().toISOString(),
        });
      }
    });
  } catch {}

  // 3. Merge Supabase companies if available
  try {
    const supabase = createAdminClient();
    const { data: companies } = await supabase
      .from('companies')
      .select('id, company_name, contact_name, contact_email, phone, role, tier, created_at')
      .order('created_at', { ascending: false });

    if (companies && Array.isArray(companies)) {
      companies.forEach((comp: any) => {
        const email = (comp.contact_email || '').toLowerCase().trim();
        if (!email || comp.role === 'admin' || email === 'admin@b2blink.eu') return;

        const formattedPhone = formatWhatsAppNumber(comp.phone);
        const existing = leadsMap.get(email);
        leadsMap.set(email, {
          id: comp.id || existing?.id || `lead-${Date.now()}`,
          email,
          whatsapp: formattedPhone || existing?.whatsapp || '',
          contact_name: comp.contact_name || existing?.contact_name || 'Commercial Contact',
          company_name: comp.company_name || existing?.company_name || 'B2B Enterprise',
          role: comp.role === 'buyer' ? 'buyer' : 'seller',
          membership_tier: comp.tier || existing?.membership_tier || 'bronze',
          country: existing?.country || 'Global',
          status: 'active',
          source: 'registration',
          tags: [comp.role || 'user', comp.tier || 'bronze', 'verified-account'],
          created_at: comp.created_at || existing?.created_at || new Date().toISOString(),
        });
      });
    }
  } catch {}

  return Array.from(leadsMap.values());
}

// Record a new campaign lead upon account registration
export async function recordNewCampaignLead(lead: {
  email: string;
  whatsapp?: string | null;
  contactName: string;
  companyName?: string;
  role: 'buyer' | 'seller';
  tier?: string;
  country?: string;
}): Promise<CampaignLead> {
  const formattedPhone = formatWhatsAppNumber(lead.whatsapp);
  const now = new Date().toISOString();

  const newLead: CampaignLead = {
    id: `lead-${Date.now()}`,
    email: lead.email.toLowerCase().trim(),
    whatsapp: formattedPhone,
    contact_name: lead.contactName.trim(),
    company_name: lead.companyName?.trim() || lead.contactName.trim(),
    role: lead.role,
    membership_tier: lead.tier || 'bronze',
    country: lead.country || 'Global',
    status: 'active',
    source: 'registration',
    tags: [lead.role, lead.tier || 'bronze', 'new-lead'],
    created_at: now,
  };

  return newLead;
}
