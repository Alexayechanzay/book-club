import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'

export function Landing() {
  const { user, loading } = useAuth()
  const { t } = useLocale()

  if (!loading && user) {
    return <Navigate to="/home" replace />
  }

  return (
    <section className="hero">
      <div className="hero-inner">
        <h1 className="brand-hero">
          {t('brandLead')}
          <span>{t('brandAccent')}</span>
        </h1>
        <p>{t('landing.tagline')}</p>
        <div className="hero-actions">
          <Link to="/auth?mode=signup" className="btn btn-primary">
            {t('landing.start')}
          </Link>
          <Link to="/auth?mode=signin" className="btn btn-ghost">
            {t('landing.signIn')}
          </Link>
        </div>
      </div>
    </section>
  )
}
