import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useLocale()
  const location = useLocation()

  if (loading) {
    return <p className="muted page-enter">{t('common.loading')}</p>
  }

  if (!user) {
    return <Navigate to="/auth?mode=signin" replace state={{ from: location.pathname }} />
  }

  return children
}
