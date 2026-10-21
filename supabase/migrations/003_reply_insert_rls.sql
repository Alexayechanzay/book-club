-- Fix reply inserts: parent check under RLS can fail when the WITH CHECK
-- subquery on comments is evaluated. Use a security-definer helper instead.

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
