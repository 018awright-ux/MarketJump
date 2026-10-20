-- ═══════════════════════════════════════════════════════════════
-- MarketJump — Creator social layer (follows)
-- Safe to re-run. Paste into the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

-- ── Follows table (already exists in combined schema; ensure shape) ──
create table if not exists public.follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(follower_id, following_id)
);

alter table public.follows enable row level security;

-- Clear any self-follows first or the constraint below fails to apply
delete from public.follows where follower_id = following_id;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'follows_no_self_follow') then
    alter table public.follows add constraint follows_no_self_follow check (follower_id <> following_id);
  end if;
end $$;

-- "Who follows X" lookups (followers page); the unique constraint already covers follower_id lookups
create index if not exists follows_following_id_idx on public.follows(following_id);
-- Following feed: newest posts from a set of authors
create index if not exists posts_user_id_created_at_idx on public.posts(user_id, created_at desc);

do $$ begin
  if not exists (select 1 from pg_policies where policyname='Follows viewable by everyone' and tablename='follows') then
    create policy "Follows viewable by everyone" on public.follows for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own follows' and tablename='follows') then
    create policy "Users can manage own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
  end if;
end $$;

-- ── Keep profiles.followers / profiles.following in sync ──
-- Runs as definer: RLS only lets users update their OWN profile row,
-- so the client can't bump the followed user's count itself.
create or replace function public.handle_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers = followers + 1 where id = new.following_id;
    update public.profiles set following = following + 1 where id = new.follower_id;
    -- "New Audience member" notification for the followed user
    begin
      insert into public.notifications (user_id, type, title, href)
      select new.following_id, 'follow',
             coalesce(p.brand_name, p.username) || ' joined your Audience',
             '/profile/' || new.follower_id
      from public.profiles p where p.id = new.follower_id;
    exception when others then
      null; -- never let a notification problem block the follow itself
    end;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set followers = greatest(followers - 1, 0) where id = old.following_id;
    update public.profiles set following = greatest(following - 1, 0) where id = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_follow_change on public.follows;
create trigger on_follow_change
  after insert or delete on public.follows
  for each row execute function public.handle_follow_change();

-- ── Backfill counts from the follows table ──
update public.profiles p set
  followers = (select count(*) from public.follows f where f.following_id = p.id),
  following = (select count(*) from public.follows f where f.follower_id = p.id);
