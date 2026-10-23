import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { ChatMessage, InquiryConversation } from '@/lib/messaging/messaging-store';
import { sendNewInAppMessageEmail } from '@/lib/email/dispatcher';

interface RawInquiryRow {
  id: string;
  product_id: string;
  seller_company_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  buyer_company?: string | null;
  requested_quantity: number;
  target_price: number;
  message: string;
  status: string;
  created_at: string;
  products?: {
    id: string;
    title: string;
    unit_price: number;
    moq: number;
    image_urls?: string[];
    category_id?: string;
  } | null;
  seller_company?: {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email: string;
    phone?: string | null;
  } | null;
}

function parseMessagesFromRow(rawMessage: string, row: RawInquiryRow): ChatMessage[] {
  try {
    const parsed = JSON.parse(rawMessage);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((m, idx) => ({
        id: m.id || `msg-${idx}`,
        senderId: m.senderId || 'unknown',
        senderName: m.senderName || 'Anonymous',
        senderRole: m.senderRole || 'buyer',
        text: m.text || '',
        timestamp: m.timestamp || row.created_at,
        isRead: m.isRead,
        isBroadcast: m.isBroadcast || row.status?.startsWith('broadcast'),
        targetAudience: m.targetAudience,
        broadcastKind: m.broadcastKind,
        broadcastDetails: m.broadcastDetails,
      }));
    }
  } catch {
    // If raw string, treat as single initial message
  }

  const isB = row.status?.startsWith('broadcast');
  const isA = row.status === 'admin_desk';

  return [
    {
      id: `msg-init-${row.id}`,
      senderId: isB || isA ? 'facbb93f-080f-480f-b54b-8ef26664da86' : row.buyer_email || 'buyer',
      senderName: isB || isA ? 'Jeff Vetting Director (B2B LINK Desk)' : row.buyer_name || 'Buyer',
      senderRole: isB || isA ? 'admin' : 'buyer',
      text: rawMessage || 'Inquiry initiated',
      timestamp: row.created_at,
      isRead: true,
      isBroadcast: isB,
    },
  ];
}

function rowToConversation(row: RawInquiryRow): InquiryConversation {
  const messages = parseMessagesFromRow(row.message, row);
  const lastMsg = messages[messages.length - 1];

  let relativeTime = 'Just now';
  if (lastMsg?.timestamp) {
    const diffMin = Math.round((Date.now() - new Date(lastMsg.timestamp).getTime()) / 60000);
    if (diffMin < 1) relativeTime = 'Just now';
    else if (diffMin < 60) relativeTime = `${diffMin}m ago`;
    else if (diffMin < 1440) relativeTime = `${Math.round(diffMin / 60)}h ago`;
    else relativeTime = `${Math.round(diffMin / 1440)}d ago`;
  }

  const isSellerBroadcast = row.status === 'broadcast_seller';
  const isBuyerBroadcast = row.status === 'broadcast_buyer';
  const isGenericBroadcast = row.status === 'broadcast';
  const isMemberWtbBroadcast = row.status === 'broadcast_wtb';
  const isMemberWtsBroadcast = row.status === 'broadcast_wts';
  const isBroadcast = isSellerBroadcast || isBuyerBroadcast || isGenericBroadcast || isMemberWtbBroadcast || isMemberWtsBroadcast || row.status?.startsWith('broadcast');
  const isAdminDesk = row.status === 'admin_desk';

  const convType: 'buyer_seller' | 'seller_admin' | 'broadcast' = isBroadcast
    ? 'broadcast'
    : isAdminDesk
    ? 'seller_admin'
    : 'buyer_seller';

  let targetAudience: 'seller' | 'buyer' | 'all' = 'all';
  if (isSellerBroadcast) targetAudience = 'seller';
  else if (isBuyerBroadcast) targetAudience = 'buyer';

  const firstBroadcastMsg = messages.find((m) => m.broadcastDetails);
  const broadcastDetails = firstBroadcastMsg?.broadcastDetails;
  const broadcastKind = isMemberWtbBroadcast ? 'wtb' : isMemberWtsBroadcast ? 'wts' : (firstBroadcastMsg?.broadcastKind || (isBroadcast ? 'admin' : undefined));

  let title = row.products?.title || 'Verified Global Stock Lot';
  if (broadcastDetails?.title) {
    title = `[${broadcastDetails.itemType.toUpperCase()} BROADCAST] ${broadcastDetails.title}`;
  } else if (isMemberWtbBroadcast) {
    title = row.buyer_company?.startsWith('[WTB') ? row.buyer_company : `[WTB BROADCAST] ${row.buyer_company || 'Wholesale Sourcing Request'}`;
  } else if (isMemberWtsBroadcast) {
    title = row.buyer_company?.startsWith('[WTS') ? row.buyer_company : `[WTS BROADCAST] ${row.buyer_company || 'Wholesale Inventory Offer'}`;
  } else if (isSellerBroadcast || isBuyerBroadcast || isGenericBroadcast || isAdminDesk) {
    title = 'Jeff Vetting Director (B2B LINK Desk)';
  }

  const isSellerLast = lastMsg?.senderRole === 'seller';
  const isBuyerLast = lastMsg?.senderRole === 'buyer';
  const isAdminLast = lastMsg?.senderRole === 'admin';

  let unreadBySeller = false;
  let unreadByBuyer = false;
  let unreadByAdmin = false;

  if (isSellerBroadcast) {
    unreadBySeller = !lastMsg?.isRead;
    unreadByBuyer = false;
  } else if (isBuyerBroadcast) {
    unreadByBuyer = !lastMsg?.isRead;
    unreadBySeller = false;
  } else if (isMemberWtbBroadcast || isMemberWtsBroadcast) {
    unreadBySeller = true;
    unreadByBuyer = true;
  } else if (isAdminDesk) {
    unreadBySeller = isAdminLast;
    unreadByBuyer = isAdminLast;
    unreadByAdmin = isSellerLast || isBuyerLast;
  } else {
    // Buyer <-> Seller Trade
    unreadBySeller = isBuyerLast;
    unreadByBuyer = isSellerLast;
    unreadByAdmin = false;
  }

  return {
    id: row.id,
    type: convType,
    targetAudience,
    status: row.status,
    productId: row.product_id,
    productTitle: title,
    productImage:
      row.products?.image_urls?.[0] ||
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
    productPrice: row.products?.unit_price || row.target_price || 0,
    productMoq: row.products?.moq || row.requested_quantity || 1,
    productCategory: isBroadcast ? (broadcastDetails?.category || 'Member Broadcast') : isAdminDesk ? 'Compliance Desk' : 'Wholesale Trade',
    sellerCompanyId: row.seller_company_id,
    sellerCompanyName: row.seller_company?.company_name || 'Verified Supplier',
    sellerContactName: row.seller_company?.contact_name || 'Trade Desk',
    buyerCompanyId: undefined,
    buyerCompanyName: isMemberWtbBroadcast || isMemberWtsBroadcast
      ? (broadcastDetails?.ownerCompanyName || row.buyer_company || 'Verified Commercial Member')
      : isBroadcast || isAdminDesk
      ? 'B2B LINK OÜ (Platform Desk)'
      : row.buyer_company || `${row.buyer_name} Commercial`,
    buyerContactName: isMemberWtbBroadcast || isMemberWtsBroadcast
      ? (broadcastDetails?.ownerContactName || row.buyer_name)
      : isBroadcast || isAdminDesk
      ? 'Jeff Vetting Director'
      : row.buyer_name,
    buyerEmail: row.buyer_email,
    buyerContactEmail: row.buyer_email,
    buyerPhone: row.buyer_phone || undefined,
    buyerContactPhone: row.buyer_phone || undefined,
    lastMessageText: lastMsg?.text || 'No message content',
    lastMessageTime: relativeTime,
    unreadBySeller,
    unreadByBuyer,
    unreadByAdmin,
    messages,
    broadcastKind,
    broadcastDetails,
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const role = searchParams.get('role');
    const email = searchParams.get('email')?.toLowerCase();
    const companyId = searchParams.get('companyId');

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from('product_inquiries')
      .select(`
        id,
        product_id,
        seller_company_id,
        buyer_name,
        buyer_email,
        buyer_phone,
        buyer_company,
        requested_quantity,
        target_price,
        message,
        status,
        created_at,
        products:products(id, title, unit_price, moq, image_urls, category_id),
        seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email, phone)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let conversations = (rows as unknown as RawInquiryRow[]).map(rowToConversation);

    // Filter strictly to preserve commercial confidentiality:
    if (role === 'admin') {
      // Admin only sees:
      // 1) Messages sent to or by admin (seller_admin desk)
      // 2) Platform broadcasts sent by admin
      conversations = conversations.filter(
        (c) => c.type === 'seller_admin' || c.type === 'broadcast'
      );
    } else {
      const cleanEmail = email?.trim().toLowerCase();
      // If no identity provided for non-admin, never return private threads
      if (!cleanEmail && !companyId) {
        return NextResponse.json({
          success: true,
          conversations: [],
        });
      }

      conversations = conversations.filter((c) => {
        // 1. Broadcasts
        if (c.type === 'broadcast') {
          return c.targetAudience === 'all' || !c.targetAudience || (role ? c.targetAudience === role : true);
        }

        // 2. Admin desk threads (e.g. personal welcome messages or support from Jeff)
        // Must STRICTLY match the specific recipient user's email or company ID
        if (c.type === 'seller_admin' || c.status === 'admin_desk') {
          const isMyDeskThread = Boolean(
            (cleanEmail && c.buyerEmail?.toLowerCase().trim() === cleanEmail) ||
            (companyId && c.buyerCompanyId === companyId)
          );
          return isMyDeskThread;
        }

        // 3. Trade Inquiries (Buyer <-> Seller)
        // Must strictly involve this company as either the seller or the buyer
        const isMySellerInquiry = Boolean(companyId && c.sellerCompanyId === companyId);
        const isMyBuyerInquiry = Boolean(
          (companyId && c.buyerCompanyId === companyId) ||
          (cleanEmail && c.buyerEmail?.toLowerCase().trim() === cleanEmail)
        );

        return isMySellerInquiry || isMyBuyerInquiry;
      });
    }

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch inquiries' },
      { status: 500 }
    );
  }
}

async function getSystemProductId(supabase: any): Promise<string> {
  const SYSTEM_PROD_ID = '00000000-0000-4000-a000-000000000001';
  try {
    const { data: sysProd } = await supabase
      .from('products')
      .select('id')
      .eq('id', SYSTEM_PROD_ID)
      .maybeSingle();

    if (sysProd?.id) return sysProd.id;

    const { data: anyProd } = await supabase
      .from('products')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (anyProd?.id) return anyProd.id;

    // Create system product for admin desk communications
    const { data: cat } = await supabase.from('categories').select('id').limit(1).maybeSingle();
    await supabase.from('products').upsert({
      id: SYSTEM_PROD_ID,
      company_id: 'facbb93f-080f-480f-b54b-8ef26664da86',
      category_id: cat?.id || null,
      title: 'B2B LINK Admin Desk Communication',
      barcode_or_sku: 'SYS-ADMIN-DESK',
      unit_price: 0,
      quantity_available: 1,
      moq: 1,
      status: 'draft',
      is_hot: false,
    });

    return SYSTEM_PROD_ID;
  } catch (err) {
    console.warn('[getSystemProductId error]', err);
    return SYSTEM_PROD_ID;
  }
}

/**
 * Helper to dispatch an email notification to the recipient of an in-app message.
 * Handles Admin -> User, User -> Admin Desk, and Buyer <-> Seller trade messaging.
 */
async function notifyInAppMessageRecipient({
  supabase,
  threadRow,
  message,
  conversationId,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  threadRow: any;
  message: ChatMessage;
  conversationId: string;
}) {
  try {
    const isAdminDesk = threadRow.status === 'admin_desk';
    const isSenderAdmin =
      message.senderRole === 'admin' ||
      message.senderId === 'admin-desk' ||
      message.senderId === 'facbb93f-080f-480f-b54b-8ef26664da86';

    // 1. Fetch seller company details
    let sellerEmail = threadRow.seller_company?.contact_email || threadRow.seller_company?.email;
    let sellerContactName = threadRow.seller_company?.contact_name;
    let sellerCompanyName = threadRow.seller_company?.company_name;

    if (!sellerEmail && threadRow.seller_company_id) {
      const { data: comp } = await supabase
        .from('companies')
        .select('contact_email, email, contact_name, company_name')
        .eq('id', threadRow.seller_company_id)
        .maybeSingle();
      if (comp) {
        sellerEmail = comp.contact_email || comp.email;
        if (comp.contact_name) sellerContactName = comp.contact_name;
        if (comp.company_name) sellerCompanyName = comp.company_name;
      }
    }

    // 2. Fetch buyer details
    let buyerEmail = threadRow.buyer_email;
    let buyerContactName = threadRow.buyer_name;
    let buyerCompanyName = threadRow.buyer_company;

    if (!buyerEmail && threadRow.buyer_company_id) {
      const { data: bComp } = await supabase
        .from('companies')
        .select('contact_email, email, contact_name, company_name')
        .eq('id', threadRow.buyer_company_id)
        .maybeSingle();
      if (bComp) {
        buyerEmail = bComp.contact_email || bComp.email;
        if (bComp.contact_name) buyerContactName = bComp.contact_name;
        if (bComp.company_name) buyerCompanyName = bComp.company_name;
      }
    }

    // 3. Product or subject title
    let subjectOrProduct: string = 'Wholesale Trading & Inquiry Desk';
    if (threadRow.products?.title) {
      subjectOrProduct = threadRow.products.title;
    } else if (threadRow.buyer_company?.startsWith('[WTB') || threadRow.buyer_company?.startsWith('[WTS')) {
      subjectOrProduct = threadRow.buyer_company;
    } else if (isAdminDesk) {
      subjectOrProduct = 'B2B LINK Support & Compliance Desk';
    }

    // 4. Resolve recipient and sender details
    let targetEmail: string | null = null;
    let targetName: string = 'Valued Member';
    let targetIsAdmin = false;
    let senderName = message.senderName || 'Trade Partner';
    let senderCompany: string | undefined = undefined;

    if (isSenderAdmin) {
      // Admin is sending -> user receives
      targetEmail = sellerEmail || buyerEmail;
      targetName = sellerContactName || sellerCompanyName || buyerContactName || 'Valued Member';
      senderName = message.senderName || 'Jeff Vetting Director (B2B LINK Desk)';
      senderCompany = 'B2B LINK OÜ (Platform Desk)';
      targetIsAdmin = false;
    } else if (isAdminDesk) {
      // User is sending to Admin Desk -> Admin receives
      targetEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@b2blink.eu';
      targetName = 'B2B LINK Admin Desk';
      senderName = message.senderName || sellerContactName || buyerContactName || 'Platform Member';
      senderCompany = sellerCompanyName || buyerCompanyName || 'Member Organization';
      targetIsAdmin = true;
    } else {
      // Trade chat between buyer & seller
      const isSenderSeller =
        message.senderRole === 'seller' ||
        message.senderId === threadRow.seller_company_id ||
        (sellerEmail && message.senderId?.toLowerCase() === sellerEmail.toLowerCase());

      if (isSenderSeller) {
        // Seller sent -> Buyer receives
        targetEmail = buyerEmail;
        targetName = buyerContactName || buyerCompanyName || 'Commercial Buyer';
        senderName = message.senderName || sellerContactName || 'Wholesale Supplier';
        senderCompany = sellerCompanyName || 'Verified Supplier';
        targetIsAdmin = false;
      } else {
        // Buyer sent -> Seller receives
        targetEmail = sellerEmail;
        targetName = sellerContactName || sellerCompanyName || 'Wholesale Supplier';
        senderName = message.senderName || buyerContactName || 'Commercial Buyer';
        senderCompany = buyerCompanyName || 'Verified Buyer';
        targetIsAdmin = false;
      }
    }

    // 5. Safety check: Never email the sender themselves, and ensure email is valid
    if (targetEmail && targetEmail.includes('@')) {
      const cleanTarget = targetEmail.trim().toLowerCase();
      const cleanSenderId = (message.senderId || '').trim().toLowerCase();

      // Ensure sender is not receiving their own email notification
      if (cleanTarget !== cleanSenderId) {
        await sendNewInAppMessageEmail({
          toEmail: targetEmail.trim(),
          recipientName: targetName,
          senderName,
          senderCompany,
          senderRole: message.senderRole,
          messageText: message.text,
          subjectOrProduct,
          conversationId,
          isAdmin: targetIsAdmin,
        });
        console.log(`[IN-APP MESSAGE EMAIL NOTIFICATION SENT] To: ${targetEmail} | From: ${senderName} | Thread: ${conversationId}`);
      }
    }
  } catch (err) {
    console.error('[IN-APP MESSAGE NOTIFICATION WARNING]', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const supabase = createAdminClient();

    // 1. Return list of sellers for Admin direct messaging
    if (action === 'get_sellers') {
      const { data: sellers, error: sErr } = await supabase
        .from('companies')
        .select('id, company_name, contact_name, contact_email, phone, approval_status, role')
        .eq('role', 'seller')
        .neq('approval_status', 'suspended')
        .neq('approval_status', 'rejected')
        .order('company_name');

      if (sErr) {
        return NextResponse.json({ success: false, error: sErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, sellers: sellers || [] });
    }

    // 2. Admin sends a private direct message to a specific seller
    if (action === 'admin_direct_message') {
      const { sellerCompanyId, text, adminName, adminId } = body;
      if (!sellerCompanyId || !text?.trim()) {
        return NextResponse.json({ success: false, error: 'Seller ID and message text required' }, { status: 400 });
      }

      // Verify seller company exists
      const { data: sellerComp } = await supabase
        .from('companies')
        .select('id, company_name, contact_name, contact_email')
        .eq('id', sellerCompanyId)
        .maybeSingle();

      if (!sellerComp) {
        return NextResponse.json({
          success: false,
          error: 'This seller account no longer exists in the platform or has been deleted.',
        }, { status: 404 });
      }

      const newChatMessage: ChatMessage = {
        id: `msg-admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderId: adminId || 'facbb93f-080f-480f-b54b-8ef26664da86',
        senderName: adminName || 'Platform Administrator (Executive Desk)',
        senderRole: 'admin',
        text: text.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
        isBroadcast: false,
      };

      // Check for existing thread
      const { data: existingRows } = await supabase
        .from('product_inquiries')
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          requested_quantity,
          target_price,
          message,
          status,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .eq('status', 'admin_desk')
        .eq('seller_company_id', sellerCompanyId)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        const thread = existingRows[0];
        const msgs = parseMessagesFromRow(thread.message, thread as unknown as RawInquiryRow);
        msgs.push(newChatMessage);

        await supabase
          .from('product_inquiries')
          .update({ message: JSON.stringify(msgs) })
          .eq('id', thread.id);

        const updatedRow = { ...thread, message: JSON.stringify(msgs) };

        void notifyInAppMessageRecipient({
          supabase,
          threadRow: updatedRow,
          message: newChatMessage,
          conversationId: thread.id,
        });

        return NextResponse.json({
          success: true,
          message: newChatMessage,
          conversation: rowToConversation(updatedRow as unknown as RawInquiryRow),
        });
      }

      // If no thread exists, use safe system product ID
      const productId = await getSystemProductId(supabase);

      const { data: newRow, error: insertErr } = await supabase
        .from('product_inquiries')
        .insert({
          product_id: productId,
          seller_company_id: sellerCompanyId,
          buyer_name: 'Platform Administrator',
          buyer_email: 'admin@b2blink.eu',
          buyer_phone: '+372 612 3456',
          buyer_company: 'B2B LINK OÜ (Admin Desk)',
          requested_quantity: 1,
          target_price: 0,
          message: JSON.stringify([newChatMessage]),
          status: 'admin_desk',
        })
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          requested_quantity,
          target_price,
          message,
          status,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .single();

      if (insertErr || !newRow) {
        return NextResponse.json({ success: false, error: insertErr?.message || 'Failed to create thread' }, { status: 500 });
      }

      void notifyInAppMessageRecipient({
        supabase,
        threadRow: newRow,
        message: newChatMessage,
        conversationId: newRow.id,
      });

      return NextResponse.json({
        success: true,
        message: newChatMessage,
        conversation: rowToConversation(newRow as unknown as RawInquiryRow),
      });
    }

    // 3. Send message inside an existing conversation
    if (action === 'send_message') {
      const { conversationId, message } = body;
      if (!conversationId || !message?.text?.trim()) {
        return NextResponse.json({ success: false, error: 'Missing conversationId or message text' }, { status: 400 });
      }

      let resolvedThreadId = conversationId;
      let { data: row, error: fetchErr } = await supabase
        .from('product_inquiries')
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          status,
          message,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .eq('id', resolvedThreadId)
        .maybeSingle();

      if (!row && typeof resolvedThreadId === 'string' && resolvedThreadId.startsWith('conv-')) {
        const parts = resolvedThreadId.split('-');
        if (parts.length >= 2) {
          const candidateProdId = parts[1];
          const { data: fallbackRow } = await supabase
            .from('product_inquiries')
            .select(`
              id,
              product_id,
              seller_company_id,
              buyer_name,
              buyer_email,
              buyer_phone,
              buyer_company,
              status,
              message,
              created_at,
              products:products(id, title, unit_price, moq, image_urls),
              seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
            `)
            .eq('product_id', candidateProdId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (fallbackRow) {
            row = fallbackRow;
            resolvedThreadId = fallbackRow.id;
          }
        }
      }

      if (!row) {
        return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
      }

      const existingMessages = parseMessagesFromRow(row.message, row as unknown as RawInquiryRow);
      const newChatMessage: ChatMessage = {
        id: message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        text: message.text.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
        isBroadcast: Boolean(message.isBroadcast),
      };

      existingMessages.push(newChatMessage);

      const { error: updateErr } = await supabase
        .from('product_inquiries')
        .update({
          message: JSON.stringify(existingMessages),
        })
        .eq('id', resolvedThreadId);

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }

      const updatedRow = {
        ...(row as unknown as RawInquiryRow),
        message: JSON.stringify(existingMessages),
      };

      // Dispatch in-app message email notification to recipient
      void notifyInAppMessageRecipient({
        supabase,
        threadRow: updatedRow,
        message: newChatMessage,
        conversationId: resolvedThreadId,
      });

      const conversation = rowToConversation(updatedRow);

      return NextResponse.json({
        success: true,
        message: newChatMessage,
        conversation,
      });
    }

    // 4. Create or Update Broadcast (ensures exactly 1 for sellers and 1 for buyers)
    if (action === 'create_broadcast') {
      const { title, text, adminName, adminId, targetAudience } = body;
      if (!text?.trim()) {
        return NextResponse.json({ success: false, error: 'Broadcast text required' }, { status: 400 });
      }

      const audience = targetAudience === 'buyer' ? 'buyer' : 'seller';
      const statusValue = audience === 'buyer' ? 'broadcast_buyer' : 'broadcast_seller';

      const broadcastMessage: ChatMessage = {
        id: `broadcast-${Date.now()}`,
        senderId: adminId || 'facbb93f-080f-480f-b54b-8ef26664da86',
        senderName: adminName || 'Jeff Vetting Director (B2B LINK Desk)',
        senderRole: 'admin',
        text: text.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
        isBroadcast: true,
        targetAudience: audience,
      };

      // Check if broadcast for this audience already exists
      const { data: existingRows } = await supabase
        .from('product_inquiries')
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          requested_quantity,
          target_price,
          message,
          status,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .eq('status', statusValue)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        const thread = existingRows[0];
        const msgs = parseMessagesFromRow(thread.message, thread as unknown as RawInquiryRow);
        msgs.push(broadcastMessage);

        const { data: updatedRow, error: upErr } = await supabase
          .from('product_inquiries')
          .update({
            message: JSON.stringify(msgs),
            buyer_company: title ? `B2B LINK Broadcast: ${title}` : (audience === 'buyer' ? 'B2B LINK Buyers Broadcast' : 'B2B LINK Sellers Broadcast'),
          })
          .eq('id', thread.id)
          .select(`
            id,
            product_id,
            seller_company_id,
            buyer_name,
            buyer_email,
            buyer_phone,
            buyer_company,
            requested_quantity,
            target_price,
            message,
            status,
            created_at,
            products:products(id, title, unit_price, moq, image_urls),
            seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
          `)
          .single();

        if (upErr || !updatedRow) {
          return NextResponse.json({ success: false, error: upErr?.message || 'Broadcast update failed' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          broadcast: broadcastMessage,
          conversation: rowToConversation(updatedRow as unknown as RawInquiryRow),
        });
      }

      // If not existing, insert fresh
      const { data: sellerComp } = await supabase.from('companies').select('id').eq('role', 'seller').limit(1).single();

      const productId = await getSystemProductId(supabase);
      const sellerCompanyId = sellerComp?.id || 'facbb93f-080f-480f-b54b-8ef26664da86';

      const { data: newRow, error: insertErr } = await supabase
        .from('product_inquiries')
        .insert({
          product_id: productId,
          seller_company_id: sellerCompanyId,
          buyer_name: 'Jeff Vetting Director',
          buyer_email: 'admin@b2blink.eu',
          buyer_phone: '+372 612 3456',
          buyer_company: title ? `B2B LINK Broadcast: ${title}` : (audience === 'buyer' ? 'B2B LINK Buyers Broadcast' : 'B2B LINK Sellers Broadcast'),
          requested_quantity: 1,
          target_price: 0,
          message: JSON.stringify([broadcastMessage]),
          status: statusValue,
        })
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          requested_quantity,
          target_price,
          message,
          status,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .single();

      if (insertErr || !newRow) {
        return NextResponse.json({ success: false, error: insertErr?.message || 'Broadcast creation failed' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        broadcast: broadcastMessage,
        conversation: rowToConversation(newRow as unknown as RawInquiryRow),
      });
    }

    // 4.1 Create Member Broadcast (Gold accounts WTB or WTS broadcast to all members)
    if (action === 'create_member_broadcast') {
      const {
        broadcastKind, // 'wtb' | 'wts'
        itemId,
        title,
        category,
        brand,
        condition,
        quantity,
        price,
        moq,
        barcode,
        notes,
        senderCompanyId,
        senderCompanyName,
        senderContactName,
        senderEmail,
        senderPhone,
        targetAudience,
      } = body;

      const kind: 'wtb' | 'wts' = broadcastKind === 'wts' ? 'wts' : 'wtb';
      const statusValue = kind === 'wtb' ? 'broadcast_wtb' : 'broadcast_wts';

      const initialMsgText = kind === 'wtb'
        ? `📢 INTERNAL WTB BROADCAST\nProduct: ${title}\nTarget Quantity: ${quantity} units\nTarget Price: €${Number(price).toFixed(2)}/unit\nTotal Estimated Value: €${(Number(quantity) * Number(price)).toLocaleString()}\nCategory: ${category || 'General'}\nBarcode/SKU: ${barcode || 'N/A'}\nNotes: ${notes || 'None provided'}\n\n🔒 Trader details locked. Counterparty must unlock contact details to connect.`
        : `📢 INTERNAL WTS BROADCAST\nProduct: ${title}\nBrand: ${brand || 'Generic'}\nCondition: ${condition || 'New'}\nAvailable Quantity: ${quantity} pcs\nUnit Price: €${Number(price).toFixed(2)}/pc\nMinimum Order (MOQ): ${moq || 1} pcs\nTotal Lot Value: €${(Number(quantity) * Number(price)).toLocaleString()}\nCategory: ${category || 'General'}\nBarcode/EAN: ${barcode || 'N/A'}\nDescription: ${notes || 'Ready for immediate dispatch'}\n\n🔒 Trader details locked. Counterparty must unlock contact details to connect.`;

      const broadcastDetails = {
        itemType: kind,
        itemId: itemId || `item-${Date.now()}`,
        title,
        brand,
        category,
        condition,
        quantity: Number(quantity) || 1,
        price: Number(price) || 0,
        moq: Number(moq) || 1,
        barcode,
        notes,
        ownerCompanyId: senderCompanyId,
        ownerCompanyName: senderCompanyName || 'Commercial Member',
        ownerContactName: senderContactName || 'Trading Representative',
        ownerEmail: senderEmail,
        ownerPhone: senderPhone,
      };

      const broadcastMessage: ChatMessage = {
        id: `broadcast-msg-${Date.now()}`,
        senderId: senderCompanyId,
        senderName: `${kind.toUpperCase()} Broadcast Desk`,
        senderRole: kind === 'wtb' ? 'buyer' : 'seller',
        text: initialMsgText,
        timestamp: new Date().toISOString(),
        isRead: false,
        isBroadcast: true,
        targetAudience: targetAudience || 'all',
        broadcastKind: kind,
        broadcastDetails,
      };

      const productId = await getSystemProductId(supabase);

      const { data: newRow, error: insertErr } = await supabase
        .from('product_inquiries')
        .insert({
          product_id: productId,
          seller_company_id: senderCompanyId,
          buyer_name: senderContactName || 'Trading Representative',
          buyer_email: senderEmail || 'member@b2blink.eu',
          buyer_phone: senderPhone || null,
          buyer_company: `[${kind.toUpperCase()} BROADCAST] ${title}`,
          requested_quantity: Number(quantity) || 1,
          target_price: Number(price) || 0,
          message: JSON.stringify([broadcastMessage]),
          status: statusValue,
        })
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          requested_quantity,
          target_price,
          message,
          status,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .single();

      if (insertErr || !newRow) {
        console.warn('[MEMBER BROADCAST DB INSERT NOTICE]', insertErr?.message);
        return NextResponse.json({
          success: true,
          broadcast: broadcastMessage,
          conversation: {
            id: `broadcast-${kind}-${Date.now()}`,
            type: 'broadcast',
            targetAudience: targetAudience || 'all',
            status: statusValue,
            productId: itemId || productId,
            productTitle: `[${kind.toUpperCase()} BROADCAST] ${title}`,
            productPrice: Number(price) || 0,
            productMoq: Number(moq) || 1,
            productCategory: category,
            sellerCompanyId: senderCompanyId,
            sellerCompanyName: senderCompanyName || 'Commercial Member',
            sellerContactName: senderContactName || 'Trading Representative',
            buyerCompanyId: senderCompanyId,
            buyerCompanyName: senderCompanyName,
            buyerContactName: senderContactName,
            buyerEmail: senderEmail,
            buyerPhone: senderPhone,
            lastMessageText: initialMsgText,
            lastMessageTime: 'Just now',
            unreadBySeller: true,
            unreadByBuyer: true,
            messages: [broadcastMessage],
            broadcastKind: kind,
            broadcastDetails,
          },
        });
      }

      return NextResponse.json({
        success: true,
        broadcast: broadcastMessage,
        conversation: {
          ...rowToConversation(newRow as unknown as RawInquiryRow),
          broadcastKind: kind,
          broadcastDetails,
        },
      });
    }

    // 5. Contact Admin Desk
    if (action === 'contact_admin') {
      const { sellerCompanyId, initialMessage, contactName, contactEmail } = body;

      const productId = await getSystemProductId(supabase);

      const initialChatMessage: ChatMessage = {
        id: `msg-admin-contact-${Date.now()}`,
        senderId: sellerCompanyId,
        senderName: contactName || 'Seller Representative',
        senderRole: 'seller',
        text: initialMessage?.trim() || 'Requesting platform support from the admin desk.',
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      const { data: newRow, error: insertErr } = await supabase
        .from('product_inquiries')
        .insert({
          product_id: productId,
          seller_company_id: sellerCompanyId,
          buyer_name: 'Jeff Vetting Director',
          buyer_email: 'admin@b2blink.eu',
          buyer_phone: '+372 612 3456',
          buyer_company: 'B2B LINK OÜ (Admin Desk)',
          requested_quantity: 1,
          target_price: 0,
          message: JSON.stringify([initialChatMessage]),
          status: 'admin_desk',
        })
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          requested_quantity,
          target_price,
          message,
          status,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .single();

      if (insertErr || !newRow) {
        return NextResponse.json({ success: false, error: insertErr?.message || 'Contact admin failed' }, { status: 500 });
      }

      // Notify Admin Desk of new in-app support message
      void notifyInAppMessageRecipient({
        supabase,
        threadRow: newRow,
        message: initialChatMessage,
        conversationId: newRow.id,
      });

      return NextResponse.json({
        success: true,
        conversation: rowToConversation(newRow as unknown as RawInquiryRow),
      });
    }

    // 6. Standard Marketplace inquiry
    if (action === 'create_inquiry') {
      const {
        productId,
        sellerCompanyId,
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerCompany,
        requestedQuantity,
        targetPrice,
        initialMessage,
      } = body;

      if (!productId || !buyerEmail || !initialMessage) {
        return NextResponse.json(
          { success: false, error: 'Missing required inquiry parameters' },
          { status: 400 }
        );
      }

      let resolvedSellerId = sellerCompanyId;
      if (!resolvedSellerId) {
        const { data: prod } = await supabase.from('products').select('company_id').eq('id', productId).single();
        resolvedSellerId = prod?.company_id;
      }
      if (!resolvedSellerId) {
        resolvedSellerId = 'bc031215-8e34-4709-a97f-0df9cca07e63';
      }

      const initialChatMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        senderId: buyerEmail,
        senderName: buyerName || buyerCompany || 'Buyer',
        senderRole: 'buyer',
        text: initialMessage.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      const { data: newRow, error: insertErr } = await supabase
        .from('product_inquiries')
        .insert({
          product_id: productId,
          seller_company_id: resolvedSellerId,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone || null,
          buyer_company: buyerCompany || `${buyerName} Commercial`,
          requested_quantity: requestedQuantity || 1,
          target_price: targetPrice || 1,
          message: JSON.stringify([initialChatMessage]),
          status: 'new',
        })
        .select(`
          id,
          product_id,
          seller_company_id,
          buyer_name,
          buyer_email,
          buyer_phone,
          buyer_company,
          requested_quantity,
          target_price,
          message,
          status,
          created_at,
          products:products(id, title, unit_price, moq, image_urls),
          seller_company:companies!seller_company_id(id, company_name, contact_name, contact_email)
        `)
        .single();

      if (insertErr || !newRow) {
        return NextResponse.json({ success: false, error: insertErr?.message || 'Failed to record inquiry' }, { status: 500 });
      }

      // Notify seller of new in-app inquiry message
      void notifyInAppMessageRecipient({
        supabase,
        threadRow: newRow,
        message: initialChatMessage,
        conversationId: newRow.id,
      });

      return NextResponse.json({
        success: true,
        conversation: rowToConversation(newRow as unknown as RawInquiryRow),
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error processing inquiry' },
      { status: 500 }
    );
  }
}
