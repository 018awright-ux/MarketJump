-- Brand profile fields
alter table public.profiles
  add column if not exists brand_name text unique,
  add column if not exists brand_tagline text,
  add column if not exists brand_avatar_url text,
  add column if not exists brand_logo_url text,
  add column if not exists agreed_count integer not null default 0,
  add column if not exists disagreed_count integer not null default 0;

-- Agreed votes table (weighted by voter brand score)
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

do $$ begin
  if not exists (select 1 from pg_policies where policyname='Brand votes viewable by everyone' and tablename='brand_votes') then
    create policy "Brand votes viewable by everyone" on public.brand_votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Users can manage own brand votes' and tablename='brand_votes') then
    create policy "Users can manage own brand votes" on public.brand_votes for all using (auth.uid() = voter_id);
  end if;
end $$;

-- Brand avatars storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-avatars', 'brand-avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

do $stor2$ begin
  if not exists (select 1 from pg_policies where policyname='Brand avatars public read' and tablename='objects') then
    create policy "Brand avatars public read" on storage.objects for select using (bucket_id='brand-avatars');
  end if;
  if not exists (select 1 from pg_policies where policyname='Users can upload brand avatars' and tablename='objects') then
    create policy "Users can upload brand avatars" on storage.objects for insert with check (bucket_id='brand-avatars' and auth.uid()::text=(storage.foldername(name))[1]);
  end if;
end $stor2$;
