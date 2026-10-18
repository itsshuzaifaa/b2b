import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCustomerQueries,
  addServerCustomerQuery,
} from '@/lib/admin/server-queries';
import { sendEmail } from '@/lib/email/dispatcher';

export async function GET() {
  try {
    const queries = getServerCustomerQueries();
    return NextResponse.json({ success: true, queries });
  } catch (err) {
    console.error('Error fetching queries:', err);
    return NextResponse.json({ error: 'Failed to retrieve queries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, company, email, phone, topic, message } = body;

    if (!email || !message) {
      return NextResponse.json(
        { error: 'Email and message are required.' },
        { status: 400 }
      );
    }

    const query = addServerCustomerQuery({
      name: name || 'Wholesale Member',
      company: company || 'Trading Enterprise',
      email: email.trim(),
      phone: phone || '',
      topic: topic || 'general',
      message: message.trim(),
    });

    // Also send an automated acknowledgment email to customer & alert compliance desk
    try {
      await sendEmail({
        to: email.trim(),
        subject: `Inquiry Received: B2B LINK Support Desk [#${query.id}]`,
        replyTo: 'admin@b2blink.co.uk',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0B1F3A;">
            <div style="background: #0B1F3A; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
              <h2 style="color: #00E5FF; margin: 0; font-size: 20px; letter-spacing: 1px;">B2B LINK</h2>
              <div style="color: #94A3B8; font-size: 12px; margin-top: 4px;">Global Wholesale & Compliance Desk</div>
            </div>
            <h3 style="font-size: 18px; margin-bottom: 12px;">Hello ${query.name},</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Thank you for contacting our Global Compliance & Trader Support Desk regarding <strong>${query.company}</strong>. We have registered your inquiry under reference <strong>#${query.id}</strong>.
            </p>
            <div style="background: #F1F5F9; border-left: 4px solid #0A6CFF; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <div style="font-size: 12px; font-weight: bold; color: #64748B; text-transform: uppercase;">Topic: ${query.topic.toUpperCase()}</div>
              <div style="font-size: 14px; color: #1E293B; margin-top: 6px; white-space: pre-wrap;">${query.message}</div>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              A compliance officer will review your submission and reply directly to this email within 1 business day.
            </p>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center;">
              B2B LINK OÜ · Tornimäe 5, 10145 Tallinn, Estonia · admin@b2blink.co.uk
            </div>
          </div>
        `,
      });
    } catch (mailErr) {
      console.warn('[CONTACT ACK EMAIL WARNING]', mailErr);
    }

    return NextResponse.json({ success: true, query });
  } catch (err) {
    console.error('Error handling contact submission:', err);
    return NextResponse.json(
      { error: 'Failed to process inquiry' },
      { status: 500 }
    );
  }
}
