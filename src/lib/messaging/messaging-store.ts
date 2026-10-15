'use client';

import type { Product, Company, WtbRequest } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller' | 'admin';
  text: string;
  timestamp: string;
  isRead?: boolean;
  isBroadcast?: boolean;
  targetAudience?: 'seller' | 'buyer' | 'all';
}

export type InquiryMessage = ChatMessage;

export interface InquiryConversation {
  id: string;
  type?: 'buyer_seller' | 'seller_admin' | 'broadcast';
  targetAudience?: 'seller' | 'buyer' | 'all';
  status?: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  productPrice: number;
  productMoq: number;
  productCategory?: string;
  sellerCompanyId: string;
  sellerCompanyName: string;
  sellerContactName?: string;
  buyerCompanyId?: string;
  buyerCompanyName: string;
  buyerContactName?: string;
  buyerEmail?: string;
  buyerContactEmail?: string;
  buyerPhone?: string;
  buyerContactPhone?: string;
  lastMessageText: string;
  lastMessageTime: string;
  unreadBySeller: boolean;
  unreadByBuyer: boolean;
  unreadByAdmin?: boolean;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'b2b_live_inquiries_real_v2';
const EVENT_KEY = 'b2b_inquiry_update';
const NEW_MESSAGE_EVENT = 'b2b_inquiry_new_message';

export const mySentMessageIds = new Set<string>();

export function markMessageAsSentByMe(id: string) {
  mySentMessageIds.add(id);
}

export function isMessageSentByMe(id: string): boolean {
  return mySentMessageIds.has(id);
}

let liveBroadcastChannel: BroadcastChannel | null = null;
let realtimeInitialized = false;

// Initialize cross-tab BroadcastChannel
if (typeof window !== 'undefined') {
  try {
    liveBroadcastChannel = new BroadcastChannel('b2b_live_chat_channel');
    liveBroadcastChannel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'INQUIRY_UPDATE' && Array.isArray(data.conversations)) {
        try {
          const rawPrev = localStorage.getItem(STORAGE_KEY);
          const newJson = JSON.stringify(data.conversations);
          if (rawPrev === newJson && !data.newMessage) {
            return; // Conversations are identical, ignore redundant broadcast
          }
          localStorage.setItem(STORAGE_KEY, newJson);
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: data.conversations }));
        if (data.newMessage && data.conversation) {
          window.dispatchEvent(
            new CustomEvent(NEW_MESSAGE_EVENT, {
              detail: {
                message: data.newMessage,
                conversation: data.conversation,
                fromOtherTab: true,
              },
            })
          );
        }
      }
    };
  } catch {
    // BroadcastChannel unsupported or blocked
  }

  // Setup Supabase Realtime Channel
  if (!realtimeInitialized) {
    try {
      realtimeInitialized = true;
      const supabase = createClient();
      supabase
        .channel('b2b-live-messaging-hub')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'product_inquiries' },
          () => {
            void syncWithSupabase();
          }
        )
        .subscribe();
    } catch {
      // offline or silent
    }
  }
}

// Helper to get conversations from localStorage
export function getStoredConversations(): InquiryConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      void syncWithSupabase();
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    void syncWithSupabase();
    return [];
  } catch {
    return [];
  }
}

// Helper to save conversations locally and broadcast
export function saveStoredConversations(
  convs: InquiryConversation[],
  newMessage?: ChatMessage,
  targetConversation?: InquiryConversation,
  isSentByLocalUser: boolean = false
) {
  if (typeof window === 'undefined') return;
  try {
    const rawPrev = localStorage.getItem(STORAGE_KEY);
    const newJson = JSON.stringify(convs);
    if (rawPrev === newJson && !newMessage) {
      return; // No mutations occurred, prevent event ping-pong
    }
    localStorage.setItem(STORAGE_KEY, newJson);
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: convs }));

    if (liveBroadcastChannel) {
      liveBroadcastChannel.postMessage({
        type: 'INQUIRY_UPDATE',
        conversations: convs,
        newMessage,
        conversation: targetConversation,
      });
    }

    if (newMessage && targetConversation && !isSentByLocalUser) {
      window.dispatchEvent(
        new CustomEvent(NEW_MESSAGE_EVENT, {
          detail: {
            message: newMessage,
            conversation: targetConversation,
          },
        })
      );
    }
  } catch {
    // Ignore
  }
}

export const saveConversations = saveStoredConversations;

// Sync conversations with Supabase backend
export async function syncWithSupabase(role?: string, companyId?: string, email?: string): Promise<InquiryConversation[]> {
  if (typeof window === 'undefined') return [];
  try {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (companyId) params.set('companyId', companyId);
    if (email) params.set('email', email);

    const url = `/api/inquiries${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        // Merge server conversations with locally stored conversations so newly created chats aren't lost
        const local = getStoredConversations();
        const merged = [...data.conversations];
        local.forEach((localConv) => {
          const already = merged.some(
            (m) =>
              m.id === localConv.id ||
              (m.productId === localConv.productId &&
                Boolean(localConv.buyerEmail) &&
                m.buyerEmail?.toLowerCase() === localConv.buyerEmail?.toLowerCase())
          );
          if (!already) {
            merged.push(localConv);
          }
        });
        saveStoredConversations(merged);
        return merged;
      }
    }
  } catch {
    // Network or offline fallback
  }
  return getStoredConversations();
}

// Filter conversations strictly for active company/role
export function getConversationsForUser(company: Company | null): InquiryConversation[] {
  const all = getStoredConversations();
  if (!company) return all;

  // Admin Jeff only sees messages sent to or from admin, plus broadcasts:
  // Trade inquiries between buyers and sellers are strictly private and confidential
  if (company.role === 'admin') {
    return all.filter(
      (c) => c.type === 'seller_admin' || c.type === 'broadcast'
    );
  }

  const userEmail = company.email?.toLowerCase().trim();
  const contactEmail = company.contact_email?.toLowerCase().trim();

  // Buyer sees:
  // 1) Direct messages from Admin Desk / Jeff (welcome messages & platform advisories)
  // 2) Buyer Broadcasts (targetAudience === 'buyer' or 'all')
  // 3) Inquiries they initiated as buyer
  if (company.role === 'buyer') {
    return all.filter(
      (c) =>
        ((c.type === 'seller_admin' || c.status === 'admin_desk') &&
          ((userEmail && c.buyerEmail?.toLowerCase().trim() === userEmail) ||
            (c.buyerCompanyId === company.id) ||
            !c.buyerEmail)) ||
        (c.type === 'broadcast' && (c.targetAudience === 'buyer' || c.targetAudience === 'all')) ||
        (c.type === 'buyer_seller' &&
          (c.buyerCompanyId === company.id ||
            (userEmail &&
              (c.buyerEmail?.toLowerCase().trim() === userEmail ||
                c.buyerContactEmail?.toLowerCase().trim() === userEmail)) ||
            (contactEmail &&
              (c.buyerEmail?.toLowerCase().trim() === contactEmail ||
                c.buyerContactEmail?.toLowerCase().trim() === contactEmail)) ||
            !c.buyerEmail))
    );
  }

  // Seller sees:
  // 1) Seller Broadcasts (targetAudience === 'seller' or untargeted)
  // 2) Direct Admin Desk support thread for their company
  // 3) Inquiries where they are the seller
  // 4) Inquiries where they contacted another supplier from the marketplace (they are the inquirer/buyer)
  return all.filter((c) => {
    if (c.type === 'broadcast') {
      return c.targetAudience === 'seller' || !c.targetAudience || c.targetAudience === 'all';
    }
    if (c.type === 'seller_admin' || c.status === 'admin_desk') {
      return (
        c.sellerCompanyId === company.id ||
        (userEmail && (c.buyerEmail?.toLowerCase().trim() === userEmail || c.buyerContactEmail?.toLowerCase().trim() === userEmail)) ||
        (contactEmail && (c.buyerEmail?.toLowerCase().trim() === contactEmail || c.buyerContactEmail?.toLowerCase().trim() === contactEmail))
      );
    }
    if (c.type === 'buyer_seller' || !c.type) {
      const isSeller = c.sellerCompanyId === company.id;
      const isBuyer =
        c.buyerCompanyId === company.id ||
        (userEmail &&
          (c.buyerEmail?.toLowerCase().trim() === userEmail ||
            c.buyerContactEmail?.toLowerCase().trim() === userEmail)) ||
        (contactEmail &&
          (c.buyerEmail?.toLowerCase().trim() === contactEmail ||
            c.buyerContactEmail?.toLowerCase().trim() === contactEmail));
      return isSeller || isBuyer;
    }
    return false;
  });
}

// Send a new message inside a conversation (optimistic + instant broadcast + Supabase persist)
export function sendInquiryMessage(
  conversationId: string,
  senderRole: 'buyer' | 'seller' | 'admin',
  senderName: string,
  senderId: string,
  text: string
): InquiryConversation | null {
  const all = getStoredConversations();
  const conv = all.find((c) => c.id === conversationId);
  if (!conv || !text.trim()) return null;

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderId,
    senderName,
    senderRole,
    text: text.trim(),
    timestamp: new Date().toISOString(),
    isBroadcast: conv.type === 'broadcast',
  };

  markMessageAsSentByMe(newMsg.id);

  conv.messages.push(newMsg);
  conv.lastMessageText = text.trim();
  conv.lastMessageTime = 'Just now';

  if (senderRole === 'buyer') {
    conv.unreadBySeller = true;
    conv.unreadByBuyer = false;
  } else if (senderRole === 'seller') {
    conv.unreadByBuyer = true;
    conv.unreadBySeller = false;
    conv.unreadByAdmin = true;
  } else if (senderRole === 'admin') {
    conv.unreadBySeller = true;
    conv.unreadByBuyer = true;
    conv.unreadByAdmin = false;
  }

  // Save with isSentByLocalUser = true so sender's own window won't pop up toast
  saveStoredConversations(all, newMsg, conv, true);

  // Background persist to Supabase
  void (async () => {
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          conversationId,
          message: newMsg,
        }),
      });
    } catch {
      // offline/silent fallback
    }
  })();

  return conv;
}

// Broadcast an official message to Sellers or Buyers from Admin (Jeff)
export async function broadcastToTargetAudience(
  title: string,
  text: string,
  targetAudience: 'seller' | 'buyer' = 'seller',
  adminName: string = 'Jeff Vetting Director (B2B LINK Desk)',
  adminId: string = 'admin-desk'
): Promise<InquiryConversation | null> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_broadcast',
        title: title.trim(),
        text: text.trim(),
        targetAudience,
        adminName,
        adminId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.conversation) {
        const all = getStoredConversations();
        const existingIdx = all.findIndex((c) => c.id === data.conversation.id);
        if (existingIdx >= 0) {
          all[existingIdx] = data.conversation;
        } else {
          all.unshift(data.conversation);
        }
        if (data.broadcast?.id) markMessageAsSentByMe(data.broadcast.id);
        saveStoredConversations(all, data.broadcast, data.conversation, true);
        return data.conversation;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export const broadcastToAllSellers = (title: string, text: string) =>
  broadcastToTargetAudience(title, text, 'seller');

// Admin sends a private direct message to a specific seller
export async function sendAdminDirectMessage(
  sellerCompanyId: string,
  text: string,
  adminName: string = 'Jeff Vetting Director (B2B LINK Desk)',
  adminId: string = 'admin-desk'
): Promise<InquiryConversation | null> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'admin_direct_message',
        sellerCompanyId,
        text: text.trim(),
        adminName,
        adminId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.conversation) {
        const all = getStoredConversations();
        const existingIdx = all.findIndex((c) => c.id === data.conversation.id);
        if (existingIdx >= 0) {
          all[existingIdx] = data.conversation;
        } else {
          all.unshift(data.conversation);
        }
        if (data.message?.id) markMessageAsSentByMe(data.message.id);
        saveStoredConversations(all, data.message, data.conversation, true);
        return data.conversation;
      }
    }
  } catch {
    // silent
  }
  return null;
}

// Fetch list of registered sellers for Admin Direct Messaging
export async function fetchAllSellersForAdmin(): Promise<any[]> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_sellers' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.sellers)) {
        return data.sellers;
      }
    }
  } catch {
    // fallback
  }
  return [];
}

// Open or start a direct contact thread with Admin Desk from Seller
export async function contactAdminDesk(
  sellerCompanyId: string,
  contactName: string,
  contactEmail: string,
  initialMessage: string
): Promise<InquiryConversation | null> {
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'contact_admin',
        sellerCompanyId,
        contactName,
        contactEmail,
        initialMessage,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.conversation) {
        const all = getStoredConversations();
        const existingIdx = all.findIndex((c) => c.id === data.conversation.id);
        if (existingIdx >= 0) {
          all[existingIdx] = data.conversation;
        } else {
          all.unshift(data.conversation);
        }
        if (data.conversation.messages?.[0]?.id) {
          markMessageAsSentByMe(data.conversation.messages[0].id);
        }
        saveStoredConversations(all, data.conversation.messages[0], data.conversation, true);
        return data.conversation;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

// Create or get an inquiry conversation when buyer messages seller from Marketplace
export function startMarketplaceInquiry(
  product: Product,
  buyerCompany: Company | null,
  buyerName: string,
  buyerEmail: string,
  buyerPhone: string,
  initialMessage: string
): InquiryConversation {
  const all = getStoredConversations();
  const cleanEmail = (buyerEmail || buyerCompany?.email || '').toLowerCase().trim();
  const convId = `conv-${product.id}-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Determine the REAL seller of the product
  const resolvedSellerId =
    product.company_id ||
    product.company?.id ||
    'bc031215-8e34-4709-a97f-0df9cca07e63';

  const resolvedSellerName =
    product.company?.name ||
    (product.company as any)?.company_name ||
    'Verified Supplier';

  const resolvedSellerContact =
    product.company?.contact_name || 'Trade Desk';

  const resolvedBuyerCompanyId =
    buyerCompany?.id || `buyer-guest-${Date.now()}`;

  const resolvedBuyerCompanyName =
    buyerCompany?.company_name || buyerCompany?.name || `${buyerName} Commercial`;

  // Look for existing conversation specifically for this buyer & product
  let existing = all.find(
    (c) =>
      c.id === convId ||
      (c.productId === product.id &&
        (c.buyerCompanyId === resolvedBuyerCompanyId ||
          (cleanEmail && c.buyerEmail?.toLowerCase().trim() === cleanEmail)))
  );

  const initialMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    senderId: buyerCompany?.id || cleanEmail,
    senderName: buyerName || buyerCompany?.contact_name || 'Buyer Representative',
    senderRole: 'buyer',
    text: initialMessage.trim(),
    timestamp: new Date().toISOString(),
  };

  markMessageAsSentByMe(initialMsg.id);

  if (existing) {
    existing.messages.push(initialMsg);
    existing.lastMessageText = initialMessage.trim();
    existing.lastMessageTime = 'Just now';
    existing.unreadBySeller = true;
    existing.unreadByBuyer = false;
  } else {
    existing = {
      id: convId,
      type: 'buyer_seller',
      productId: product.id,
      productTitle: product.title,
      productImage:
        product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
      productPrice: product.unit_price,
      productMoq: product.moq,
      productCategory: product.category_slug || 'Consumer Electronics',
      sellerCompanyId: resolvedSellerId,
      sellerCompanyName: resolvedSellerName,
      sellerContactName: resolvedSellerContact,
      buyerCompanyId: resolvedBuyerCompanyId,
      buyerCompanyName: resolvedBuyerCompanyName,
      buyerContactName: buyerName || buyerCompany?.contact_name || 'Buyer',
      buyerEmail: cleanEmail,
      buyerContactEmail: cleanEmail,
      buyerPhone,
      buyerContactPhone: buyerPhone,
      lastMessageText: initialMessage.trim(),
      lastMessageTime: 'Just now',
      unreadBySeller: true,
      unreadByBuyer: false,
      messages: [initialMsg],
    };
    all.unshift(existing);
  }

  // Save with isSentByLocalUser = true so sender will not receive their own inquiry popup
  saveStoredConversations(all, initialMsg, existing, true);

  // Background persist to Supabase
  void (async () => {
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_inquiry',
          productId: product.id,
          sellerCompanyId: resolvedSellerId,
          buyerCompanyId: resolvedBuyerCompanyId,
          buyerName: buyerName || buyerCompany?.contact_name || 'Buyer',
          buyerEmail: cleanEmail,
          buyerPhone,
          buyerCompany: resolvedBuyerCompanyName,
          requestedQuantity: product.moq || 1,
          targetPrice: product.unit_price || 1,
          initialMessage: initialMessage.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.conversation) {
          const currentAll = getStoredConversations();
          const targetIndex = currentAll.findIndex(
            (c) => c.id === convId || (existing && c.id === existing.id)
          );
          if (targetIndex >= 0) {
            currentAll[targetIndex] = {
              ...currentAll[targetIndex],
              ...data.conversation,
              id: data.conversation.id,
            };
            saveStoredConversations(currentAll);
          }
        }
      }
    } catch {
      // offline/silent fallback
    }
  })();

  return existing;
}

// Mark conversation as read
export function markConversationAsRead(conversationId: string, role: 'buyer' | 'seller' | 'admin') {
  if (typeof window === 'undefined') return;
  const all = getStoredConversations();
  const conv = all.find((c) => c.id === conversationId);
  if (!conv) return;

  let changed = false;
  if (role === 'seller' && conv.unreadBySeller) {
    conv.unreadBySeller = false;
    changed = true;
  } else if (role === 'buyer' && conv.unreadByBuyer) {
    conv.unreadByBuyer = false;
    changed = true;
  } else if (role === 'admin' && conv.unreadByAdmin) {
    conv.unreadByAdmin = false;
    changed = true;
  }

  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore
    }
  }
}

// Subscribe to conversation updates
export function onInquiriesUpdate(callback: (conversations: InquiryConversation[]) => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<InquiryConversation[]>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(EVENT_KEY, handler);
  return () => {
    window.removeEventListener(EVENT_KEY, handler);
  };
}

// Subscribe to new incoming live messages
export function onNewLiveMessage(
  callback: (data: { message: ChatMessage; conversation: InquiryConversation; fromOtherTab?: boolean }) => void
) {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<{
      message: ChatMessage;
      conversation: InquiryConversation;
      fromOtherTab?: boolean;
    }>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(NEW_MESSAGE_EVENT, handler);
  return () => {
    window.removeEventListener(NEW_MESSAGE_EVENT, handler);
  };
}

export interface ReceivedWtbQuote {
  id: string;
  wtbRequestId: string;
  productName: string;
  categorySlug?: string;
  sellerCompanyId: string;
  sellerCompanyName: string;
  sellerContactName: string;
  sellerEmail: string;
  sellerPhone?: string;
  sellerTier: string;
  offeredPrice: number;
  offeredQuantity: number;
  totalPrice: number;
  leadTimeDays: number;
  notes?: string;
  status: 'Lead Unlocked' | 'Quote Sent' | 'Email Sent';
  actionType: 'unlocked' | 'quote_submitted' | 'email_sent';
  conversationId: string;
  createdAt: string;
}

export interface WtbLeadDispatchParams {
  wtbRequest: WtbRequest;
  sellerCompany: Company;
  actionType: 'unlocked' | 'quote_submitted' | 'email_sent';
  quoteDetails?: {
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    leadTimeDays: number;
    notes?: string;
  };
}

/**
 * Dispatches an official lead/quote notification from a Seller to a Buyer's dashboard.
 * 1. Creates/updates an active private chat thread between the Seller and Buyer in Live Inquiries.
 * 2. Persists the received quote to the buyer's received quotes table.
 * 3. Broadcasts real-time events across browser tabs.
 */
export function dispatchWtbLeadToBuyerDashboard({
  wtbRequest,
  sellerCompany,
  actionType,
  quoteDetails,
}: WtbLeadDispatchParams): InquiryConversation {
  const all = getStoredConversations();
  const cleanBuyerEmail = (wtbRequest.buyer_email || '').toLowerCase().trim();
  const convId = `conv-wtb-${wtbRequest.id}-${sellerCompany.id}`;

  const resolvedPrice = quoteDetails?.unitPrice ?? wtbRequest.target_price;
  const resolvedQty = quoteDetails?.quantity ?? wtbRequest.target_quantity;
  const resolvedTotal = quoteDetails?.totalPrice ?? Number((resolvedPrice * resolvedQty).toFixed(2));
  const resolvedLeadTime = quoteDetails?.leadTimeDays ?? 3;

  let messageText = '';
  if (actionType === 'quote_submitted') {
    messageText = `💼 Official Wholesale Quotation Received from ${sellerCompany.name}\n\n` +
      `Regarding your WTB Request: "${wtbRequest.product_name}"\n\n` +
      `Commercial Offer Details:\n` +
      `• Offered Unit Price: £${resolvedPrice.toFixed(2)} / unit\n` +
      `• Offered Quantity: ${resolvedQty.toLocaleString()} units\n` +
      `• Total Deal Value: £${resolvedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `• Estimated Dispatch Lead Time: ${resolvedLeadTime} business days\n` +
      (quoteDetails?.notes ? `• Commercial Notes: "${quoteDetails.notes}"\n\n` : '\n') +
      `Supplier Information:\n` +
      `• Company: ${sellerCompany.name}\n` +
      `• Contact Person: ${sellerCompany.contact_name || 'Trade Desk'}\n` +
      `• Email: ${sellerCompany.email || sellerCompany.contact_email}\n` +
      `• Phone: ${sellerCompany.phone || 'Available via chat'}\n` +
      `• Membership Tier: ${(sellerCompany.membership_tier || 'Verified').toUpperCase()} Verified Supplier\n\n` +
      `The supplier has dispatched this formal quotation. Reply here in live chat to begin negotiations or arrange wholesale settlement.`;
  } else if (actionType === 'email_sent') {
    messageText = `📧 Direct Email Quotation Sent by ${sellerCompany.name}\n\n` +
      `Hello ${wtbRequest.buyer_name},\n\n` +
      `Verified supplier ${sellerCompany.name} (${sellerCompany.contact_name || 'Sales Representative'}) has dispatched an official wholesale quotation directly to your procurement email: ${wtbRequest.buyer_email}.\n\n` +
      `Supplier Details:\n` +
      `• Company: ${sellerCompany.name}\n` +
      `• Contact: ${sellerCompany.contact_name || 'Commercial Team'}\n` +
      `• Email: ${sellerCompany.email || sellerCompany.contact_email}\n` +
      `• Phone: ${sellerCompany.phone || 'Available via chat'}\n` +
      `• Verification: ✅ ${(sellerCompany.membership_tier || 'Verified').toUpperCase()} Supplier\n\n` +
      `Please check your inbox or reply directly in this chat thread to coordinate.`;
  } else {
    // actionType === 'unlocked'
    messageText = `🏢 Supplier Lead Connected: ${sellerCompany.name}\n\n` +
      `Hello ${wtbRequest.buyer_name},\n\n` +
      `Verified supplier ${sellerCompany.name} has reviewed your WTB request for "${wtbRequest.product_name}" (${wtbRequest.target_quantity.toLocaleString()} units at target £${wtbRequest.target_price.toFixed(2)}), unlocked your buyer details, and initiated communication.\n\n` +
      `Supplier Profile:\n` +
      `• Company: ${sellerCompany.name}\n` +
      `• Representative: ${sellerCompany.contact_name || 'Sales Desk'}\n` +
      `• Email: ${sellerCompany.email || sellerCompany.contact_email}\n` +
      `• Phone: ${sellerCompany.phone || 'Available via chat'}\n` +
      `• Status: ✅ ${(sellerCompany.membership_tier || 'Verified').toUpperCase()} Verified Supplier\n\n` +
      `The supplier has sent you this message. Reply here to begin discussion or request product lots!`;
  }

  const msgId = `msg-wtb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const initialMsg: ChatMessage = {
    id: msgId,
    senderId: sellerCompany.id,
    senderName: `${sellerCompany.name} (${sellerCompany.contact_name || 'Sales'})`,
    senderRole: 'seller',
    text: messageText,
    timestamp: new Date().toISOString(),
  };

  markMessageAsSentByMe(msgId);

  let existing = all.find(
    (c) => c.id === convId || (c.productId === `wtb-${wtbRequest.id}` && c.sellerCompanyId === sellerCompany.id)
  );

  if (existing) {
    existing.messages.push(initialMsg);
    existing.lastMessageText = messageText;
    existing.lastMessageTime = 'Just now';
    existing.unreadByBuyer = true;
    existing.unreadBySeller = false;
  } else {
    existing = {
      id: convId,
      type: 'buyer_seller',
      status: 'wtb_quotation',
      productId: `wtb-${wtbRequest.id}`,
      productTitle: `[WTB Quote] ${wtbRequest.product_name}`,
      productImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
      productPrice: resolvedPrice,
      productMoq: resolvedQty,
      productCategory: wtbRequest.category_slug || 'Wholesale Demand',
      sellerCompanyId: sellerCompany.id,
      sellerCompanyName: sellerCompany.name,
      sellerContactName: sellerCompany.contact_name || 'Sales Desk',
      buyerCompanyId: wtbRequest.buyer_company_id || undefined,
      buyerCompanyName: (wtbRequest as any).buyer_company || wtbRequest.buyer_name,
      buyerContactName: wtbRequest.buyer_name,
      buyerEmail: cleanBuyerEmail,
      buyerContactEmail: cleanBuyerEmail,
      buyerPhone: wtbRequest.buyer_phone || undefined,
      buyerContactPhone: wtbRequest.buyer_phone || undefined,
      lastMessageText: messageText,
      lastMessageTime: 'Just now',
      unreadByBuyer: true,
      unreadBySeller: false,
      messages: [initialMsg],
    };
    all.unshift(existing);
  }

  saveStoredConversations(all, initialMsg, existing, true);

  // Also persist to buyer's received quotes store in localStorage
  if (typeof window !== 'undefined' && cleanBuyerEmail) {
    try {
      const buyerQuotesKey = `b2b_received_quotes_${cleanBuyerEmail}`;
      const rawQuotes = localStorage.getItem(buyerQuotesKey);
      const existingQuotes: ReceivedWtbQuote[] = rawQuotes ? JSON.parse(rawQuotes) : [];

      const newQuoteRecord: ReceivedWtbQuote = {
        id: `rq-${wtbRequest.id}-${sellerCompany.id}`,
        wtbRequestId: wtbRequest.id,
        productName: wtbRequest.product_name,
        categorySlug: wtbRequest.category_slug,
        sellerCompanyId: sellerCompany.id,
        sellerCompanyName: sellerCompany.name,
        sellerContactName: sellerCompany.contact_name || 'Representative',
        sellerEmail: sellerCompany.email || sellerCompany.contact_email || '',
        sellerPhone: sellerCompany.phone || undefined,
        sellerTier: sellerCompany.membership_tier || 'silver',
        offeredPrice: resolvedPrice,
        offeredQuantity: resolvedQty,
        totalPrice: resolvedTotal,
        leadTimeDays: resolvedLeadTime,
        notes: quoteDetails?.notes || (actionType === 'email_sent' ? 'Official quotation sent via direct email.' : 'Supplier unlocked buyer lead and initiated contact.'),
        status: actionType === 'quote_submitted' ? 'Quote Sent' : actionType === 'email_sent' ? 'Email Sent' : 'Lead Unlocked',
        actionType,
        conversationId: convId,
        createdAt: new Date().toISOString(),
      };

      const quoteIdx = existingQuotes.findIndex(
        (q) => q.wtbRequestId === wtbRequest.id && q.sellerCompanyId === sellerCompany.id
      );
      if (quoteIdx >= 0) {
        existingQuotes[quoteIdx] = newQuoteRecord;
      } else {
        existingQuotes.unshift(newQuoteRecord);
      }
      localStorage.setItem(buyerQuotesKey, JSON.stringify(existingQuotes));

      // Trigger event so buyer dashboard reacts immediately
      window.dispatchEvent(new CustomEvent('b2b_received_quotes_update', { detail: existingQuotes }));
    } catch {
      // ignore
    }
  }

  // Background persist to Supabase via /api/inquiries
  void (async () => {
    try {
      await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_inquiry',
          productId: `wtb-${wtbRequest.id}`,
          sellerCompanyId: sellerCompany.id,
          buyerCompanyId: wtbRequest.buyer_company_id || undefined,
          buyerName: wtbRequest.buyer_name,
          buyerEmail: cleanBuyerEmail,
          buyerPhone: wtbRequest.buyer_phone,
          buyerCompany: (wtbRequest as any).buyer_company || wtbRequest.buyer_name,
          requestedQuantity: resolvedQty,
          targetPrice: resolvedPrice,
          initialMessage: messageText,
        }),
      });
    } catch {
      // offline/silent
    }
  })();

  return existing;
}

export function getBuyerReceivedQuotes(buyerEmail: string): ReceivedWtbQuote[] {
  if (typeof window === 'undefined' || !buyerEmail) return [];
  try {
    const buyerQuotesKey = `b2b_received_quotes_${buyerEmail.toLowerCase().trim()}`;
    const raw = localStorage.getItem(buyerQuotesKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

