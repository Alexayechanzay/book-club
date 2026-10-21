export type Visibility = 'public' | 'private'

export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  streak_count: number
  last_activity_date: string | null
  created_at: string
}

export type ReadingSession = {
  id: string
  host_id: string
  title: string
  author: string
  visibility: Visibility
  invite_code: string | null
  created_at: string
}

export type Chapter = {
  id: string
  session_id: string
  position: number
  title: string
}

export type SessionMember = {
  id: string
  session_id: string
  user_id: string
  joined_at: string
}

export type ChapterProgress = {
  id: string
  session_id: string
  user_id: string
  chapter_id: string
  completed_at: string
}

export type Comment = {
  id: string
  session_id: string
  chapter_id: string
  parent_id: string | null
  user_id: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Reaction = {
  id: string
  comment_id: string
  user_id: string
  emoji: string
  created_at: string
}

export type ReadingGoal = {
  id: string
  user_id: string
  period: 'weekly'
  target_chapters: number
  updated_at: string
}

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '📚'] as const
