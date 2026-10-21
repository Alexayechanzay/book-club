import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { locales, translate, type Locale, type MessageKey } from '../locales'

const STORAGE_KEY = 'bf-locale'

type LocaleState = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleState | undefined>(undefined)

function readLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'my' ? 'my' : 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locales[locale], key, vars),
    [locale],
  )

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('meta.title')
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', t('meta.description'))
  }, [locale, t])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
