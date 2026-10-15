import { NextRequest, NextResponse } from 'next/server';
import { getCampaignLeadsFromDatabase, recordNewCampaignLead } from '@/lib/campaigns/campaign-store';

export async function GET(request: NextRequest) {
  try {
    const leads = await getCampaignLeadsFromDatabase();

    // Prepare lists
    const emailsList = leads
      .map((l) => l.email)
      .filter(Boolean);

    const whatsAppList = leads
      .map((l) => l.whatsapp)
      .filter((w) => Boolean(w) && w.length >= 7);

    const buyers = leads.filter((l) => l.role === 'buyer');
    const sellers = leads.filter((l) => l.role === 'seller');

    return NextResponse.json({
      success: true,
      stats: {
        totalLeads: leads.length,
        totalEmails: emailsList.length,
        totalWhatsApp: whatsAppList.length,
        buyersCount: buyers.length,
        sellersCount: sellers.length,
      },
      emailsText: emailsList.join(', '),
      whatsAppText: whatsAppList.join(', '),
      leads,
    });
  } catch (err) {
    console.error('Error in /api/admin/campaigns:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to retrieve campaign leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, whatsapp, contactName, companyName, role, tier, country } = body;

    if (!email || !contactName) {
      return NextResponse.json(
        { error: 'Email and contact name are required' },
        { status: 400 }
      );
    }

    const lead = await recordNewCampaignLead({
      email,
      whatsapp,
      contactName,
      companyName: companyName || contactName,
      role: role === 'buyer' ? 'buyer' : 'seller',
      tier,
      country,
    });

    return NextResponse.json({
      success: true,
      lead,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save lead' },
      { status: 500 }
    );
  }
}
