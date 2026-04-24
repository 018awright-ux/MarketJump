-- MarketJump Full Schema (combined - safe to run multiple times)
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  level text not null default 'rookie' check (level in ('rookie', 'analyst', 'shark')),
  market_score integer not null default 1000,
  accuracy numeric(5,2) not null default 0,
  total_predictions integer not null default 0,
  correct_predictions integer not null default 0,
  followers integer not null default 0,
  following integer not null default 0,
  interests text[] not null default '{}',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  prediction text not null check (prediction in ('bullish', 'bearish')),
  price_at_prediction numeric(12,4) not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolution_date timestamptz not null default (now() + interval '7 days'),
  result text not null default 'pending' check (result in ('correct', 'incorrect', 'pending')),
  price_at_resolution numeric(12,4)
);

create table if not exists public.jump_cards (
  id uuid primary key default uuid_generate_v4(),
  ticker text not null,
  company_name text,
  headline text not null,
  summary text not null,
  source text not null check (source in ('reddit', 'stocktwits', 'news', 'user')),
  source_name text,
  bull_percent integer not null default 50,
  bear_percent integer not null default 50,
  card_type text not null check (card_type in ('stock', 'social', 'macro')),
  price numeric(12,4),
  change_percent numeric(8,4),
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  added_at timestamptz not null default now(),
  user_prediction_id uuid references public.predictions(id) on delete set null,
  unique(user_id, ticker)
);

create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  caption text,
  stance text check (stance in ('bullish', 'bearish', 'neutral')),
  bull_votes integer not null default 0,
  bear_votes integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.post_videos (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  storage_path text not null,
  public_url text not null,
  duration_seconds numeric(6,2),
  clip_order integer not null default 0,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_votes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  vote text not null check (vote in ('bullish', 'bearish')),
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

create table if not exists public.profile_votes (
  id uuid primary key default uuid_generate_v4(),
  voter_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  vote text not null check (vote in ('bullish', 'bearish')),
  created_at timestamptz not null default now(),
  unique(voter_id, target_id)
);

create table if not exists public.follows (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id)
);

alter table public.profiles enable row level security;
alter table public.predictions enable row level security;
alter table public.watchlist enable row level security;
alter table public.posts enable row level security;
alter table public.post_videos enable row level security;
alter table public.post_votes enable row level security;
alter table public.profile_votes enable row level security;
alter table public.follows enable row level security;
alter table public.jump_cards enable row level security;

do $pol$ begin
  if not exists (select 1 from pg_policies where policyname='Profiles are viewable by everyone' and tablename='profiles') then create policy "Profiles are viewable by everyone" on public.profiles for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Users can update own profile' and tablename='profiles') then create policy "Users can update own profile" on public.profiles for update using (auth.uid()=id); end if;
  if not exists (select 1 from pg_policies where policyname='Users can insert own profile' and tablename='profiles') then create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid()=id); end if;
  if not exists (select 1 from pg_policies where policyname='Predictions are viewable by everyone' and tablename='predictions') then create policy "Predictions are viewable by everyone" on public.predictions for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Users can insert own predictions' and tablename='predictions') then create policy "Users can insert own predictions" on public.predictions for insert with check (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Users can update own predictions' and tablename='predictions') then create policy "Users can update own predictions" on public.predictions for update using (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own watchlist' and tablename='watchlist') then create policy "Users can manage own watchlist" on public.watchlist for all using (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Posts viewable by everyone' and tablename='posts') then create policy "Posts viewable by everyone" on public.posts for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Users can insert own posts' and tablename='posts') then create policy "Users can insert own posts" on public.posts for insert with check (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Users can update own posts' and tablename='posts') then create policy "Users can update own posts" on public.posts for update using (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Users can delete own posts' and tablename='posts') then create policy "Users can delete own posts" on public.posts for delete using (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Post videos viewable by everyone' and tablename='post_videos') then create policy "Post videos viewable by everyone" on public.post_videos for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Users can insert own post videos' and tablename='post_videos') then create policy "Users can insert own post videos" on public.post_videos for insert with check (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Users can delete own post videos' and tablename='post_videos') then create policy "Users can delete own post videos" on public.post_videos for delete using (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Post votes viewable by everyone' and tablename='post_votes') then create policy "Post votes viewable by everyone" on public.post_votes for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own post votes' and tablename='post_votes') then create policy "Users can manage own post votes" on public.post_votes for all using (auth.uid()=user_id); end if;
  if not exists (select 1 from pg_policies where policyname='Profile votes viewable by everyone' and tablename='profile_votes') then create policy "Profile votes viewable by everyone" on public.profile_votes for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own votes' and tablename='profile_votes') then create policy "Users can manage own votes" on public.profile_votes for all using (auth.uid()=voter_id); end if;
  if not exists (select 1 from pg_policies where policyname='Follows viewable by everyone' and tablename='follows') then create policy "Follows viewable by everyone" on public.follows for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own follows' and tablename='follows') then create policy "Users can manage own follows" on public.follows for all using (auth.uid()=follower_id); end if;
  if not exists (select 1 from pg_policies where policyname='Jump cards are viewable by everyone' and tablename='jump_cards') then create policy "Jump cards are viewable by everyone" on public.jump_cards for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='Service role can manage jump cards' and tablename='jump_cards') then create policy "Service role can manage jump cards" on public.jump_cards for all using (true); end if;
end $pol$;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-videos','post-videos',true,524288000,array['video/mp4','video/mov','video/quicktime','video/webm','video/mpeg','image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do nothing;

do $stor$ begin
  if not exists (select 1 from pg_policies where policyname='Videos are publicly accessible' and tablename='objects') then create policy "Videos are publicly accessible" on storage.objects for select using (bucket_id='post-videos'); end if;
  if not exists (select 1 from pg_policies where policyname='Users can upload their own videos' and tablename='objects') then create policy "Users can upload their own videos" on storage.objects for insert with check (bucket_id='post-videos' and auth.uid()::text=(storage.foldername(name))[1]); end if;
  if not exists (select 1 from pg_policies where policyname='Users can delete their own videos' and tablename='objects') then create policy "Users can delete their own videos" on storage.objects for delete using (bucket_id='post-videos' and auth.uid()::text=(storage.foldername(name))[1]); end if;
end $stor$;

insert into public.jump_cards (ticker,company_name,headline,summary,source,source_name,bull_percent,bear_percent,card_type,price,change_percent)
select ticker,company_name,headline,summary,source,source_name,bull_percent,bear_percent,card_type,price,change_percent from (values
  ('AAPL','Apple Inc.','Apple Vision Pro demand surges after enterprise partnerships announced','Apple reported a 340% quarter-over-quarter increase in Vision Pro orders following deals with Fortune 500 enterprises. Analysts are revising price targets upward on spatial computing momentum.','news','Bloomberg',68,32,'stock',213.49::numeric,2.14::numeric),
  ('NVDA','NVIDIA Corporation','NVIDIA Blackwell GPU backlog extends to 18 months amid AI infrastructure buildout','Hyperscalers are locked in an arms race for compute. NVDA Blackwell architecture is the only game in town for frontier AI training runs. Supply constraints keeping margins elevated.','news','Reuters',74,26,'stock',875.43::numeric,3.67::numeric),
  ('TSLA','Tesla Inc.','Tesla FSD v13 achieves 99.2% intervention-free miles in California trials','Tesla Full Self-Driving software hit a new milestone in regulatory testing. Robotaxi launch timeline moved up to Q3. Bears pointing to ongoing margin compression in core EV business.','news','TechCrunch',52,48,'stock',248.73::numeric,-1.23::numeric),
  ('AMZN','Amazon.com Inc.','AWS revenue accelerates to 21% YoY growth as enterprise AI adoption spikes','Amazon Web Services posted its fastest growth in two years. Bedrock AI platform seeing 10x customer adoption. Retail operating margins hit all-time highs as logistics automation matures.','news','WSJ',71,29,'stock',198.12::numeric,1.87::numeric),
  ('NVDA','NVIDIA Corporation','r/wallstreetbets: NVDA $1200 by end of year or I eat my GPU','DD: Every single AI company is buying Blackwell. Microsoft, Google, Meta, Amazon all in. Blackwell backlog = guaranteed revenue.','reddit','u/DeepValueHunter99',81,19,'social',875.43::numeric,3.67::numeric),
  ('TSLA','Tesla Inc.','StockTwits: TSLA is a robotics company now, stop valuing it like a car company','The market is still pricing TSLA like a 2-3% margin auto manufacturer. Optimus humanoid robot is entering mass production. FSD is miles ahead of competition.','stocktwits','@TeslaMaximalist',59,41,'social',248.73::numeric,-1.23::numeric),
  ('AAPL','Apple Inc.','r/stocks: Apple Services is the most underrated moat in the S&P 500','People keep obsessing over iPhone units. The real story is $100B+ annual services revenue growing 15% YoY at 75% gross margins. App Store, iCloud, Apple Pay — every product funnels into recurring revenue.','reddit','u/CompounderKing',65,35,'social',213.49::numeric,2.14::numeric),
  ('SPY',null,'Fed holds rates at 4.25-4.50%, signals two cuts in 2025 — Powell: Watching inflation data carefully','The Federal Reserve held rates steady at their May meeting and maintained their dot plot of two 25bp cuts in 2025. Powell emphasized data dependency.','news','Federal Reserve',61,39,'macro',null,null),
  ('OIL',null,'OPEC+ extends production cuts through Q3, Brent crude spikes 4% to $89/bbl','Saudi Arabia and Russia agreed to extend voluntary production cuts of 2.2M barrels/day through September. Energy sector catching a bid.','news','Reuters',44,56,'macro',null,null),
  ('GEO',null,'US-China trade tensions escalate: 60% tariffs on EVs and semiconductors proposed','New trade legislation proposes sweeping tariffs on Chinese imports across EV, semiconductor, and solar sectors. US chip makers benefit, consumer electronics face headwinds.','news','Reuters',38,62,'macro',null,null)
) as v(ticker,company_name,headline,summary,source,source_name,bull_percent,bear_percent,card_type,price,change_percent)
where not exists (select 1 from public.jump_cards limit 1);
