import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCustomerQueries,
  replyServerCustomerQuery,
  deleteServerCustomerQuery,
} from '@/lib/admin/server-queries';
import { sendEmail } from '@/lib/email/dispatcher';
import { customerQueryReplyEmail } from '@/lib/email/templates';

export async function GET() {
  try {
    const queries = getServerCustomerQueries();
    return NextResponse.json({ success: true, queries });
  } catch (err) {
    console.error('Error in GET /api/admin/queries:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve queries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, replyText, replySubject } = body;

    if (!id) {
      return NextResponse.json({ error: 'Query ID is required' }, { status: 400 });
    }

    if (action === 'reply') {
      if (!replyText || !replyText.trim()) {
        return NextResponse.json({ error: 'Reply text cannot be empty' }, { status: 400 });
      }

      const queries = getServerCustomerQueries();
      const target = queries.find((q) => q.id === id);
      if (!target) {
        return NextResponse.json({ error: 'Query not found' }, { status: 404 });
      }

      // 1. Update record in server database
      const updated = replyServerCustomerQuery(id, replyText);

      // 2. Dispatch real email directly to customer
      let emailResult: { success: boolean; error?: string } = { success: false };
      try {
        const { subject, html } = customerQueryReplyEmail({
          customerName: target.name,
          companyName: target.company,
          subject: replySubject || `Re: B2B LINK Support Desk - ${target.topic.toUpperCase()} Inquiry`,
          replyMessage: replyText,
          originalMessage: target.message,
          actionUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/contact',
        });

        emailResult = await sendEmail({
          to: target.email,
          subject: replySubject || subject,
          html,
          replyTo: 'admin@b2blink.co.uk',
        });
      } catch (mailErr) {
        console.warn('[REPLY EMAIL DISPATCH WARNING]', mailErr);
        emailResult = {
          success: false,
          error: mailErr instanceof Error ? mailErr.message : 'Email failed',
        };
      }

      return NextResponse.json({
        success: true,
        query: updated,
        emailSent: emailResult.success,
        emailError: emailResult.error || undefined,
      });
    }

    if (action === 'delete') {
      const deleted = deleteServerCustomerQuery(id);
      return NextResponse.json({ success: deleted });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Error in POST /api/admin/queries:', err);
    return NextResponse.json(
      { error: 'Internal server error processing query' },
      { status: 500 }
    );
  }
}
