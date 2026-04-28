-- ================================================================
-- FIANU UTILITIES — Shared Supabase Schema
-- Organisation: Fianu | Project: Utilities
--
-- HOW TO USE:
-- 1. Create a new project called "Utilities" in your Fianu
--    Supabase organisation
-- 2. Open the SQL Editor in that project
-- 3. Paste this entire script and click Run
--
-- ADDING A NEW SITE:
-- When you build a new utility site, simply add a row to the
-- sites table below and uncomment/update the placeholder.
-- Everything else (subscribers, usage) works automatically
-- via the site_id column.
-- ================================================================


-- ----------------------------------------------------------------
-- SITES REGISTRY
-- One row per utility site. Add new sites here as you build them.
-- ----------------------------------------------------------------
create table if not exists sites (
  id          text primary key,        -- short slug e.g. 'pdftoledger'
  name        text not null,           -- display name e.g. 'PDFtoLedger'
  domain      text,                    -- e.g. 'pdftoledger.com'
  description text,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- Known sites — update placeholders as you build each one
insert into sites (id, name, domain, description, active) values
  ('pdftoledger',  'PDFtoLedger',   'pdftoledger.com',  'Convert PDF bank statements to categorised Excel spreadsheets', true),
  ('utility_002',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_003',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_004',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_005',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_006',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_007',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_008',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_009',  'Coming Soon',    null,               'Placeholder — update when ready', false),
  ('utility_010',  'Coming Soon',    null,               'Placeholder — update when ready', false)
on conflict (id) do nothing;


-- ----------------------------------------------------------------
-- SUBSCRIBERS
-- Tracks every paying user across all utility sites.
-- One row per user per site.
-- ----------------------------------------------------------------
create table if not exists subscribers (
  id                     uuid default gen_random_uuid() primary key,
  site_id                text not null references sites(id),
  email                  text not null,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  plan                   text not null default 'free'
                           check (plan in ('free', 'pro', 'practice')),
  status                 text not null default 'active'
                           check (status in ('active', 'cancelled', 'past_due', 'trialing')),
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  unique(site_id, email)
);


-- ----------------------------------------------------------------
-- USAGE TRACKING
-- Tracks monthly page/action usage for enforcing free tier limits.
-- Works for both logged-in users (email) and anonymous visitors
-- (browser fingerprint).
-- ----------------------------------------------------------------
create table if not exists usage (
  id          uuid default gen_random_uuid() primary key,
  site_id     text not null references sites(id),
  email       text,           -- null if anonymous user
  fingerprint text,           -- browser fingerprint for anonymous users
  pages_used  integer default 0,
  period      text not null,  -- format: 'YYYY-MM' e.g. '2024-03'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create unique index if not exists idx_usage_unique
  on usage(site_id, coalesce(email, fingerprint), period);


-- ----------------------------------------------------------------
-- STRIPE EVENTS LOG
-- Records every Stripe webhook event for debugging and auditing.
-- Prevents duplicate processing of the same event.
-- ----------------------------------------------------------------
create table if not exists stripe_events (
  id           text primary key,   -- Stripe event ID (evt_xxx)
  site_id      text references sites(id),
  type         text not null,      -- e.g. 'customer.subscription.updated'
  payload      jsonb,              -- full event payload from Stripe
  processed_at timestamptz default now()
);


-- ----------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ----------------------------------------------------------------
create index if not exists idx_subscribers_email
  on subscribers(email);

create index if not exists idx_subscribers_site
  on subscribers(site_id);

create index if not exists idx_subscribers_stripe_customer
  on subscribers(stripe_customer_id);

create index if not exists idx_usage_lookup
  on usage(site_id, period);

create index if not exists idx_stripe_events_type
  on stripe_events(type);


-- ----------------------------------------------------------------
-- AUTO-UPDATE updated_at TIMESTAMPS
-- ----------------------------------------------------------------
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger subscribers_updated_at
  before update on subscribers
  for each row execute function update_updated_at();

create trigger usage_updated_at
  before update on usage
  for each row execute function update_updated_at();


-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- All tables are server-side only (accessed via service role key).
-- The sites table allows public reads so the frontend can list
-- available tools if needed.
-- ----------------------------------------------------------------
alter table sites        enable row level security;
alter table subscribers  enable row level security;
alter table usage        enable row level security;
alter table stripe_events enable row level security;

-- Sites are publicly readable (no sensitive data)
create policy "Public can read active sites"
  on sites for select
  using (active = true);

-- All other tables: server-side only via service role key
-- No additional policies needed — service role bypasses RLS


-- ================================================================
-- SETUP COMPLETE
-- Tables created: sites, subscribers, usage, stripe_events
-- Next step: add your Supabase URL and service role key
-- to your Vercel environment variables.
-- ================================================================
