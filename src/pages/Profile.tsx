import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'
import { AVATAR_ACCEPT, avatarFileError, removeAvatar, uploadAvatar } from '../lib/avatar'
import { supabase } from '../lib/supabase'
import type { ReadingGoal } from '../lib/types'
import { startOfWeekUtc } from '../lib/utils'

export function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { t } = useLocale()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [target, setTarget] = useState(5)
  const [goal, setGoal] = useState<ReadingGoal | null>(null)
  const [weekDone, setWeekDone] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
  }, [profile?.display_name])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('reading_goals').select('*').eq('user_id', user!.id).maybeSingle()
      const weekStart = startOfWeekUtc().toISOString()
      const { count } = await supabase
        .from('chapter_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('completed_at', weekStart)
      if (!cancelled) {
        setGoal(data)
        if (data) setTarget(data.target_chapters)
        setWeekDone(count ?? 0)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function onPickAvatar(file: File | undefined) {
    if (!user || !file) return
    if (fileRef.current) fileRef.current.value = ''
    const problem = avatarFileError(file)
    if (problem) {
      const key =
        problem === 'type' ? 'profile.photoType' : problem === 'size' ? 'profile.photoSize' : 'profile.photoEmpty'
      setError(t(key))
      setMessage(null)
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await uploadAvatar(user.id, file, profile?.avatar_url ?? null)
      await refreshProfile()
      setMessage(t('profile.photoUpdated'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.photoUploadError'))
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveAvatar() {
    if (!user || !profile?.avatar_url) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await removeAvatar(user.id, profile.avatar_url)
      await refreshProfile()
      setMessage(t('profile.photoRemoved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.photoRemoveError'))
    } finally {
      setBusy(false)
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || t('common.reader') })
        .eq('id', user.id)
      if (err) throw err
      await refreshProfile()
      setMessage(t('profile.profileUpdated'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.saveError'))
    } finally {
      setBusy(false)
    }
  }

  async function saveGoal(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        user_id: user.id,
        period: 'weekly' as const,
        target_chapters: target,
        updated_at: new Date().toISOString(),
      }
      const { data, error: err } = await supabase
        .from('reading_goals')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single()
      if (err) throw err
      setGoal(data)
      setMessage(t('profile.goalSaved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.goalError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack page-enter" style={{ maxWidth: 520 }}>
      <div>
        <p className="eyebrow">{t('profile.eyebrow')}</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', marginTop: '0.25rem' }}>{t('profile.title')}</h1>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span className="muted">{t('profile.streak')}</span>
          <strong>{profile?.streak_count ?? 0}</strong>
        </div>
        <div className="stat">
          <span className="muted">{t('profile.weeklyGoal')}</span>
          <strong>
            {weekDone}/{goal?.target_chapters ?? '—'}
          </strong>
        </div>
      </div>

      <section className="panel stack">
        <h2 style={{ fontSize: '1.15rem' }}>{t('profile.photo')}</h2>
        <div className="row">
          <Avatar name={displayName || t('common.reader')} url={profile?.avatar_url} large alt={t('profile.photoAlt')} />
          <div className="stack" style={{ gap: '0.55rem', flex: 1 }}>
            <p className="muted">{t('profile.photoHint')}</p>
            <div className="row">
              <button
                type="button"
                className="btn btn-sage"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {profile?.avatar_url ? t('profile.changePhoto') : t('profile.uploadPhoto')}
              </button>
              {profile?.avatar_url && (
                <button type="button" className="btn btn-ghost dark" disabled={busy} onClick={() => void onRemoveAvatar()}>
                  {t('profile.remove')}
                </button>
              )}
            </div>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={AVATAR_ACCEPT}
          hidden
          onChange={(e) => void onPickAvatar(e.target.files?.[0])}
        />
      </section>

      <form className="panel stack" onSubmit={(e) => void saveProfile(e)}>
        <h2 style={{ fontSize: '1.15rem' }}>{t('profile.displayName')}</h2>
        <div className="field">
          <label htmlFor="display">{t('profile.name')}</label>
          <input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <button className="btn btn-sage" type="submit" disabled={busy}>
          {t('profile.saveName')}
        </button>
      </form>

      <form className="panel stack" onSubmit={(e) => void saveGoal(e)}>
        <h2 style={{ fontSize: '1.15rem' }}>{t('profile.readingGoal')}</h2>
        <p className="muted">{t('profile.goalLead')}</p>
        <div className="field">
          <label htmlFor="target">{t('profile.chaptersPerWeek')}</label>
          <input
            id="target"
            type="number"
            min={1}
            max={100}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {t('profile.saveGoal')}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <button type="button" className="btn btn-ghost dark" onClick={() => void signOut()}>
        {t('nav.signOut')}
      </button>
    </div>
  )
}
