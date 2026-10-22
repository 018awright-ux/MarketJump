-- ═══════════════════════════════════════════════════════════════
-- MarketJump — AI Consultant: plans + usage metering
-- Safe to re-run. Paste into the Supabase SQL editor.
--
-- Users can READ their own rows but never write them: only the server
-- (service-role key) records usage and sets plans, so nobody can reset
-- their own allowance or grant themselves Pro.
-- ═══════════════════════════════════════════════════════════════

-- ── Subscriptions (one row per paying user; no row = free) ──
create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname='Users can view own subscription' and tablename='subscriptions') then
    create policy "Users can view own subscription" on public.subscriptions for select using (auth.uid() = user_id);
  end if;
end $$;

-- ── AI usage (one row per question asked) ──
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer
);

create index if not exists ai_usage_user_created_idx on public.ai_usage(user_id, created_at desc);

alter table public.ai_usage enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname='Users can view own AI usage' and tablename='ai_usage') then
    create policy "Users can view own AI usage" on public.ai_usage for select using (auth.uid() = user_id);
  end if;
end $$;
