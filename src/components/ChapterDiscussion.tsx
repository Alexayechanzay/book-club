import { useMemo, useState, type FormEvent } from 'react'
import { Avatar } from './Avatar'
import { useLocale } from '../contexts/LocaleContext'
import { REACTION_EMOJIS, type Comment, type Profile, type Reaction } from '../lib/types'
import {
  buildCommentTree,
  formatRelative,
  formatTimestamp,
  type CommentTreeNode,
} from '../lib/utils'

export type CommentRow = Comment & {
  profiles: Pick<Profile, 'display_name' | 'avatar_url'> | null
}

type Props = {
  chapterLabel: string
  comments: CommentRow[]
  reactions: Reaction[]
  currentUserId: string
  isHost: boolean
  busy: boolean
  /** When false, Reply is disabled (DB missing parent_id). */
  branchingEnabled?: boolean
  onPost: (body: string, parentId: string | null) => Promise<void>
  onEdit: (commentId: string, body: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onToggleReaction: (commentId: string, emoji: string) => Promise<void>
}

const MAX_VISUAL_DEPTH = 6

export function ChapterDiscussion({
  chapterLabel,
  comments,
  reactions,
  currentUserId,
  isHost,
  busy,
  branchingEnabled = true,
  onPost,
  onEdit,
  onDelete,
  onToggleReaction,
}: Props) {
  const { t, locale } = useLocale()
  const [body, setBody] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const reactionsByComment = useMemo(() => {
    const map = new Map<string, Reaction[]>()
    for (const r of reactions) {
      const list = map.get(r.comment_id) ?? []
      list.push(r)
      map.set(r.comment_id, list)
    }
    return map
  }, [reactions])

  const tree = useMemo(() => buildCommentTree(comments), [comments])

  async function handleRootSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    try {
      await onPost(body.trim(), null)
      setBody('')
    } catch {
      /* keep draft; parent surfaces error */
    }
  }

  async function handleReplySubmit(e: FormEvent, parentId: string) {
    e.preventDefault()
    if (!replyBody.trim()) return
    try {
      await onPost(replyBody.trim(), parentId)
      setReplyBody('')
      setReplyToId(null)
    } catch {
      /* keep reply open so the user can retry */
    }
  }

  async function handleEditSubmit(e: FormEvent, commentId: string) {
    e.preventDefault()
    if (!editBody.trim()) return
    await onEdit(commentId, editBody.trim())
    setEditingId(null)
    setEditBody('')
  }

  function startEdit(c: CommentRow) {
    setEditingId(c.id)
    setEditBody(c.body)
    setReplyToId(null)
  }

  function startReply(commentId: string) {
    setReplyToId(commentId)
    setReplyBody('')
    setEditingId(null)
  }

  function renderNode(node: CommentTreeNode<CommentRow>, depth: number) {
    const deleted = Boolean(node.deleted_at)
    const isAuthor = node.user_id === currentUserId
    const canEdit = isAuthor && !deleted
    const canDelete = !deleted && (isAuthor || isHost)
    const authorName = node.profiles?.display_name ?? t('common.reader')
    const wasEdited =
      !deleted && new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 2000
    const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH)

    const rx = reactionsByComment.get(node.id) ?? []
    const counts = new Map<string, { count: number; mine: boolean }>()
    for (const r of rx) {
      const cur = counts.get(r.emoji) ?? { count: 0, mine: false }
      cur.count += 1
      if (r.user_id === currentUserId) cur.mine = true
      counts.set(r.emoji, cur)
    }

    return (
      <div
        key={node.id}
        className={`comment-branch ${depth > 0 ? 'nested' : ''}`}
        data-depth={visualDepth}
        style={depth > 0 ? { ['--branch-depth' as string]: visualDepth } : undefined}
      >
        <article className={`comment ${deleted ? 'deleted' : ''}`}>
          <div className="comment-meta">
            <Avatar name={authorName} url={node.profiles?.avatar_url} />
            <strong>{authorName}</strong>
            <time className="comment-time" dateTime={node.created_at} title={formatTimestamp(node.created_at, locale)}>
              <span className="comment-time-abs">{formatTimestamp(node.created_at, locale)}</span>
              <span className="muted comment-time-rel">({formatRelative(node.created_at, t, locale)})</span>
            </time>
            {wasEdited && <span className="muted edited-tag">{t('discussion.edited')}</span>}
            {deleted && !isAuthor && <span className="muted edited-tag">{t('discussion.removed')}</span>}
          </div>

          {editingId === node.id ? (
            <form className="stack" onSubmit={(e) => void handleEditSubmit(e, node.id)}>
              <div className="field">
                <label htmlFor={`edit-${node.id}`}>{t('discussion.editLabel')}</label>
                <textarea
                  id={`edit-${node.id}`}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  maxLength={2000}
                  required
                />
              </div>
              <div className="row">
                <button className="btn btn-primary" type="submit" disabled={busy || !editBody.trim()}>
                  {t('discussion.save')}
                </button>
                <button
                  className="btn btn-ghost dark"
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setEditBody('')
                  }}
                >
                  {t('discussion.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <p className={`comment-body ${deleted ? 'deleted-body' : ''}`}>
              {deleted ? t('discussion.deleted') : node.body}
            </p>
          )}

          {!deleted && editingId !== node.id && (
            <>
              <div className="comment-actions row">
                <button
                  type="button"
                  className="text-btn"
                  disabled={!branchingEnabled}
                  title={branchingEnabled ? t('discussion.replyTitle') : t('discussion.replyDisabled')}
                  onClick={() => startReply(node.id)}
                >
                  {t('discussion.reply')}
                </button>
                {canEdit && (
                  <button type="button" className="text-btn" onClick={() => startEdit(node)}>
                    {t('discussion.edit')}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="text-btn danger"
                    onClick={() => {
                      const label = isAuthor ? t('discussion.confirmDelete') : t('discussion.confirmRemove')
                      if (window.confirm(label)) void onDelete(node.id)
                    }}
                  >
                    {isAuthor ? t('discussion.delete') : t('discussion.remove')}
                  </button>
                )}
              </div>

              <div className="reactions">
                {[...counts.entries()].map(([emoji, info]) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`reaction ${info.mine ? 'active' : ''}`}
                    onClick={() => void onToggleReaction(node.id, emoji)}
                  >
                    {emoji} {info.count}
                  </button>
                ))}
              </div>
              <div className="emoji-picker" style={{ marginTop: '0.45rem' }}>
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="reaction"
                    aria-label={t('discussion.react', { emoji })}
                    onClick={() => void onToggleReaction(node.id, emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}

          {replyToId === node.id && branchingEnabled && (
            <form className="reply-form stack" onSubmit={(e) => void handleReplySubmit(e, node.id)}>
              <p className="reply-context muted">
                {t('discussion.replyingTo', { name: authorName })}
                {depth > 0 ? t('discussion.inBranch') : ''}
              </p>
              <div className="field">
                <label htmlFor={`reply-${node.id}`}>{t('discussion.yourReply')}</label>
                <textarea
                  id={`reply-${node.id}`}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={t('discussion.replyPlaceholder', { name: authorName })}
                  maxLength={2000}
                  required
                  autoFocus
                />
              </div>
              <div className="row">
                <button className="btn btn-sage" type="submit" disabled={busy || !replyBody.trim()}>
                  {t('discussion.postReply')}
                </button>
                <button
                  className="btn btn-ghost dark"
                  type="button"
                  onClick={() => {
                    setReplyToId(null)
                    setReplyBody('')
                  }}
                >
                  {t('discussion.cancel')}
                </button>
              </div>
            </form>
          )}
        </article>

        {node.children.length > 0 && (
          <div className="comment-children" role="group" aria-label={t('discussion.repliesTo', { name: authorName })}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="panel stack">
      <div>
        <p className="eyebrow">{t('discussion.eyebrow')}</p>
        <h2 style={{ fontSize: '1.15rem', marginTop: '0.25rem' }}>{chapterLabel}</h2>
        <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
          {isHost ? t('discussion.introHost') : t('discussion.intro')}
        </p>
        {!branchingEnabled && (
          <p className="error" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {t('discussion.repliesOff')}
          </p>
        )}
      </div>

      <form className="stack" onSubmit={(e) => void handleRootSubmit(e)}>
        <div className="field">
          <label htmlFor="chapter-comment">{t('discussion.addComment')}</label>
          <textarea
            id="chapter-comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('discussion.thoughts', { chapter: chapterLabel })}
            maxLength={2000}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !body.trim()}>
          {t('discussion.post')}
        </button>
      </form>

      <div className="comment-tree">
        {tree.length === 0 && (
          <p className="empty">{t('discussion.empty')}</p>
        )}
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  )
}
