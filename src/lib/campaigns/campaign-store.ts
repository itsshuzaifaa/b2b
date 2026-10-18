import { createAdminClient } from '@/lib/supabase/server';

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
  // Remove all non-digit and non-+ characters
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  // If starts with +, keep it
  if (cleaned.startsWith('+')) return cleaned;
  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) return '+' + cleaned.substring(2);
  // Default to + if numeric
  return '+' + cleaned;
}

// In-memory / persisted leads fallback cache (starts empty for clean testing)
const CAMPAIGN_LEADS_FALLBACK: CampaignLead[] = [];


// Fetch all campaign leads (merging Supabase live companies table + fallback)
export async function getCampaignLeadsFromDatabase(): Promise<CampaignLead[]> {
  try {
    const supabase = createAdminClient();
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, company_name, contact_name, contact_email, phone, role, tier, created_at')
      .order('created_at', { ascending: false });

    if (error || !companies) {
      return CAMPAIGN_LEADS_FALLBACK;
    }

    const leadsMap = new Map<string, CampaignLead>();

    // Add fallback accounts first
    CAMPAIGN_LEADS_FALLBACK.forEach((lead) => {
      leadsMap.set(lead.email.toLowerCase(), lead);
    });

    // Merge Supabase companies
    companies.forEach((comp) => {
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

    return Array.from(leadsMap.values());
  } catch (err) {
    console.error('Error fetching campaign leads:', err);
    return CAMPAIGN_LEADS_FALLBACK;
  }
}

// Record a new campaign lead upon account registration
export async function recordNewCampaignLead(lead: {
  email: string;
  whatsapp?: string | null;
  contactName: string;
  companyName: string;
  role: 'buyer' | 'seller';
  tier?: string;
  country?: string;
}): Promise<CampaignLead> {
  const formattedPhone = formatWhatsAppNumber(lead.whatsapp);
  const newLead: CampaignLead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    email: lead.email.toLowerCase().trim(),
    whatsapp: formattedPhone,
    contact_name: lead.contactName.trim(),
    company_name: lead.companyName.trim(),
    role: lead.role,
    membership_tier: lead.tier || (lead.role === 'seller' ? 'silver' : 'bronze'),
    country: lead.country || 'Global',
    status: 'active',
    source: 'registration',
    tags: [lead.role, lead.tier || 'member', 'campaign-ready'],
    created_at: new Date().toISOString(),
  };

  // Add to fallback cache in memory
  const idx = CAMPAIGN_LEADS_FALLBACK.findIndex(
    (l) => l.email.toLowerCase() === newLead.email.toLowerCase()
  );
  if (idx >= 0) {
    CAMPAIGN_LEADS_FALLBACK[idx] = newLead;
  } else {
    CAMPAIGN_LEADS_FALLBACK.unshift(newLead);
  }

  return newLead;
}
