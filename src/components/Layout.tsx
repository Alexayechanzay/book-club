import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../contexts/LocaleContext'
import type { Locale } from '../locales'

export function Layout() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const { locale, setLocale, t } = useLocale()
  const flush = pathname === '/'

  return (
    <div className="app-shell">
      <header className="nav">
        <NavLink to={user ? '/home' : '/'} className="brand">
          {t('brandLead')}
          <span>{t('brandAccent')}</span>
        </NavLink>
        <nav className="nav-links">
          <LanguageSwitch locale={locale} setLocale={setLocale} label={t('nav.language')} />
          {user ? (
            <>
              <NavLink to="/home" className={({ isActive }) => (isActive ? 'active hide-sm' : 'hide-sm')}>
                {t('nav.home')}
              </NavLink>
              <NavLink to="/browse" className={({ isActive }) => (isActive ? 'active hide-sm' : 'hide-sm')}>
                {t('nav.browse')}
              </NavLink>
              <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                {t('nav.create')}
              </NavLink>
              <NavLink to="/join" className={({ isActive }) => (isActive ? 'active hide-sm' : 'hide-sm')}>
                {t('nav.join')}
              </NavLink>
              <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                {t('nav.profile')}
              </NavLink>
              <button type="button" className="linkish hide-sm" onClick={() => void signOut()}>
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/auth?mode=signin">{t('nav.signIn')}</NavLink>
              <NavLink to="/auth?mode=signup" className="btn btn-primary" style={{ padding: '0.45rem 0.9rem' }}>
                {t('nav.joinFree')}
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <main className={flush ? 'main main-flush' : 'main'}>
        <Outlet />
      </main>

      {user && (
        <nav className="mobile-nav" aria-label={t('nav.mobile')}>
          <NavLink to="/home" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/browse" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {t('nav.browse')}
          </NavLink>
          <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {t('nav.create')}
          </NavLink>
          <NavLink to="/join" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {t('nav.join')}
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {t('nav.profile')}
          </NavLink>
        </nav>
      )}
    </div>
  )
}

function LanguageSwitch({
  locale,
  setLocale,
  label,
}: {
  locale: Locale
  setLocale: (locale: Locale) => void
  label: string
}) {
  return (
    <div className="lang-switch" role="group" aria-label={label}>
      <button type="button" className={locale === 'en' ? 'active' : undefined} onClick={() => setLocale('en')}>
        EN
      </button>
      <button type="button" className={locale === 'my' ? 'active' : undefined} onClick={() => setLocale('my')}>
        မြန်မာ
      </button>
    </div>
  )
}
