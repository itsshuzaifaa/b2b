export type UserRole = 'admin' | 'seller' | 'buyer';
export type ApprovalStatus = 'pending' | 'pending_verification' | 'approved' | 'rejected' | 'suspended';
export type MembershipTier = 'bronze' | 'silver' | 'gold';
export type ProductStatus = 'active' | 'inactive' | 'sold_out' | 'draft';
export type ProductCondition = 'new' | 'used' | 'refurbished' | 'worn_out';
export type WtbStatus = 'open' | 'fulfilled' | 'closed' | 'expired';
export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type NotificationType = 'niche_alert' | 'barcode_match';
export type QueueStatus = 'pending' | 'sent' | 'failed';

export type TierConfig = {
  maxActiveProducts: number;
  maxMonthlyQuotes: number;
  csvUpload: boolean;
  hotListings: boolean;
  contactUnlocks: number;
};

export const TIER_LIMITS: Record<MembershipTier, TierConfig> = {
  bronze: {
    maxActiveProducts: 15,
    maxMonthlyQuotes: 10,
    csvUpload: false,
    hotListings: false,
    contactUnlocks: 2,
  },
  silver: {
    maxActiveProducts: 50,
    maxMonthlyQuotes: 25,
    csvUpload: true,
    hotListings: false,
    contactUnlocks: 20,
  },
  gold: {
    maxActiveProducts: Infinity,
    maxMonthlyQuotes: 50,
    csvUpload: true,
    hotListings: true,
    contactUnlocks: Infinity,
  },
};

export type Company = {
  id: string;
  user_id?: string | null;
  name: string;
  company_name?: string;
  company_number?: string | null;
  vat_number?: string | null;
  contact_name: string;
  email: string;
  contact_email?: string;
  phone?: string | null;
  role: UserRole;
  membership_tier: MembershipTier;
  tier?: MembershipTier;
  approval_status: ApprovalStatus;
  rejection_reason?: string | null;
  categories: string[];
  niches?: string[];
  website?: string | null;
  address?: string | null;
  unlocks_used?: number;
  created_at: string;
  updated_at?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  created_at?: string;
};

export type Product = {
  id: string;
  company_id: string;
  category_id?: string | null;
  category_slug: string;
  title: string;
  brand?: string | null;
  condition?: ProductCondition | string | null;
  ean_upc?: string | null;
  description?: string | null;
  barcode_or_sku?: string | null;
  unit_price: number;
  quantity_available: number;
  moq: number;
  status: ProductStatus;
  is_hot: boolean;
  images?: string[];
  created_at: string;
  updated_at?: string;
  company?: Company;
};

export type ProductInquiry = {
  id: string;
  product_id: string;
  seller_company_id: string;
  buyer_company_id?: string | null;
  buyer_company?: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  target_quantity?: number | null;
  requested_quantity?: number | null;
  offered_price?: number | null;
  target_price?: number | null;
  message: string;
  status?: string | null;
  created_at: string;
  product?: Product;
  seller_company?: Company;
};

export type WtbRequest = {
  id: string;
  buyer_company_id?: string | null;
  buyer_user_id?: string | null;
  buyer_company?: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  product_name: string;
  category_id?: string | null;
  category_slug: string;
  target_quantity: number;
  target_price: number;
  delivery_deadline?: string | null;
  barcode_or_sku?: string | null;
  notes?: string | null;
  status: WtbStatus;
  created_at: string;
  updated_at?: string;
};

export type Quotation = {
  id: string;
  wtb_request_id: string;
  seller_company_id: string;
  unit_price: number;
  total_price?: number | null;
  quantity_offered: number;
  lead_time_days?: number | null;
  notes?: string | null;
  status: QuoteStatus;
  created_at: string;
  wtb_request?: WtbRequest;
  seller_company?: Company;
};

export type WtbNotificationQueue = {
  id: string;
  wtb_request_id: string;
  seller_company_id: string;
  notification_type: NotificationType;
  status: QueueStatus;
  sent_at?: string | null;
  error_message?: string | null;
  created_at: string;
  wtb_request?: WtbRequest;
  seller_company?: Company;
};

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: Company;
        Insert: Partial<Company> & Record<string, unknown>;
        Update: Partial<Company> & Record<string, unknown>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Partial<Category> & Pick<Category, 'name' | 'slug'>;
        Update: Partial<Category>;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: Partial<Product> &
          Pick<
            Product,
            'company_id' | 'category_slug' | 'title' | 'unit_price' | 'quantity_available' | 'moq'
          >;
        Update: Partial<Product>;
        Relationships: [];
      };
      product_inquiries: {
        Row: ProductInquiry;
        Insert: Partial<ProductInquiry> & Record<string, unknown>;
        Update: Partial<ProductInquiry> & Record<string, unknown>;
        Relationships: [];
      };
      wtb_requests: {
        Row: WtbRequest;
        Insert: Partial<WtbRequest> &
          Pick<
            WtbRequest,
            'buyer_name' | 'buyer_email' | 'product_name' | 'category_slug' | 'target_quantity' | 'target_price'
          >;
        Update: Partial<WtbRequest>;
        Relationships: [];
      };
      quotations: {
        Row: Quotation;
        Insert: Partial<Quotation> &
          Pick<Quotation, 'wtb_request_id' | 'seller_company_id' | 'unit_price' | 'quantity_offered'>;
        Update: Partial<Quotation>;
        Relationships: [];
      };
      wtb_notifications_queue: {
        Row: WtbNotificationQueue;
        Insert: Partial<WtbNotificationQueue> &
          Pick<WtbNotificationQueue, 'wtb_request_id' | 'seller_company_id' | 'notification_type'>;
        Update: Partial<WtbNotificationQueue>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fn_get_seller_monthly_quote_usage: {
        Args: {
          p_company_id: string;
        };
        Returns: number;
      };
    };
  };
};
