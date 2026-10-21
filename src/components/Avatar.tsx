import { initials } from '../lib/utils'

type Props = {
  name: string
  url?: string | null
  large?: boolean
  alt?: string
}

export function Avatar({ name, url, large = false, alt = '' }: Props) {
  const className = large ? 'avatar avatar-lg' : 'avatar'
  if (url) {
    return <img className={`${className} avatar-photo`} src={url} alt={alt} />
  }
  return (
    <span className={className} aria-hidden={alt ? undefined : true}>
      {initials(name)}
    </span>
  )
}
