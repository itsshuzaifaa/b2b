-- ==============================================================================
-- Migration: Create payments table with RLS enabled, no public policies, and text length checks
-- File: supabase/migrations/20261110_create_payments.sql
-- ==============================================================================

-- 1. Create table
create table if not exists public.payments (
  id text primary key,
  company_id uuid references public.companies(id) on delete set null,
  company_name text not null check (char_length(company_name) <= 255),
  contact_email text not null check (char_length(contact_email) <= 255),
  plan_or_service text not null check (char_length(plan_or_service) <= 100),
  amount_gbp numeric(10, 2) not null check (amount_gbp >= 0),
  payment_method text not null check (char_length(payment_method) <= 100),
  wise_reference text check (wise_reference is null or char_length(wise_reference) <= 150),
  transaction_id text check (transaction_id is null or char_length(transaction_id) <= 150),
  status text not null default 'Completed' check (status in ('Completed', 'Pending Verification', 'Failed', 'Refunded')),
  invoice_number text not null check (char_length(invoice_number) <= 100),
  notes text check (notes is null or char_length(notes) <= 2000),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 2. Enable and Force Row Level Security (RLS)
alter table public.payments enable row level security;
alter table public.payments force row level security;

-- 3. No public policies are defined:
-- public, anon, and authenticated roles have ZERO direct access.
-- Elevated administrative API handlers access this table strictly via the Service Role client.

-- 4. Create performance indexes
create index if not exists idx_payments_company_id on public.payments(company_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_created_at on public.payments(created_at desc);
create index if not exists idx_payments_invoice_number on public.payments(invoice_number);
