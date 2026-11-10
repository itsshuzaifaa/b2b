-- ==============================================================================
-- Migration: Create public.subscriptions table and link to public.payments
-- File: supabase/migrations/20261111_create_subscriptions.sql
-- ==============================================================================

-- 1. Create Subscriptions Table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tier text not null check (tier in ('silver', 'gold')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'expired', 'free')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  retry_count integer not null default 0 check (retry_count between 0 and 3),
  last_retry_at timestamptz,
  next_retry_at timestamptz,
  last_failure_reason text check (last_failure_reason is null or char_length(last_failure_reason) <= 500),
  payment_method text not null default 'card' check (char_length(payment_method) <= 100),
  gateway_customer_id text check (gateway_customer_id is null or char_length(gateway_customer_id) <= 150),
  gateway_subscription_id text check (gateway_subscription_id is null or char_length(gateway_subscription_id) <= 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Prevent Multiple Active Subscriptions per Company
create unique index if not exists idx_unique_active_subscription_per_company 
on public.subscriptions (company_id) 
where status in ('active', 'past_due');

-- 3. Link Existing Payment Ledger to Subscriptions
alter table public.payments 
add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

-- 4. Enable and Force Row Level Security
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

-- 5. RLS Policies (Read-only for company members; mutations strictly via Service Role)
create policy "Members can read own company subscription"
on public.subscriptions for select
to authenticated
using (
  company_id in (
    select id from public.companies where user_id = auth.uid()
  )
);

-- 6. Performance Indexes
create index if not exists idx_subscriptions_company_id on public.subscriptions(company_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_subscriptions_current_period_end on public.subscriptions(current_period_end);
create index if not exists idx_subscriptions_next_retry_at on public.subscriptions(next_retry_at) where status = 'past_due';
create index if not exists idx_payments_subscription_id on public.payments(subscription_id);

-- 7. Automatic updated_at Trigger
create or replace function public.fn_set_subscription_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_subscriptions_set_updated_at on public.subscriptions;
create trigger trg_subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.fn_set_subscription_updated_at();

-- 8. Non-destructive backfill for existing Silver and Gold companies lacking a subscription
insert into public.subscriptions (
  company_id,
  tier,
  status,
  current_period_start,
  current_period_end,
  payment_method
)
select 
  c.id,
  c.tier,
  'active',
  now(),
  now() + interval '30 days',
  'sandbox_backfill'
from public.companies c
where c.tier in ('silver', 'gold')
  and not exists (
    select 1 from public.subscriptions s 
    where s.company_id = c.id and s.status in ('active', 'past_due')
  );
