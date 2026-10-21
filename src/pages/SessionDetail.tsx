import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ChapterDiscussion, type CommentRow } from '../components/ChapterDiscussion'
import { ProgressBar } from '../components/ProgressBar'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'
import { supabase } from '../lib/supabase'
import type { Chapter, Profile, Reaction, ReadingSession } from '../lib/types'

type MemberRow = {
  user_id: string
  profiles: Pick<Profile, 'display_name' | 'avatar_url'> | null
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, refreshProfile } = useAuth()
  const { t } = useLocale()
  const [session, setSession] = useState<ReadingSession | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [memberProgress, setMemberProgress] = useState<
    { userId: string; name: string; avatarUrl: string | null; done: number }[]
  >([])
  const [isMember, setIsMember] = useState(false)
  const [tab, setTab] = useState<'progress' | 'discussion'>('progress')
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  /** Live DB missing parent_id / deleted_at until migration 002 is applied */
  const [needsThreadMigration, setNeedsThreadMigration] = useState(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id || !user) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: sess, error: sErr } = await supabase.from('reading_sessions').select('*').eq('id', id).maybeSingle()
      if (sErr) throw sErr
      if (!sess) {
        setError(t('session.notFound'))
        setSession(null)
        return
      }
      setSession(sess as ReadingSession)

      const { data: ch } = await supabase
        .from('chapters')
        .select('*')
        .eq('session_id', id)
        .order('position', { ascending: true })
      const chapterRows = (ch ?? []) as Chapter[]
      setChapters(chapterRows)
      setSelectedChapterId((prev) => {
        if (prev && chapterRows.some((c) => c.id === prev)) return prev
        return chapterRows[0]?.id ?? null
      })

      const { data: membership } = await supabase
        .from('session_members')
        .select('id')
        .eq('session_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      setIsMember(Boolean(membership))

      if (membership) {
        const { data: prog } = await supabase
          .from('chapter_progress')
          .select('chapter_id, user_id')
          .eq('session_id', id)

        const mine = new Set((prog ?? []).filter((p) => p.user_id === user.id).map((p) => p.chapter_id))
        setCompletedIds(mine)

        const { data: members } = await supabase
          .from('session_members')
          .select('user_id, profiles(display_name, avatar_url)')
          .eq('session_id', id)

        const totalByUser = new Map<string, number>()
        for (const p of prog ?? []) {
          totalByUser.set(p.user_id, (totalByUser.get(p.user_id) ?? 0) + 1)
        }

        setMemberProgress(
          ((members ?? []) as unknown as MemberRow[]).map((m) => ({
            userId: m.user_id,
            name: m.profiles?.display_name ?? t('common.reader'),
            avatarUrl: m.profiles?.avatar_url ?? null,
            done: totalByUser.get(m.user_id) ?? 0,
          })),
        )

        const { error: threadProbeErr } = await supabase
          .from('comments')
          .select('parent_id')
          .eq('session_id', id)
          .limit(1)
        setNeedsThreadMigration(
          Boolean(
            threadProbeErr &&
              (threadProbeErr.code === 'PGRST204' || threadProbeErr.message.includes('parent_id')),
          ),
        )

        const { data: commentRows, error: commentErr } = await supabase
          .from('comments')
          .select('*, profiles(display_name, avatar_url)')
          .eq('session_id', id)
          .order('created_at', { ascending: true })
        if (commentErr) throw commentErr
        setComments(
          ((commentRows ?? []) as unknown as CommentRow[]).map((c) => ({
            ...c,
            parent_id: c.parent_id ?? null,
            deleted_at: c.deleted_at ?? null,
          })),
        )
        const commentIds = (commentRows ?? []).map((c) => c.id)
        if (commentIds.length) {
          const { data: rx } = await supabase.from('reactions').select('*').in('comment_id', commentIds)
          setReactions((rx ?? []) as Reaction[])
        } else {
          setReactions([])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('session.loadError'))
    } finally {
      setLoading(false)
    }
  }, [id, t, user])

  useEffect(() => {
    void load()
  }, [load])

  const myDone = completedIds.size
  const totalChapters = chapters.length

  const commentCountByChapter = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of comments) {
      if (c.deleted_at) continue
      map.set(c.chapter_id, (map.get(c.chapter_id) ?? 0) + 1)
    }
    return map
  }, [comments])

  const isHost = Boolean(user && session && session.host_id === user.id)

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null
  const chapterComments = useMemo(
    () => (selectedChapterId ? comments.filter((c) => c.chapter_id === selectedChapterId) : []),
    [comments, selectedChapterId],
  )
  const chapterCommentIds = useMemo(() => new Set(chapterComments.map((c) => c.id)), [chapterComments])
  const chapterReactions = useMemo(
    () => reactions.filter((r) => chapterCommentIds.has(r.comment_id)),
    [reactions, chapterCommentIds],
  )

  function openChapterDiscussion(chapterId: string) {
    setSelectedChapterId(chapterId)
    setTab('discussion')
  }

  async function joinPublic() {
    if (!user || !session) return
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('session_members').insert({
        session_id: session.id,
        user_id: user.id,
      })
      if (err) throw err
      await load({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('session.joinError'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleChapter(chapterId: string) {
    if (!user || !session || !isMember) return
    const done = completedIds.has(chapterId)
    setBusy(true)
    try {
      if (done) {
        const { error: err } = await supabase
          .from('chapter_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('chapter_id', chapterId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('chapter_progress').insert({
          session_id: session.id,
          user_id: user.id,
          chapter_id: chapterId,
        })
        if (err) throw err
        await refreshProfile()
      }
      await load({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('session.progressError'))
    } finally {
      setBusy(false)
    }
  }

  async function postComment(body: string, parentId: string | null) {
    if (!user || !session || !selectedChapterId) {
      throw new Error(t('session.postFirst'))
    }
    if (parentId && needsThreadMigration) {
      const msg = t('session.replyMigration')
      setError(msg)
      throw new Error(msg)
    }
    setBusy(true)
    setError(null)
    const payload: {
      session_id: string
      chapter_id: string
      user_id: string
      body: string
      parent_id?: string | null
    } = {
      session_id: session.id,
      chapter_id: selectedChapterId,
      user_id: user.id,
      body,
      parent_id: parentId,
    }
    try {
      // Return the row so we can show replies immediately; avoid maybeSingle (fails when RLS hides RETURNING)
      const { data, error: err } = await supabase
        .from('comments')
        .insert(payload)
        .select('id, session_id, chapter_id, parent_id, user_id, body, created_at, updated_at, deleted_at, profiles(display_name, avatar_url)')
        .single()
      if (err) {
        if (err.code === 'PGRST204' && err.message.includes('parent_id')) {
          setNeedsThreadMigration(true)
          throw new Error(t('session.missingParent'))
        }
        if (err.message.toLowerCase().includes('row-level security')) {
          throw new Error(t('session.replyBlocked'))
        }
        throw err
      }
      if (data) {
        const row = data as unknown as CommentRow
        setComments((prev) => [
          ...prev,
          {
            ...row,
            parent_id: row.parent_id ?? parentId,
            deleted_at: row.deleted_at ?? null,
            profiles: row.profiles ?? null,
          },
        ])
      }
      await load({ silent: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('session.postError')
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setBusy(false)
    }
  }

  async function editComment(commentId: string, body: string) {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      let q = supabase
        .from('comments')
        .update({ body, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', user.id)
      if (!needsThreadMigration) q = q.is('deleted_at', null)
      const { error: err } = await q
      if (err) throw err
      await load({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('session.editError'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteComment(commentId: string) {
    if (!user || !session) return
    setBusy(true)
    setError(null)
    try {
      if (needsThreadMigration) {
        const { error: err } = await supabase.from('comments').delete().eq('id', commentId)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('comments')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', commentId)
        if (err) throw err
      }
      await load({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('session.deleteError'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleReaction(commentId: string, emoji: string) {
    if (!user) return
    const existing = reactions.find((r) => r.comment_id === commentId && r.user_id === user.id && r.emoji === emoji)
    try {
      if (existing) {
        await supabase.from('reactions').delete().eq('id', existing.id)
      } else {
        await supabase.from('reactions').insert({ comment_id: commentId, user_id: user.id, emoji })
      }
      await load({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('session.reactError'))
    }
  }

  function copyCode() {
    if (!session?.invite_code) return
    void navigator.clipboard.writeText(session.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <p className="muted page-enter">{t('session.loading')}</p>
  if (!session) {
    return (
      <div className="stack page-enter">
        <p className="error">{error ?? t('session.unavailable')}</p>
        <Link to="/home" className="btn btn-ghost dark">
          {t('session.backHome')}
        </Link>
      </div>
    )
  }

  const visibilityLabel = t(session.visibility === 'private' ? 'visibility.private' : 'visibility.public')

  return (
    <div className="stack page-enter">
      <div>
        <p className="eyebrow">{t('session.kind', { visibility: visibilityLabel })}</p>
        <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.3rem)', marginTop: '0.25rem' }}>{session.title}</h1>
        <p className="muted" style={{ marginTop: '0.35rem' }}>
          {t('common.byAuthor', { author: session.author })}
        </p>
      </div>

      {session.invite_code && (
        <div className="panel row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              {t('session.inviteCode')}
            </p>
            <p style={{ fontWeight: 800, letterSpacing: '0.12em' }}>{session.invite_code}</p>
          </div>
          <button type="button" className="btn btn-ghost dark" onClick={copyCode}>
            {copied ? t('session.copied') : t('session.copy')}
          </button>
        </div>
      )}

      {!isMember && session.visibility === 'public' && (
        <div className="panel stack">
          <p className="muted">{t('session.joinPrompt')}</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void joinPublic()}>
            {t('session.join')}
          </button>
        </div>
      )}

      {!isMember && session.visibility === 'private' && (
        <div className="panel">
          <p className="muted">
            {t('session.privatePrompt')} <Link to="/join">{t('session.enterCode')}</Link>
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {needsThreadMigration && (
        <div className="panel" role="status">
          <p>
            {t('session.migrationBanner')}{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
              {t('session.sqlEditor')}
            </a>
          </p>
        </div>
      )}

      {isMember && (
        <>
          <ProgressBar completed={myDone} total={totalChapters} label={t('session.yourProgress')} />

          <div className="tabs">
            <button type="button" className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
              {t('session.chaptersTab')}
            </button>
            <button
              type="button"
              className={tab === 'discussion' ? 'active' : ''}
              onClick={() => setTab('discussion')}
            >
              {t('session.discussionTab')}
            </button>
          </div>

          {tab === 'progress' && (
            <div className="grid-2">
              <div className="panel stack">
                <h2 style={{ fontSize: '1.1rem' }}>{t('session.chapters')}</h2>
                <ul className="chapter-list">
                  {chapters.map((ch) => {
                    const done = completedIds.has(ch.id)
                    const count = commentCountByChapter.get(ch.id) ?? 0
                    return (
                      <li key={ch.id} className="chapter-row">
                        <label className={`chapter-item ${done ? 'done' : ''}`}>
                          <input
                            type="checkbox"
                            checked={done}
                            disabled={busy}
                            onChange={() => void toggleChapter(ch.id)}
                          />
                          <span className="chapter-item-text">
                            <strong style={{ fontWeight: 600 }}>{ch.position}.</strong> {ch.title}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost dark chapter-discuss-btn"
                          onClick={() => openChapterDiscussion(ch.id)}
                        >
                          {count > 0 ? t('session.discussCount', { count }) : t('session.discuss')}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="panel stack">
                <h2 style={{ fontSize: '1.1rem' }}>{t('session.members')}</h2>
                <div className="member-progress">
                  {memberProgress.map((m) => (
                    <div key={m.userId}>
                      <div className="row" style={{ marginBottom: '0.35rem' }}>
                        <Avatar name={m.name} url={m.avatarUrl} />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                      </div>
                      <ProgressBar completed={m.done} total={totalChapters} label=" " />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'discussion' && (
            <div className="stack">
              <div className="panel stack">
                <div>
                  <h2 style={{ fontSize: '1.1rem' }}>{t('session.pickChapter')}</h2>
                  <p className="muted" style={{ marginTop: '0.3rem', fontSize: '0.9rem' }}>
                    {t('session.pickLead')}
                  </p>
                </div>
                <div className="chapter-chips" role="listbox" aria-label={t('session.chapterList')}>
                  {chapters.map((ch) => {
                    const count = commentCountByChapter.get(ch.id) ?? 0
                    const active = ch.id === selectedChapterId
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`chapter-chip ${active ? 'active' : ''}`}
                        onClick={() => setSelectedChapterId(ch.id)}
                      >
                        <span>
                          {ch.position}. {ch.title}
                        </span>
                        {count > 0 && <span className="chip-count">{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedChapter ? (
                <ChapterDiscussion
                  chapterLabel={`${selectedChapter.position}. ${selectedChapter.title}`}
                  comments={chapterComments}
                  reactions={chapterReactions}
                  currentUserId={user!.id}
                  isHost={isHost}
                  busy={busy}
                  branchingEnabled={!needsThreadMigration}
                  onPost={postComment}
                  onEdit={editComment}
                  onDelete={deleteComment}
                  onToggleReaction={toggleReaction}
                />
              ) : (
                <div className="panel empty">
                  <p>{t('session.noChapters')}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
