import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '../contexts/LocaleContext'
import { supabase } from '../lib/supabase'

export function JoinPrivate() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('join_session_by_code', {
        code: code.trim().toUpperCase(),
      })
      if (err) throw err
      navigate(`/sessions/${data}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('join.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack page-enter" style={{ maxWidth: 420 }}>
      <div>
        <p className="eyebrow">{t('join.eyebrow')}</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', marginTop: '0.25rem' }}>{t('join.title')}</h1>
        <p className="muted" style={{ marginTop: '0.4rem' }}>
          {t('join.lead')}
        </p>
      </div>

      <form className="panel stack" onSubmit={(e) => void onSubmit(e)}>
        <div className="field">
          <label htmlFor="code">{t('join.code')}</label>
          <input
            id="code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('join.placeholder')}
            autoCapitalize="characters"
            style={{ letterSpacing: '0.12em', fontWeight: 700 }}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t('join.joining') : t('join.submit')}
        </button>
      </form>
    </div>
  )
}
