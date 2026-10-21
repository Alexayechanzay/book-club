import { en, type Messages } from './en'
import { my } from './my'

export type Locale = 'en' | 'my'
export type MessageKey = LeafPaths<Messages>

export const locales: Record<Locale, Messages> = { en, my }

type LeafPaths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`
    }[keyof T & string]

export function translate(messages: Messages, path: MessageKey, vars?: Record<string, string | number>): string {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, messages)

  if (typeof value !== 'string') return path
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''))
}
