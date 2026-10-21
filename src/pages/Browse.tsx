import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '../contexts/LocaleContext'
import { supabase } from '../lib/supabase'
import type { ReadingSession } from '../lib/types'

export function Browse() {
  const { t } = useLocale()
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(40)
      if (!cancelled) {
        if (err) setError(err.message)
        else setSessions(data ?? [])
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="stack page-enter">
      <div>
        <p className="eyebrow">{t('browse.eyebrow')}</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', marginTop: '0.25rem' }}>{t('browse.title')}</h1>
        <p className="muted" style={{ marginTop: '0.4rem' }}>
          {t('browse.lead')}
        </p>
      </div>

      {loading && <p className="muted">{t('browse.loading')}</p>}
      {error && <p className="error">{error}</p>}
      {!loading && sessions.length === 0 && (
        <div className="panel empty">
          <p>{t('browse.empty')}</p>
          <Link to="/create" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            {t('browse.create')}
          </Link>
        </div>
      )}

      <div className="session-list">
        {sessions.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="session-row">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>{s.title}</h3>
              <span className="badge">{t('visibility.public')}</span>
            </div>
            <p className="muted" style={{ marginTop: '0.35rem' }}>
              {t('common.byAuthor', { author: s.author })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
