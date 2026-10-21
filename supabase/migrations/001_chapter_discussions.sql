-- Run this in Supabase SQL Editor if you already applied schema.sql
-- Makes discussion + reactions chapter-scoped

alter table public.comments
  add column if not exists chapter_id uuid references public.chapters (id) on delete cascade;

-- Attach any legacy session-only comments to the first chapter of that session
update public.comments c
set chapter_id = sub.first_chapter_id
from (
  select ch.session_id, ch.id as first_chapter_id
  from public.chapters ch
  inner join (
    select session_id, min(position) as min_pos
    from public.chapters
    group by session_id
  ) m on m.session_id = ch.session_id and m.min_pos = ch.position
) sub
where c.chapter_id is null
  and c.session_id = sub.session_id;

-- Drop orphan legacy comments that have no chapters to attach to
delete from public.comments where chapter_id is null;

alter table public.comments
  alter column chapter_id set not null;

create index if not exists idx_comments_chapter on public.comments (chapter_id, created_at);

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
  );
