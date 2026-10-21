-- Run in Supabase SQL Editor after 001_chapter_discussions.sql
-- Adds threaded replies (parent_id), soft-delete, host moderation

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

grant execute on function public.is_session_host(uuid) to authenticated;

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

alter table public.comments
  add column if not exists deleted_at timestamptz;

create index if not exists idx_comments_parent on public.comments (parent_id, created_at);

-- Tighten insert: chapter must match session; parent (if any) must be same chapter/session
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
    and (
      parent_id is null
      or exists (
        select 1
        from public.comments p
        where p.id = parent_id
          and p.session_id = session_id
          and p.chapter_id = chapter_id
      )
    )
  );

-- Author can edit own non-deleted comments; author or host can soft-delete (set deleted_at)
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

-- Hard delete: author or host (optional; UI uses soft-delete)
drop policy if exists "comments_delete_own" on public.comments;
drop policy if exists "comments_delete_author_or_host" on public.comments;
create policy "comments_delete_author_or_host" on public.comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_session_host(session_id)
  );
