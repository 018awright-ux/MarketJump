-- MarketJump Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS (extends Supabase auth.users)
create table public.profiles (
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

-- PREDICTIONS
create table public.predictions (
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

-- JUMP CARDS
create table public.jump_cards (
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

-- WATCHLIST
create table public.watchlist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  added_at timestamptz not null default now(),
  user_prediction_id uuid references public.predictions(id) on delete set null,
  unique(user_id, ticker)
);

-- POSTS
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  content text not null,
  card_type text not null default 'stock' check (card_type in ('stock', 'social', 'macro')),
  bull_votes integer not null default 0,
  bear_votes integer not null default 0,
  created_at timestamptz not null default now()
);

-- PROFILE VOTES
create table public.profile_votes (
  id uuid primary key default uuid_generate_v4(),
  voter_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  vote text not null check (vote in ('bullish', 'bearish')),
  created_at timestamptz not null default now(),
  unique(voter_id, target_id)
);

-- FOLLOWS
create table public.follows (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id)
);

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.predictions enable row level security;
alter table public.watchlist enable row level security;
alter table public.posts enable row level security;
alter table public.profile_votes enable row level security;
alter table public.follows enable row level security;
alter table public.jump_cards enable row level security;

-- Profiles: public read, own write
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Predictions: public read, own write
create policy "Predictions are viewable by everyone" on public.predictions for select using (true);
create policy "Users can insert own predictions" on public.predictions for insert with check (auth.uid() = user_id);
create policy "Users can update own predictions" on public.predictions for update using (auth.uid() = user_id);

-- Watchlist: own read/write
create policy "Users can manage own watchlist" on public.watchlist for all using (auth.uid() = user_id);

-- Posts: public read, own write
create policy "Posts are viewable by everyone" on public.posts for select using (true);
create policy "Users can insert own posts" on public.posts for insert with check (auth.uid() = user_id);

-- Profile votes: public read, own write
create policy "Profile votes viewable by everyone" on public.profile_votes for select using (true);
create policy "Users can manage own votes" on public.profile_votes for all using (auth.uid() = voter_id);

-- Follows: public read, own write
create policy "Follows viewable by everyone" on public.follows for select using (true);
create policy "Users can manage own follows" on public.follows for all using (auth.uid() = follower_id);

-- Jump cards: public read
create policy "Jump cards are viewable by everyone" on public.jump_cards for select using (true);
create policy "Service role can manage jump cards" on public.jump_cards for all using (true);

-- FUNCTION: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SEED MOCK CARDS
insert into public.jump_cards (ticker, company_name, headline, summary, source, source_name, bull_percent, bear_percent, card_type, price, change_percent) values
('AAPL', 'Apple Inc.', 'Apple Vision Pro demand surges after enterprise partnerships announced', 'Apple reported a 340% quarter-over-quarter increase in Vision Pro orders following deals with Fortune 500 enterprises. Analysts are revising price targets upward on spatial computing momentum.', 'news', 'Bloomberg', 68, 32, 'stock', 213.49, 2.14),
('NVDA', 'NVIDIA Corporation', 'NVIDIA Blackwell GPU backlog extends to 18 months amid AI infrastructure buildout', 'Hyperscalers are locked in an arms race for compute. NVDA Blackwell architecture is the only game in town for frontier AI training runs. Supply constraints keeping margins elevated.', 'news', 'Reuters', 74, 26, 'stock', 875.43, 3.67),
('TSLA', 'Tesla Inc.', 'Tesla FSD v13 achieves 99.2% intervention-free miles in California trials', 'Tesla Full Self-Driving software hit a new milestone in regulatory testing. Robotaxi launch timeline moved up to Q3. Bears pointing to ongoing margin compression in core EV business.', 'news', 'TechCrunch', 52, 48, 'stock', 248.73, -1.23),
('AMZN', 'Amazon.com Inc.', 'AWS revenue accelerates to 21% YoY growth as enterprise AI adoption spikes', 'Amazon Web Services posted its fastest growth in two years. Bedrock AI platform seeing 10x customer adoption. Retail operating margins hit all-time highs as logistics automation matures.', 'news', 'WSJ', 71, 29, 'stock', 198.12, 1.87),
('NVDA', 'NVIDIA Corporation', 'r/wallstreetbets: NVDA $1200 by end of year or I eat my GPU', 'DD: Every single AI company is buying Blackwell. Microsoft, Google, Meta, Amazon — they''re ALL in. The only question is how many zeros you want on your calls. Blackwell backlog = guaranteed revenue.', 'reddit', 'u/DeepValueHunter99', 81, 19, 'social', 875.43, 3.67),
('TSLA', 'Tesla Inc.', 'StockTwits: TSLA is a robotics company now, stop valuing it like a car company', 'The market is still pricing TSLA like a 2-3% margin auto manufacturer. Optimus humanoid robot is entering mass production. FSD is miles ahead of competition. EV is the floor, not the ceiling.', 'stocktwits', '@TeslaMaximalist', 59, 41, 'social', 248.73, -1.23),
('AAPL', 'Apple Inc.', 'r/stocks: Apple Services is the most underrated moat in the S&P 500', 'People keep obsessing over iPhone units. The real story is $100B+ annual services revenue growing 15% YoY at 75% gross margins. App Store, iCloud, Apple Pay — every product funnels into recurring revenue.', 'reddit', 'u/CompounderKing', 65, 35, 'social', 213.49, 2.14),
('SPY', null, 'Fed holds rates at 4.25-4.50%, signals two cuts in 2025 — Powell: "Watching inflation data carefully"', 'The Federal Reserve held rates steady at their May meeting and maintained their dot plot of two 25bp cuts in 2025. Powell emphasized data dependency and pushed back on emergency cut expectations.', 'news', 'Federal Reserve', 61, 39, 'macro', null, null),
('OIL', null, 'OPEC+ extends production cuts through Q3, Brent crude spikes 4% to $89/bbl', 'Saudi Arabia and Russia agreed to extend voluntary production cuts of 2.2M barrels/day through September. Energy sector catching a bid. Higher oil prices weigh on consumer discretionary.', 'news', 'Reuters', 44, 56, 'macro', null, null),
('GEO', null, 'US-China trade tensions escalate: 60% tariffs on EVs and semiconductors proposed', 'New trade legislation proposes sweeping tariffs on Chinese imports across EV, semiconductor, and solar sectors. US chip makers benefit, consumer electronics face headwinds.', 'news', 'Reuters', 38, 62, 'macro', null, null);
