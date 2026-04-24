-- Comments table — supports posts, jump_cards, and external news articles
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  post_id     uuid references public.posts(id) on delete cascade,
  card_id     uuid references public.jump_cards(id) on delete cascade,
  article_url text,                          -- for external news articles
  body        text not null check (char_length(body) between 1 and 300),
  created_at  timestamptz default now() not null,
  -- at least one target must be set
  constraint comments_has_target check (
    post_id is not null or card_id is not null or article_url is not null
  )
);

-- Indexes for fast lookups
create index if not exists comments_post_id_idx     on public.comments(post_id);
create index if not exists comments_card_id_idx     on public.comments(card_id);
create index if not exists comments_article_url_idx on public.comments(article_url);
create index if not exists comments_created_at_idx  on public.comments(created_at);

-- RLS
alter table public.comments enable row level security;

create policy "Anyone can read comments"
  on public.comments for select using (true);

create policy "Authenticated users can post comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.comments for delete
  using (auth.uid() = user_id);
