-- Execute no SQL Editor do Supabase antes de habilitar sincronizacao e uploads.
create table if not exists public.playlists (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  source_url text,
  cover_url text,
  cover_style text not null default 'sunset',
  tracks jsonb not null default '[]'::jsonb,
  favorites text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.playlists enable row level security;
grant select, insert, update, delete on table public.playlists to authenticated;
revoke all on table public.playlists from anon;

drop policy if exists "Users can read their playlists" on public.playlists;
drop policy if exists "Users can create their playlists" on public.playlists;
drop policy if exists "Users can update their playlists" on public.playlists;
drop policy if exists "Users can delete their playlists" on public.playlists;

create policy "Users can read their playlists"
  on public.playlists for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their playlists"
  on public.playlists for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their playlists"
  on public.playlists for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their playlists"
  on public.playlists for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-files',
  'music-files',
  false,
  41943040,
  array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/opus', 'audio/x-m4a']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own audio" on storage.objects;
drop policy if exists "Users can upload their own audio" on storage.objects;
drop policy if exists "Users can update their own audio" on storage.objects;
drop policy if exists "Users can delete their own audio" on storage.objects;

create policy "Users can read their own audio"
  on storage.objects for select to authenticated
  using (bucket_id = 'music-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'music-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own audio"
  on storage.objects for update to authenticated
  using (bucket_id = 'music-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'music-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own audio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'music-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
