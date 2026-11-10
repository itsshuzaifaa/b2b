import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export interface AdminPaymentRecord {
  id: string;
  company_id: string;
  company_name: string;
  contact_email: string;
  plan_or_service: string;
  amount_gbp: number;
  payment_method: 'Wise Bank Transfer' | 'SEPA Wire' | 'Corporate Card' | 'Free Activation';
  wise_reference: string;
  transaction_id: string;
  status: 'Completed' | 'Pending Verification' | 'Failed' | 'Refunded';
  created_at: string;
  completed_at?: string | null;
  invoice_number: string;
  notes?: string;
}

// In-memory ledger for verified payments recorded via admin interface during runtime
let manualPayments: AdminPaymentRecord[] = [];

export async function GET() {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    // Return exclusively genuine recorded payments; no hardcoded seed data or synthetic fallbacks
    const payments: AdminPaymentRecord[] = [...manualPayments];

    const completed = payments.filter((p) => p.status === 'Completed');
    const totalVolume = completed.reduce((sum, p) => sum + p.amount_gbp, 0);

    return NextResponse.json({
      success: true,
      payments,
      summary: {
        totalVolume,
        completedCount: completed.length,
        totalCount: payments.length,
      },
    });
  } catch (err) {
    console.error('Error fetching admin payments:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const { action, payment } = body;

    if (action === 'record' && payment) {
      const id = payment.id || `PAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const now =
        new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ', ' +
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newRecord: AdminPaymentRecord = {
        ...payment,
        id,
        created_at: payment.created_at || now,
        completed_at: payment.status === 'Completed' ? payment.completed_at || now : null,
        invoice_number: payment.invoice_number || `INV-2026-${Math.floor(110 + Math.random() * 890)}`,
      };

      manualPayments.unshift(newRecord);
      return NextResponse.json({ success: true, payment: newRecord });
    }

    if (action === 'verify' && body.paymentId) {
      const idx = manualPayments.findIndex((p) => p.id === body.paymentId);
      const now =
        new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ', ' +
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (idx !== -1) {
        manualPayments[idx].status = 'Completed';
        manualPayments[idx].completed_at = now;
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Error handling payment POST:', err);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      manualPayments = manualPayments.filter((p) => p.id !== id);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
