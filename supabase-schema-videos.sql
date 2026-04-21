-- Run this in Supabase SQL Editor to add video post support

-- Posts table (enhanced)
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

-- Post videos — multiple clips per post (slideshow)
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

-- Post votes
create table if not exists public.post_votes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  vote text not null check (vote in ('bullish', 'bearish')),
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

-- RLS
alter table public.posts enable row level security;
alter table public.post_videos enable row level security;
alter table public.post_votes enable row level security;

create policy "Posts viewable by everyone" on public.posts for select using (true);
create policy "Users can insert own posts" on public.posts for insert with check (auth.uid() = user_id);
create policy "Users can update own posts" on public.posts for update using (auth.uid() = user_id);
create policy "Users can delete own posts" on public.posts for delete using (auth.uid() = user_id);

create policy "Post videos viewable by everyone" on public.post_videos for select using (true);
create policy "Users can insert own post videos" on public.post_videos for insert with check (auth.uid() = user_id);
create policy "Users can delete own post videos" on public.post_videos for delete using (auth.uid() = user_id);

create policy "Post votes viewable by everyone" on public.post_votes for select using (true);
create policy "Users can manage own post votes" on public.post_votes for all using (auth.uid() = user_id);

-- Storage bucket for videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-videos',
  'post-videos',
  true,
  524288000, -- 500MB limit per file
  array['video/mp4', 'video/mov', 'video/quicktime', 'video/webm', 'video/mpeg']
)
on conflict (id) do nothing;

-- Storage policy — public read
create policy "Videos are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'post-videos');

create policy "Users can upload their own videos"
  on storage.objects for insert
  with check (bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own videos"
  on storage.objects for delete
  using (bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]);
