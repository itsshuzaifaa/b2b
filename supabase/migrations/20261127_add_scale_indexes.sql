-- Migration: Performance & Scale B-Tree Indexes for 10,000+ listings and high concurrency
-- Run this statement in Supabase SQL Editor:

create index if not exists idx_products_company_status on public.products(company_id, status);
create index if not exists idx_products_status_created on public.products(status, created_at desc);
create index if not exists idx_products_barcode_sku on public.products(barcode_or_sku);

create index if not exists idx_wtb_status_barcode on public.wtb_requests(status, barcode_or_sku);
create index if not exists idx_wtb_buyer_user_id on public.wtb_requests(buyer_user_id);
create index if not exists idx_wtb_buyer_email on public.wtb_requests(buyer_email);

create index if not exists idx_inquiries_seller_status on public.product_inquiries(seller_company_id, status, created_at desc);
create index if not exists idx_inquiries_buyer_email on public.product_inquiries(buyer_email, created_at desc);

create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_companies_contact_email on public.companies(contact_email);
create index if not exists idx_companies_approval_status on public.companies(approval_status);
