import { supabase } from './supabase'

const BUCKET = 'avatars'

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
export const AVATAR_MAX_BYTES = 1024 * 1024

export type AvatarFileIssue = 'type' | 'size' | 'empty'

export function avatarFileError(file: File): AvatarFileIssue | null {
  if (!MIME_EXT[file.type]) return 'type'
  if (file.size > AVATAR_MAX_BYTES) return 'size'
  if (file.size === 0) return 'empty'
  return null
}

function objectPathFromPublicUrl(url: string, userId: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0])
  if (!path.startsWith(`${userId}/`) || path.includes('..')) return null
  return path
}

export async function uploadAvatar(userId: string, file: File, previousUrl: string | null): Promise<string> {
  const ext = MIME_EXT[file.type]
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = data.publicUrl

  const { error: profileError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
  if (profileError) {
    await supabase.storage.from(BUCKET).remove([path])
    throw profileError
  }

  const previousPath = previousUrl ? objectPathFromPublicUrl(previousUrl, userId) : null
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(BUCKET).remove([previousPath])
  }

  return publicUrl
}

export async function removeAvatar(userId: string, currentUrl: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
  if (error) throw error

  const path = currentUrl ? objectPathFromPublicUrl(currentUrl, userId) : null
  if (path) await supabase.storage.from(BUCKET).remove([path])
}
