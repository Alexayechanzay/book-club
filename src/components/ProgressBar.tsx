import { progressPercent } from '../lib/utils'
import { useLocale } from '../contexts/LocaleContext'

type Props = {
  completed: number
  total: number
  label?: string
}

export function ProgressBar({ completed, total, label }: Props) {
  const { t } = useLocale()
  const pct = progressPercent(completed, total)
  return (
    <div>
      <div className="progress-label">
        <span>{label ?? t('progress.label')}</span>
        <span>{t('progress.summary', { completed, total, pct })}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
