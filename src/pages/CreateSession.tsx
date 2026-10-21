import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'
import { supabase } from '../lib/supabase'
import type { Visibility } from '../lib/types'
import { inviteCode } from '../lib/utils'

export function CreateSession() {
  const { user } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [chapterCount, setChapterCount] = useState(10)
  const [chapterTitles, setChapterTitles] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)

    try {
      const custom = chapterTitles
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

      const chapters =
        custom.length > 0
          ? custom.map((t, i) => ({ position: i + 1, title: t }))
          : Array.from({ length: Math.max(1, chapterCount) }, (_, i) => ({
              position: i + 1,
              title: t('create.chapterName', { n: i + 1 }),
            }))

      const code = inviteCode()

      const { data: session, error: sErr } = await supabase
        .from('reading_sessions')
        .insert({
          host_id: user.id,
          title: title.trim(),
          author: author.trim(),
          visibility,
          invite_code: code,
        })
        .select('*')
        .single()
      if (sErr) throw sErr

      const { error: cErr } = await supabase.from('chapters').insert(
        chapters.map((c) => ({
          session_id: session.id,
          position: c.position,
          title: c.title,
        })),
      )
      if (cErr) throw cErr

      const { error: mErr } = await supabase.from('session_members').insert({
        session_id: session.id,
        user_id: user.id,
      })
      if (mErr) throw mErr

      navigate(`/sessions/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('create.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack page-enter" style={{ maxWidth: 560 }}>
      <div>
        <p className="eyebrow">{t('create.eyebrow')}</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', marginTop: '0.25rem' }}>{t('create.title')}</h1>
        <p className="muted" style={{ marginTop: '0.4rem' }}>
          {t('create.lead')}
        </p>
      </div>

      <form className="panel stack" onSubmit={(e) => void onSubmit(e)}>
        <div className="field">
          <label htmlFor="title">{t('create.bookTitle')}</label>
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="author">{t('create.author')}</label>
          <input id="author" required value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="count">{t('create.chapterCount')}</label>
          <input
            id="count"
            type="number"
            min={1}
            max={200}
            value={chapterCount}
            onChange={(e) => setChapterCount(Number(e.target.value))}
          />
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            {t('create.chapterCountHint')}
          </p>
        </div>
        <div className="field">
          <label htmlFor="titles">{t('create.chapterTitles')}</label>
          <textarea
            id="titles"
            value={chapterTitles}
            onChange={(e) => setChapterTitles(e.target.value)}
            placeholder={t('create.titlesPlaceholder')}
          />
        </div>
        <div className="field">
          <label htmlFor="visibility">{t('create.visibility')}</label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            <option value="public">{t('create.publicOption')}</option>
            <option value="private">{t('create.privateOption')}</option>
          </select>
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t('create.creating') : t('create.submit')}
        </button>
      </form>
    </div>
  )
}
