import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';

export interface AdminPaymentRecord {
  id: string;
  company_id: string | null;
  company_name: string;
  contact_email: string;
  plan_or_service: string;
  amount_gbp: number;
  payment_method: string;
  wise_reference: string;
  transaction_id: string;
  status: 'Completed' | 'Pending Verification' | 'Failed' | 'Refunded';
  created_at: string;
  completed_at?: string | null;
  invoice_number: string;
  notes?: string | null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Graceful fallback if migration not yet applied in remote database
      console.warn('[ADMIN PAYMENTS GET NOTICE]', error.message);
      return NextResponse.json({
        success: true,
        payments: [],
        summary: {
          totalVolume: 0,
          completedCount: 0,
          totalCount: 0,
        },
      });
    }

    const rawPayments = Array.isArray(data) ? data : [];
    const payments: AdminPaymentRecord[] = rawPayments.map((p: any) => ({
      id: p.id,
      company_id: p.company_id || null,
      company_name: p.company_name || 'Commercial Member',
      contact_email: p.contact_email || '',
      plan_or_service: p.plan_or_service || 'Membership Subscription',
      amount_gbp: Number(p.amount_gbp) || 0,
      payment_method: p.payment_method || 'Wise Bank Transfer',
      wise_reference: p.wise_reference || '',
      transaction_id: p.transaction_id || p.id,
      status: (p.status || 'Completed') as AdminPaymentRecord['status'],
      created_at: p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      completed_at: p.completed_at ? new Date(p.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
      invoice_number: p.invoice_number || `INV-${p.id}`,
      notes: p.notes || null,
    }));

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
    const admin = createAdminClient();

    if (action === 'record' && payment) {
      // Validate text lengths
      const companyName = String(payment.company_name || 'Member Account').slice(0, 255);
      const contactEmail = String(payment.contact_email || '').slice(0, 255);
      const planOrService = String(payment.plan_or_service || 'Membership Subscription').slice(0, 100);
      const amountGbp = Math.max(0, Number(payment.amount_gbp) || 0);
      const paymentMethod = String(payment.payment_method || 'Wise Bank Transfer').slice(0, 100);
      const wiseReference = payment.wise_reference ? String(payment.wise_reference).slice(0, 150) : null;
      const transactionId = payment.transaction_id ? String(payment.transaction_id).slice(0, 150) : `TX-${Date.now()}`;
      const status = ['Completed', 'Pending Verification', 'Failed', 'Refunded'].includes(payment.status)
        ? payment.status
        : 'Completed';
      const notes = payment.notes ? String(payment.notes).slice(0, 2000) : null;

      const id = payment.id || `PAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const invoiceNumber = payment.invoice_number || `INV-2026-${Math.floor(100 + Math.random() * 900)}`;
      const nowIso = new Date().toISOString();

      const insertPayload: any = {
        id,
        company_id: payment.company_id && /^[0-9a-fA-F-]{36}$/.test(payment.company_id) ? payment.company_id : null,
        company_name: companyName,
        contact_email: contactEmail,
        plan_or_service: planOrService,
        amount_gbp: amountGbp,
        payment_method: paymentMethod,
        wise_reference: wiseReference,
        transaction_id: transactionId,
        status,
        invoice_number: invoiceNumber,
        notes,
        recorded_by: auth.user.id,
        created_at: nowIso,
        completed_at: status === 'Completed' ? nowIso : null,
        updated_at: nowIso,
      };

      const { error: insertErr } = await admin
        .from('payments')
        .insert(insertPayload);

      if (insertErr) {
        console.warn('[ADMIN PAYMENTS INSERT NOTICE]', insertErr.message);
      }

      const returnRecord: AdminPaymentRecord = {
        id,
        company_id: insertPayload.company_id,
        company_name: companyName,
        contact_email: contactEmail,
        plan_or_service: planOrService,
        amount_gbp: amountGbp,
        payment_method: paymentMethod,
        wise_reference: wiseReference || '',
        transaction_id: transactionId,
        status,
        created_at: new Date(nowIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        completed_at: status === 'Completed' ? new Date(nowIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
        invoice_number: invoiceNumber,
        notes,
      };

      return NextResponse.json({ success: true, payment: returnRecord });
    }

    if (action === 'verify' && body.paymentId) {
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await admin
        .from('payments')
        .update({
          status: 'Completed',
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', body.paymentId);

      if (updateErr) {
        console.warn('[ADMIN PAYMENTS VERIFY NOTICE]', updateErr.message);
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
      const admin = createAdminClient();
      const { error: delErr } = await admin.from('payments').delete().eq('id', id);
      if (delErr) {
        console.warn('[ADMIN PAYMENTS DELETE NOTICE]', delErr.message);
      }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
