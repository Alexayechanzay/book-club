import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '../components/ProgressBar'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'
import { supabase } from '../lib/supabase'
import type { ReadingGoal, ReadingSession } from '../lib/types'
import { startOfWeekUtc } from '../lib/utils'

type JoinedSession = ReadingSession & {
  chapter_count: number
  completed_count: number
}

export function Home() {
  const { user, profile } = useAuth()
  const { t } = useLocale()
  const [sessions, setSessions] = useState<JoinedSession[]>([])
  const [goal, setGoal] = useState<ReadingGoal | null>(null)
  const [weekDone, setWeekDone] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: memberships, error: mErr } = await supabase
          .from('session_members')
          .select('session_id')
          .eq('user_id', user!.id)
        if (mErr) throw mErr

        const ids = (memberships ?? []).map((m) => m.session_id)
        let joined: JoinedSession[] = []

        if (ids.length) {
          const { data: sess, error: sErr } = await supabase
            .from('reading_sessions')
            .select('*')
            .in('id', ids)
            .order('created_at', { ascending: false })
          if (sErr) throw sErr

          const { data: chapters } = await supabase.from('chapters').select('id, session_id').in('session_id', ids)
          const { data: progress } = await supabase
            .from('chapter_progress')
            .select('session_id, chapter_id')
            .eq('user_id', user!.id)
            .in('session_id', ids)

          joined = (sess ?? []).map((s) => {
            const total = (chapters ?? []).filter((c) => c.session_id === s.id).length
            const done = (progress ?? []).filter((p) => p.session_id === s.id).length
            return { ...s, chapter_count: total, completed_count: done }
          })
        }

        const { data: goalRow } = await supabase.from('reading_goals').select('*').eq('user_id', user!.id).maybeSingle()

        const weekStart = startOfWeekUtc().toISOString()
        const { count } = await supabase
          .from('chapter_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .gte('completed_at', weekStart)

        if (!cancelled) {
          setSessions(joined)
          setGoal(goalRow)
          setWeekDone(count ?? 0)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('home.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [t, user])

  return (
    <div className="stack page-enter">
      <div>
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginTop: '0.25rem' }}>
          {profile?.display_name ? t('home.helloName', { name: profile.display_name }) : t('home.hello')}
        </h1>
        <p className="muted" style={{ marginTop: '0.4rem' }}>
          {t('home.lead')}
        </p>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span className="muted">{t('home.streak')}</span>
          <strong>{t('home.streakDays', { count: profile?.streak_count ?? 0 })}</strong>
        </div>
        <div className="stat">
          <span className="muted">{t('home.thisWeek')}</span>
          <strong>
            {goal
              ? t('home.weekChaptersGoal', { done: weekDone, target: goal.target_chapters })
              : t('home.weekChapters', { done: weekDone })}
          </strong>
        </div>
        <div className="stat">
          <span className="muted">{t('home.sessions')}</span>
          <strong>{sessions.length}</strong>
        </div>
      </div>

      <div className="row">
        <Link to="/create" className="btn btn-primary">
          {t('home.create')}
        </Link>
        <Link to="/browse" className="btn btn-ghost dark">
          {t('home.browse')}
        </Link>
        <Link to="/join" className="btn btn-ghost dark">
          {t('home.join')}
        </Link>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">{t('home.loading')}</p>}

      {!loading && sessions.length === 0 && (
        <div className="panel empty">
          <p>{t('home.empty')}</p>
        </div>
      )}

      <div className="session-list">
        {sessions.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="session-row">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.55rem' }}>
              <h3>{s.title}</h3>
              <span className={`badge ${s.visibility === 'private' ? 'private' : ''}`}>
                {t(s.visibility === 'private' ? 'visibility.private' : 'visibility.public')}
              </span>
            </div>
            <p className="muted" style={{ marginBottom: '0.75rem' }}>
              {t('common.byAuthor', { author: s.author })}
            </p>
            <ProgressBar completed={s.completed_count} total={s.chapter_count} label={t('home.yourProgress')} />
          </Link>
        ))}
      </div>
    </div>
  )
}
