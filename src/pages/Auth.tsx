import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'
import { supabase } from '../lib/supabase'

export function Auth() {
  const { user, loading } = useAuth()
  const { t } = useLocale()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const mode = params.get('mode') === 'signup' ? 'signup' : 'signin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const title = useMemo(() => (mode === 'signup' ? t('auth.createTitle') : t('auth.welcomeTitle')), [mode, t])

  if (!loading && user) {
    return <Navigate to="/home" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)

    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        })
        if (err) throw err
        if (data.session) {
          navigate('/home')
        } else {
          setMessage(t('auth.confirmEmail'))
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        navigate('/home')
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : t('errors.generic')
      const networkBlocked =
        raw === 'Failed to fetch' ||
        raw === 'NetworkError when attempting to fetch resource.' ||
        raw.includes('ERR_CONNECTION_REFUSED') ||
        raw.includes('Load failed')
      setError(networkBlocked ? t('errors.network') : raw)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap page-enter">
      <div className="panel stack">
        <div>
          <p className="eyebrow">{t('auth.eyebrow')}</p>
          <h1 style={{ fontSize: '1.8rem', marginTop: '0.35rem' }}>{title}</h1>
          <p className="muted" style={{ marginTop: '0.4rem' }}>
            {mode === 'signup' ? t('auth.signupLead') : t('auth.signinLead')}
          </p>
        </div>

        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="name">{t('auth.displayName')}</label>
              <input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                autoComplete="nickname"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? t('auth.pleaseWait') : mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
          </button>
        </form>

        <p className="muted" style={{ fontSize: '0.92rem' }}>
          {mode === 'signup' ? (
            <>
              {t('auth.alreadyMember')} <Link to="/auth?mode=signin">{t('auth.signInLink')}</Link>
            </>
          ) : (
            <>
              {t('auth.newHere')} <Link to="/auth?mode=signup">{t('auth.createLink')}</Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
