-- Migration: Create customer_queries table with RLS enabled and no public policies
-- Table stores public contact form inquiries and compliance desk queries.

CREATE TABLE IF NOT EXISTS public.customer_queries (
  id TEXT PRIMARY KEY DEFAULT ('query-' || extract(epoch from clock_timestamp())::bigint || '-' || substr(md5(random()::text), 1, 4)),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  topic TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied')),
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customer_queries ENABLE ROW LEVEL SECURITY;

-- No public policies. Table access is strictly restricted to service-role (admin client).

-- Seed existing queries from JSON
INSERT INTO public.customer_queries (id, name, company, email, phone, topic, message, created_at, status)
VALUES 
  ('query-1794074868292-ef2q', 'Upshift Creative', 'Creative', 'upshiftcreative.co.uk@gmail.com', '', 'verification', 'What documents Do I need to register', '2026-11-07 10:07:00+00', 'new'),
  ('query-1794074580739-9aam', 'Huzaifa Faisal', 'Faisal', 'huzaifaf559@gmail.com', '', 'sourcing', 'Hi, I am looking to buy, Do I still need to buy a membership for it?', '2026-11-07 10:02:00+00', 'new')
ON CONFLICT (id) DO NOTHING;
