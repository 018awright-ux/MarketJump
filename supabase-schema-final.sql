-- ============================================================
-- MarketJump — Final schema additions
-- Run this in Supabase SQL Editor → "Run without RLS"
-- Includes: brand columns, brand_votes, user_votes, notifications
-- ============================================================

-- ── Brand profile columns ─────────────────────────────────────
alter table public.profiles
  add column if not exists brand_name text unique,
  add column if not exists brand_tagline text,
  add column if not exists brand_avatar_url text,
  add column if not exists brand_logo_url text,
  add column if not exists agreed_count integer not null default 0,
  add column if not exists disagreed_count integer not null default 0;

-- ── Brand votes table ─────────────────────────────────────────
create table if not exists public.brand_votes (
  id uuid primary key default uuid_generate_v4(),
  voter_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  vote text not null check (vote in ('agreed', 'disagreed')),
  voter_score integer not null default 1000,
  created_at timestamptz not null default now(),
  unique(voter_id, target_id)
);

alter table public.brand_votes enable row level security;

do $bv$ begin
  if not exists (select 1 from pg_policies where policyname='Brand votes viewable by everyone' and tablename='brand_votes') then
    create policy "Brand votes viewable by everyone" on public.brand_votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own brand votes' and tablename='brand_votes') then
    create policy "Users can manage own brand votes" on public.brand_votes for all using (auth.uid() = voter_id);
  end if;
end $bv$;

-- ── User votes table (card-level community sentiment) ─────────
-- Records each user's bull/bear vote on a specific jump card.
-- /api/votes reads these to recalculate bull_percent/bear_percent on the card.
create table if not exists public.user_votes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  card_id uuid references public.jump_cards(id) on delete cascade not null,
  vote text not null check (vote in ('bullish', 'bearish')),
  created_at timestamptz not null default now(),
  unique(user_id, card_id)
);

alter table public.user_votes enable row level security;

do $uv$ begin
  if not exists (select 1 from pg_policies where policyname='User votes viewable by everyone' and tablename='user_votes') then
    create policy "User votes viewable by everyone" on public.user_votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own votes' and tablename='user_votes') then
    create policy "Users can manage own votes" on public.user_votes for all using (auth.uid() = user_id);
  end if;
end $uv$;

-- ── Notifications table ───────────────────────────────────────
-- Written by /api/resolve when predictions resolve.
-- Read by the notifications page (real data over mock).
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null default 'prediction' check (type in ('prediction', 'follow', 'alert', 'market')),
  title text not null,
  body text,
  href text default '/profile',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

do $notif$ begin
  if not exists (select 1 from pg_policies where policyname='Users can view own notifications' and tablename='notifications') then
    create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='Users can update own notifications' and tablename='notifications') then
    create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='Service can insert notifications' and tablename='notifications') then
    create policy "Service can insert notifications" on public.notifications for insert with check (true);
  end if;
end $notif$;

-- ── Brand avatars storage bucket ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-avatars', 'brand-avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

do $stor$ begin
  if not exists (select 1 from pg_policies where policyname='Brand avatars public read' and tablename='objects') then
    create policy "Brand avatars public read" on storage.objects for select using (bucket_id='brand-avatars');
  end if;
  if not exists (select 1 from pg_policies where policyname='Users can upload brand avatars' and tablename='objects') then
    create policy "Users can upload brand avatars" on storage.objects for insert with check (bucket_id='brand-avatars' and auth.uid()::text=(storage.foldername(name))[1]);
  end if;
end $stor$;
