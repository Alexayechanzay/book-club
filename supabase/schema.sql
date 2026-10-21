-- Books & Friends — run once in Supabase SQL Editor
-- Enables Auth-backed profiles, sessions, progress, discussion, goals

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  streak_count integer not null default 0,
  last_activity_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  author text not null,
  visibility text not null check (visibility in ('public', 'private')),
  invite_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions (id) on delete cascade,
  position integer not null,
  title text not null,
  unique (session_id, position)
);

create table if not exists public.session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table if not exists public.chapter_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, chapter_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create table if not exists public.reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  period text not null default 'weekly' check (period = 'weekly'),
  target_chapters integer not null check (target_chapters > 0),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sessions_visibility on public.reading_sessions (visibility, created_at desc);
create index if not exists idx_chapters_session on public.chapters (session_id, position);
create index if not exists idx_members_user on public.session_members (user_id);
create index if not exists idx_members_session on public.session_members (session_id);
create index if not exists idx_progress_session on public.chapter_progress (session_id, user_id);
create index if not exists idx_comments_session on public.comments (session_id, created_at);
create index if not exists idx_comments_chapter on public.comments (chapter_id, created_at);
create index if not exists idx_comments_parent on public.comments (parent_id, created_at);
create index if not exists idx_reactions_comment on public.reactions (comment_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_session_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_members
    where session_id = p_session_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_session_host(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reading_sessions
    where id = p_session_id and host_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Reader')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.join_session_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into sid
  from public.reading_sessions
  where invite_code = upper(trim(code))
  limit 1;

  if sid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.session_members (session_id, user_id)
  values (sid, auth.uid())
  on conflict (session_id, user_id) do nothing;

  return sid;
end;
$$;

create or replace function public.touch_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
  last_day date;
  current_streak integer;
begin
  select last_activity_date, streak_count
  into last_day, current_streak
  from public.profiles
  where id = new.user_id
  for update;

  if last_day is null or last_day < today - 1 then
    current_streak := 1;
  elsif last_day = today - 1 then
    current_streak := current_streak + 1;
  end if;
  -- same day: keep streak

  update public.profiles
  set
    last_activity_date = today,
    streak_count = case when last_day = today then streak_count else current_streak end
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists on_progress_streak on public.chapter_progress;
create trigger on_progress_streak
  after insert on public.chapter_progress
  for each row execute function public.touch_streak();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.chapters enable row level security;
alter table public.session_members enable row level security;
alter table public.chapter_progress enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.reading_goals enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- reading_sessions
drop policy if exists "sessions_select" on public.reading_sessions;
create policy "sessions_select" on public.reading_sessions
  for select to authenticated
  using (
    visibility = 'public'
    or host_id = auth.uid()
    or public.is_session_member(id)
  );

drop policy if exists "sessions_insert" on public.reading_sessions;
create policy "sessions_insert" on public.reading_sessions
  for insert to authenticated
  with check (host_id = auth.uid());

drop policy if exists "sessions_update_host" on public.reading_sessions;
create policy "sessions_update_host" on public.reading_sessions
  for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

-- chapters
drop policy if exists "chapters_select" on public.chapters;
create policy "chapters_select" on public.chapters
  for select to authenticated
  using (
    exists (
      select 1 from public.reading_sessions s
      where s.id = session_id
        and (
          s.visibility = 'public'
          or s.host_id = auth.uid()
          or public.is_session_member(s.id)
        )
    )
  );

drop policy if exists "chapters_insert_host" on public.chapters;
create policy "chapters_insert_host" on public.chapters
  for insert to authenticated
  with check (
    exists (
      select 1 from public.reading_sessions s
      where s.id = session_id and s.host_id = auth.uid()
    )
  );

-- session_members
drop policy if exists "members_select" on public.session_members;
create policy "members_select" on public.session_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_session_member(session_id)
    or exists (
      select 1 from public.reading_sessions s
      where s.id = session_id and (s.visibility = 'public' or s.host_id = auth.uid())
    )
  );

drop policy if exists "members_insert" on public.session_members;
create policy "members_insert" on public.session_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reading_sessions s
      where s.id = session_id
        and (s.visibility = 'public' or s.host_id = auth.uid())
    )
  );

drop policy if exists "members_delete_own" on public.session_members;
create policy "members_delete_own" on public.session_members
  for delete to authenticated
  using (user_id = auth.uid());

-- chapter_progress
drop policy if exists "progress_select" on public.chapter_progress;
create policy "progress_select" on public.chapter_progress
  for select to authenticated
  using (public.is_session_member(session_id));

drop policy if exists "progress_insert_own" on public.chapter_progress;
create policy "progress_insert_own" on public.chapter_progress
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_session_member(session_id));

drop policy if exists "progress_delete_own" on public.chapter_progress;
create policy "progress_delete_own" on public.chapter_progress
  for delete to authenticated
  using (user_id = auth.uid());

-- comments
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
  for select to authenticated
  using (public.is_session_member(session_id));

create or replace function public.comment_parent_ok(
  p_parent_id uuid,
  p_session_id uuid,
  p_chapter_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_parent_id is null
    or exists (
      select 1
      from public.comments p
      where p.id = p_parent_id
        and p.session_id = p_session_id
        and p.chapter_id = p_chapter_id
    );
$$;

grant execute on function public.comment_parent_ok(uuid, uuid, uuid) to authenticated;

drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_session_member(session_id)
    and exists (
      select 1
      from public.chapters ch
      where ch.id = chapter_id
        and ch.session_id = session_id
    )
    and public.comment_parent_ok(parent_id, session_id, chapter_id)
  );

drop policy if exists "comments_update_own" on public.comments;
drop policy if exists "comments_update_author_or_host" on public.comments;
create policy "comments_update_author_or_host" on public.comments
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_session_host(session_id)
  )
  with check (
    user_id = auth.uid()
    or public.is_session_host(session_id)
  );

drop policy if exists "comments_delete_own" on public.comments;
drop policy if exists "comments_delete_author_or_host" on public.comments;
create policy "comments_delete_author_or_host" on public.comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_session_host(session_id)
  );

-- reactions
drop policy if exists "reactions_select" on public.reactions;
create policy "reactions_select" on public.reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = comment_id and public.is_session_member(c.session_id)
    )
  );

drop policy if exists "reactions_insert" on public.reactions;
create policy "reactions_insert" on public.reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.comments c
      where c.id = comment_id and public.is_session_member(c.session_id)
    )
  );

drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own" on public.reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- reading_goals
drop policy if exists "goals_select_own" on public.reading_goals;
create policy "goals_select_own" on public.reading_goals
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "goals_upsert_own" on public.reading_goals;
create policy "goals_insert_own" on public.reading_goals
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "goals_update_own" on public.reading_goals;
create policy "goals_update_own" on public.reading_goals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant execute on function public.join_session_by_code(text) to authenticated;
grant execute on function public.is_session_member(uuid) to authenticated;
grant execute on function public.is_session_host(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: avatars
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
