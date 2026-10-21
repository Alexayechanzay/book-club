# Books & Friends — Project Specification

**Version:** 1.2  
**Status:** Web MVP (discussion + threading shipped)  
**Last updated:** 2026-10-21  
**Products:** Web App (Vite + React), Mobile App (later)  
**Backend:** Supabase (Auth + Postgres + RLS)  

---

## 1. Overview

### 1.1 Product name

**Books & Friends**

### 1.2 One-line pitch

A social reading app where members create or join book sessions, track chapter progress together, and discuss **per chapter** in **Reddit-style branching threads** with emoji reactions.

### 1.3 Problem

People often read the same books in isolation. Shared progress and lightweight discussion make reading more social without the complexity of forums, messaging apps, or full social networks.

### 1.4 Solution

Members register, create a reading session for a single book (title, author, chapters), invite or open it for others to join, update chapter-based progress, and talk in a **branching discussion per chapter** (root posts + nested replies) with multi-emoji reactions. Authors can edit/soft-delete their comments; session hosts can soft-delete any comment. Personal reading goals and streaks support habit building.

### 1.5 Out of scope for v1

- Notifications (push, email, in-app)
- Search (books, sessions, users)
- Friend connections / similarity matching
- Page-based progress
- Kick members / lock threads / hard-delete-only moderation beyond soft-delete
- Monetization
- Realtime live updates (client refetches after mutations)

---

## 2. Goals & non-goals

### 2.1 Goals (v1)

1. Anyone can register and become a member.
2. A member can create a reading session for **one book** with title, author, and chapters.
3. Session host chooses **public** or **private** visibility.
4. Other members can join eligible sessions and submit chapter progress.
5. Progress is shown as a **progress bar** based on **chapters completed / total chapters**.
6. Each **chapter** has a **branching discussion** (roots + nested replies via `parent_id`).
7. Members can react to comments with **multiple emojis**.
8. Authors edit/soft-delete own comments; **host** can soft-delete any comment in the session.
9. Each user can set a **reading goal** and maintain **streaks**.
10. Deliver on **web** first; **mobile** later; one **Supabase** backend.

### 2.2 Non-goals (v1)

| Item | Deferred to |
|------|-------------|
| Notifications | Later |
| Search | Later |
| Friend connections based on similar reading patterns | Later |
| Kick members, lock threads, hard-delete-only tools | Later |
| Auto-collapse UI past a depth threshold | Optional polish (visual indent already caps ~6) |
| Multi-book sessions | Never for a single session (1 session = 1 book) |
| Session-wide single discussion thread | Superseded — discussions are chapter-scoped |

---

## 3. Personas

### 3.1 Casual reader (Member)

Wants to join a friend’s or public session, mark chapters done, and leave an occasional comment or reaction.

### 3.2 Session host (Member)

Creates a session for a book they’re reading, sets public/private, and participates like any other member. **Also:** can **soft-delete (remove) any comment** in their session. Cannot kick members, lock discussions, or edit others’ text.

### 3.3 Host powers (v1 — current)

| Power | In v1? |
|-------|--------|
| Create session; set visibility + book/chapter metadata | Yes |
| Soft-delete any comment (`deleted_at`) | Yes |
| Kick members / lock thread / edit others’ bodies | No |

---

## 4. Core concepts

| Concept | Definition |
|---------|------------|
| **Member** | Registered user |
| **Book (session metadata)** | Title + author + ordered list of chapters belonging to one session |
| **Reading session** | A group activity around exactly one book; public or private |
| **Membership** | A user’s join record for a session |
| **Progress** | Highest / set of chapters completed by a member in a session; drives progress bar |
| **Discussion** | Branching comment tree **per chapter** (`parent_id` null = root; else reply) |
| **Reaction** | Emoji reaction by a member on a comment; multiple distinct emojis allowed per member per comment |
| **Reading goal** | User-level target (e.g. chapters or sessions per week/month — see assumptions) |
| **Streak** | Consecutive days (or reading days) the user logged progress — see assumptions |

---

## 5. Feature requirements

### 5.1 Authentication & profiles

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-1 | Anyone can register (email/password via Supabase Auth) | P0 |
| AUTH-2 | Member can sign in / sign out | P0 |
| AUTH-3 | Member has a basic profile: display name, optional avatar | P0 |
| AUTH-4 | Password reset via Supabase | P1 |

**Assumption:** Email/password for v1. OAuth (Google/Apple) can be added later without changing the domain model.

### 5.2 Reading sessions

| ID | Requirement | Priority |
|----|-------------|----------|
| SES-1 | Member can create a session with book **title**, **author**, and **chapters** | P0 |
| SES-2 | Each session has exactly **one book** | P0 |
| SES-3 | Host sets visibility: **public** or **private** | P0 |
| SES-4 | Public sessions are joinable by any authenticated member | P0 |
| SES-5 | Private sessions are joinable only via invite link / code (see assumptions) | P0 |
| SES-6 | Member can leave a session | P1 |
| SES-7 | Session list shows sessions the user has joined | P0 |
| SES-8 | Public session discovery without search: e.g. browse recent public sessions | P1 |

**Chapter model (v1):**

- Chapters are an ordered list with at least: `index` (1-based), `title` (optional string; default “Chapter N”).
- Total chapter count = length of list; used for progress percentage.

**Private session access (assumption):**

- On create, system generates a shareable **invite code** (or deep link). Anyone with the code who is logged in can join.
- No member list management UI in v1.

### 5.3 Progress tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| PRG-1 | Progress is **chapter-based**, not page-based | P0 |
| PRG-2 | Member marks chapters as completed (per session) | P0 |
| PRG-3 | UI shows a **progress bar** = `completed_chapters / total_chapters` | P0 |
| PRG-4 | Member can see own progress and other members’ progress in the session | P0 |
| PRG-5 | Updating progress may contribute to streak / goal (see §5.5) | P0 |

**Progress semantics (assumption):**

- User can toggle chapters complete/incomplete.
- Progress bar uses **count of completed chapters** / total.
- “Current chapter” can be derived as the first incomplete chapter for display, optional.

### 5.4 Discussion (threaded, per chapter)

| ID | Requirement | Priority |
|----|-------------|----------|
| DIS-1 | Each **chapter** has its own discussion | P0 |
| DIS-2 | Replies nest under a parent (**Reddit-style** branching); root comments are chronological | P0 |
| DIS-3 | Joined members can post comments / replies on a chapter | P0 |
| DIS-4 | Member can **edit** and **soft-delete** own comments | P0 |
| DIS-5 | **Host** can soft-delete any comment in their session (moderation) | P0 |
| DIS-6 | Every comment shows an absolute **created** timestamp (plus relative hint) | P0 |
| DIS-7 | Session UI lets members pick a chapter (chips / Discuss) to open that discussion | P0 |

**Assumption:** Plain text comments in v1; no images/markdown required. Soft-delete keeps thread structure (`[deleted]`).

### 5.5 Reactions

| ID | Requirement | Priority |
|----|-------------|----------|
| RXN-1 | Member can react to a comment with an emoji | P0 |
| RXN-2 | Member may apply **multiple different emojis** to the same comment | P0 |
| RXN-3 | Member may remove their own reaction | P0 |
| RXN-4 | UI shows reaction counts aggregated by emoji | P0 |

**Assumption:** Fixed emoji picker set (e.g. 👍 ❤️ 😂 😮 😢 🔥 📚). One row per `(comment_id, user_id, emoji)` — unique constraint prevents duplicate same emoji from same user.

### 5.6 Reading goals & streaks

| ID | Requirement | Priority |
|----|-------------|----------|
| GOL-1 | Member can set a personal reading goal | P0 |
| GOL-2 | System tracks streaks based on reading activity | P0 |
| GOL-3 | Profile or home shows current goal progress and streak | P0 |

**Assumptions (v1 defaults — adjust if needed):**

| Setting | Default |
|---------|---------|
| Goal type | Chapters completed per week |
| Goal value | User-chosen integer (e.g. 5 chapters/week) |
| Streak unit | Consecutive calendar days with ≥1 chapter marked complete (any session) |
| Streak break | Miss a calendar day → streak resets to 0 |

### 5.7 Explicitly not in v1

| ID | Requirement | Status |
|----|-------------|--------|
| NOTIF-* | Push / email / in-app notifications | Out |
| SEARCH-* | Search books, sessions, users | Out |
| FRIEND-* | Friend graph / similarity-based suggestions | Out (later) |
| HOST-MOD-* | Kick members, lock discussion | Out (soft-delete of any comment **is** in — see DIS-5) |

---

## 6. User flows

### 6.1 Register & sign in

1. Open app → Register with email/password → Confirm email (if enabled) → Land on home.
2. Returning user → Sign in → Home.

### 6.2 Create a public session

1. Member taps **Create session**.
2. Enters title, author, chapters (list or “N chapters” generator).
3. Selects **Public**.
4. Submits → Session detail → Shareable link optional; appears in public browse.

### 6.3 Create a private session

1. Same as above, selects **Private**.
2. Receives **invite code / link**.
3. Shares out-of-band (message, etc.). No in-app notifications.

### 6.4 Join & progress

1. Member opens public session or enters invite code.
2. Joins → Sees chapter list, own progress bar, others’ progress.
3. Marks chapters complete → Progress bar updates; streak/goal may update.

### 6.5 Discuss & react (chapter-wise, branching)

1. Open session → **Chapters** tab → **Discuss** on a chapter, or open **Discussion** tab and pick a chapter chip.
2. Post a **root** comment → Appears at the top level of that chapter’s tree.
3. Tap **Reply** on any comment (including nested ones) → Reply nests under that parent (`parent_id`).
4. Author may **Edit** / **Delete** (soft-delete); host may **Remove** others’ comments.
5. React with one or more emojis → Counts update on that comment.

### 6.6 Goals & streaks

1. Profile → Set weekly chapter goal.
2. Completing chapters increments weekly progress and maintains streak when done on consecutive days.

---

## 7. Information architecture & screens

### 7.1 Web & mobile (shared IA)

| Screen | Purpose |
|--------|---------|
| Auth (Sign in / Register) | Account access |
| Home | Joined sessions, goal/streak summary, CTA create/join |
| Browse public | Recent public sessions (no search in v1) |
| Create session | Form: book + chapters + visibility |
| Join private | Enter invite code |
| Session detail | Book info, members’ progress bars, chapter checklist + Discuss |
| Session discussion | Per-chapter branching comments + replies + reactions (chapter picker) |
| Profile | Display name, avatar, goal, streak |
| Settings | Sign out, account basics |

### 7.2 Navigation sketch

```
Auth
 └─ App shell
     ├─ Home
     ├─ Browse (public)
     ├─ Create / Join
     └─ Profile (goals, streaks, settings)
         └─ Session
             ├─ Progress
             └─ Discussion
```

---

## 8. Data model (Supabase / Postgres)

### 8.1 Entity relationship (logical)

```
profiles 1──* session_members *──1 reading_sessions
reading_sessions 1──* chapters
session_members 1──* chapter_progress
chapters 1──* comments          (also denormalized session_id on comments)
comments 1──* comments          (self-FK parent_id → threaded replies)
comments 1──* reactions
profiles 1──1 reading_goals
profiles      streak_count + last_activity_date (updated by trigger)
```

### 8.2 Tables

#### `profiles`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | = `auth.users.id` |
| display_name | text | |
| avatar_url | text nullable | |
| streak_count | int | cached current streak |
| last_activity_date | date nullable | for streak calculation |
| created_at | timestamptz | |

#### `reading_sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| host_id | uuid FK → profiles | creator; can soft-delete any session comment |
| title | text | book title |
| author | text | |
| visibility | text/enum | `public` \| `private` |
| invite_code | text unique nullable | required for private; optional for public |
| created_at | timestamptz | |

#### `chapters`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK | |
| position | int | 1-based order |
| title | text | e.g. “Chapter 1” |

#### `session_members`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK | |
| user_id | uuid FK | |
| joined_at | timestamptz | |
| UNIQUE(session_id, user_id) | | |

#### `chapter_progress`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK | denormalized for RLS ease |
| user_id | uuid FK | |
| chapter_id | uuid FK | |
| completed_at | timestamptz | |
| UNIQUE(user_id, chapter_id) | | |

#### `comments`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK | denormalized; must match chapter’s session |
| chapter_id | uuid FK | **required** — scopes the discussion |
| parent_id | uuid FK nullable | null = root; else reply to another comment in same chapter |
| user_id | uuid FK | |
| body | text | 1–2000 chars (hidden in UI when soft-deleted) |
| created_at | timestamptz | shown on every comment |
| updated_at | timestamptz | |
| deleted_at | timestamptz nullable | soft-delete; author or host |

#### `reactions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| comment_id | uuid FK | |
| user_id | uuid FK | |
| emoji | text | |
| created_at | timestamptz | |
| UNIQUE(comment_id, user_id, emoji) | | allows multiple emojis per user |

#### `reading_goals`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK unique | one active goal in v1 |
| period | text | e.g. `weekly` |
| target_chapters | int | |
| updated_at | timestamptz | |

### 8.3 Derived / computed

- **Session progress for user:** `count(chapter_progress for user in session) / count(chapters in session)`.
- **Weekly goal progress:** count of chapter completions in current week across sessions.
- **Streak:** update on progress write when `last_activity_date` logic applies.

### 8.4 Row Level Security (high level)

| Resource | Read | Write |
|----------|------|-------|
| Public sessions | Authenticated | Host updates own session metadata |
| Private sessions | Members + host; join via invite_code RPC | Same |
| Progress / reactions | Session members | Own rows |
| Comments select | Session members | — |
| Comment insert | — | Member; `chapter_id` ∈ session; `comment_parent_ok(parent_id, …)` |
| Comment update | — | Author **or** host (`is_session_host`) — edit body / set `deleted_at` |
| Comment delete | — | Author **or** host (hard delete; UI prefers soft-delete) |
| Profiles | Authenticated | Own profile |
| Goals | Own | Own |

Use RPC `join_session_by_code(code)` to validate private joins without exposing all private rows.

**Reply inserts:** parent validation must use `comment_parent_ok` (security definer). A plain `EXISTS` on `comments` inside the INSERT `WITH CHECK` can fail under RLS and block replies even when top-level posts work — see migration `003`.

**Source of truth for DDL/RLS:** `supabase/schema.sql` plus incremental files under `supabase/migrations/`. See §17 for the live project setup.

---

## 9. API & realtime

### 9.1 Access pattern

Web client uses **`@supabase/supabase-js`** with the **publishable** key (`sb_publishable_…`) against Postgres + Auth. Prefer direct table access + RLS over custom REST. No secret/service-role key in the browser.

### 9.2 Key operations

| Operation | Mechanism |
|-----------|-----------|
| Sign up / in | Supabase Auth |
| CRUD sessions, chapters | Tables + RLS |
| Join public | Insert `session_members` |
| Join private | RPC `join_session_by_code` |
| Upsert progress | Insert/delete `chapter_progress` (streak trigger on insert) |
| Comments (root) | Insert with `session_id`, `chapter_id`, `parent_id: null` |
| Comments (reply) | Insert with `parent_id` = parent comment (same chapter/session) |
| Comment edit / soft-delete | Update `body` / `deleted_at` (author or host) |
| Reactions | Insert/delete own; unique `(comment_id, user_id, emoji)` |
| Goals | Upsert `reading_goals` on `user_id` |

### 9.3 Realtime (optional P1)

- Subscribe to `comments` and `reactions` filtered by chapter/session for live discussion.
- Current web MVP: refetch after mutations (no Realtime subscription yet).

### 9.4 Storage

- Optional later: Supabase Storage bucket for avatars.
- Book covers: not required in v1 (text-only book metadata).

---

## 10. Platform & tech stack

### 10.1 Backend

| Layer | Choice |
|-------|--------|
| Auth | Supabase Auth (email/password) |
| Database | Supabase Postgres + RLS |
| Realtime | Not wired in web MVP yet |
| Storage | Not used yet |
| Edge / RPC | `join_session_by_code`, `is_session_member`, `is_session_host`, `comment_parent_ok`, Auth + streak triggers |

### 10.2 Clients

| Product | Status | Stack |
|---------|--------|-------|
| Web | **Implemented** | React + Vite + TypeScript + React Router; Netlify-ready |
| Mobile | Later | Expo (React Native) planned; same Supabase project |

### 10.3 Environments

- **Dev / current:** hosted Supabase project (see §17) + `npm run dev` (Vite, typically `:5173`)
- Staging / Production: same or separate Supabase projects; Netlify for web deploy

---

## 11. UX notes

- Progress bars on session detail: own bar prominent; members list with smaller bars.
- Discussion is **per chapter**: chip picker + Discuss actions; **branching tree** (indent + left rule); Reply on any node; “Replying to …” context.
- Soft-deleted comments show `[deleted]` but keep children in the tree.
- Emoji picker allows selecting multiple; tapping an existing own emoji removes it.
- Private sessions surface invite code clearly on create; no notification when someone joins.
- Home emphasizes goal + streak + “Continue reading” sessions.
- Auth network errors: if the browser cannot reach `*.supabase.co` (e.g. Cloudflare blocked on the ISP), show a clear “use VPN / other network” message — not a credentials bug.

---

## 12. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Security | RLS on all user data; no service role in clients |
| Privacy | Private sessions not listed in browse; invite code required |
| Performance | Session detail loads progress for all members in one or few queries |
| Accessibility | Progress not color-only; include percentage text |
| Offline | Not required in v1 |
| i18n | English only in v1 |

---

## 13. Phased roadmap

### Phase 0 — Foundation

- Supabase project, Auth, `profiles` trigger on signup
- Web shell + mobile shell auth screens

### Phase 1 — Sessions & progress (MVP core)

- Create session (public/private), chapters, join, progress bars
- Home + session detail

### Phase 2 — Discussion & reactions

- **Done (web):** chapter-scoped comments, Reddit-style branching replies, edit/soft-delete, host remove, multi-emoji reactions
- Optional realtime (later)

### Phase 3 — Goals & streaks

- **Done (web):** weekly chapter goals, streak calculation on progress (DB trigger)

### Phase 4 — Polish

- Avatars, browse public list, invite deep links, basic empty states (partially done)

### Later (explicit backlog)

| Feature | Notes |
|---------|-------|
| **Friend connections** | Suggest/connect users with similar reading patterns (genres, co-sessions, pace) |
| Notifications | Join, comment, reaction, streak reminders |
| Search | Sessions, books, people |
| Host moderation+ | Kick, lock thread (soft-delete of comments is already shipped) |
| OAuth | Google / Apple |
| Book covers / catalog APIs | Open Library, etc. |
| Collapse deep threads | Optional UI polish beyond current indent cap |

---

## 14. Success metrics (v1)

| Metric | Why |
|--------|-----|
| Sessions created / week | Creation value |
| Join rate (public + invite) | Social loop |
| % members who log ≥1 chapter | Progress engagement |
| Comments per active session | Discussion health |
| % users with goal set + streak ≥3 | Habit feature value |

---

## 15. Open assumptions checklist

Defaults in use / confirmed for current web MVP:

1. Auth = email/password only for v1.
2. Private join = invite code (no approvals); public join = insert membership.
3. Host can edit session metadata + visibility **and** soft-delete any comment in the session.
4. Goal = weekly chapter count; streak = consecutive UTC days with ≥1 chapter completion (DB trigger).
5. Fixed emoji set: 👍 ❤️ 😂 😮 😢 🔥 📚.
6. Plain-text comments; **branching tree per chapter** (`parent_id`); soft-delete preserves structure.
7. Public browse = recent list, not search.
8. Web = React + Vite + React Router; Netlify-ready; Mobile = Expo later; one Supabase backend.
9. Friend similarity graph is **later only**.
10. Client refetches after mutations (no Realtime subscription yet).

---

## 16. Summary

**Books & Friends** is a Supabase-backed app (web MVP in-repo; mobile later) where members create one-book reading sessions (public or private), track chapter progress with progress bars, discuss in **branching per-chapter threads** with multi-emoji reactions and light host moderation (soft-delete), and build personal goals and streaks — without notifications, search, or friend graphs in the first version.

---

## 17. Supabase & local process (current implementation)

Operational reference for backend + day-to-day web workflow. Update this section when keys, SQL, Auth, or discussion behavior change.

### 17.1 Project

| Item | Value |
|------|--------|
| Project ref | `enyrjgwyugugwcdkeehf` |
| API URL | `https://enyrjgwyugugwcdkeehf.supabase.co` |
| Dashboard | `https://supabase.com/dashboard/project/enyrjgwyugugwcdkeehf` |
| Key type | **Publishable** (`sb_publishable_…`) — same privilege class as legacy `anon`; safe in client; RLS enforced |
| Secret / service role | **Never** ship in the web app |

### 17.2 Client environment (Vite)

Repo file: `.env` (gitignored). Template: `.env.example`.

```bash
VITE_SUPABASE_URL=https://enyrjgwyugugwcdkeehf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

| Note | Detail |
|------|--------|
| Prefix | Vite only exposes `VITE_*` to the browser (`import.meta.env`) |
| Client | `src/lib/supabase.ts` → `createClient(url, publishableKey)` |
| Netlify | Set the same `VITE_*` vars in the Netlify UI for deploys |
| Local run | `npm install` → `npm run dev` → usually `http://localhost:5173` |

Do **not** use `NEXT_PUBLIC_*` in this Vite app.

### 17.3 SQL artifacts in repo

| File | When to run |
|------|-------------|
| `supabase/schema.sql` | **New** empty project — full current DDL (includes threading + `comment_parent_ok`) |
| `supabase/migrations/001_chapter_discussions.sql` | Upgrade path: add `comments.chapter_id` if missing |
| `supabase/migrations/002_threaded_comments_moderation.sql` | Upgrade path: `parent_id`, `deleted_at`, `is_session_host`, author/host update & delete policies |
| `supabase/migrations/003_reply_insert_rls.sql` | Upgrade path: `comment_parent_ok` + INSERT policy so **replies** succeed under RLS |

**Apply order (existing project):** `001` → `002` → `003` in the Dashboard **SQL Editor**.  
**New project:** run `schema.sql` once (already includes 001–003 equivalents).

Without **002**, PostgREST returns `PGRST204` for `parent_id` and replies cannot be stored.  
Without **003**, top-level posts may work while **replies** fail RLS (`new row violates row-level security policy`).

### 17.4 Database objects (implemented)

**Tables:** `profiles`, `reading_sessions`, `chapters`, `session_members`, `chapter_progress`, `comments` (`chapter_id`, `parent_id`, `deleted_at`), `reactions`, `reading_goals`

**Functions / RPCs:**

| Name | Role |
|------|------|
| `is_session_member(uuid)` | `security definer` helper for RLS |
| `is_session_host(uuid)` | `security definer` — true if `auth.uid()` is session `host_id` |
| `comment_parent_ok(parent, session, chapter)` | `security definer` — validates reply parent (or null root) for INSERT |
| `join_session_by_code(text)` | Private join; returns `session_id`; uppercases/trims code |
| `handle_new_user()` | Trigger on `auth.users` insert → creates `profiles` row |
| `touch_streak()` | Trigger after insert on `chapter_progress` → updates `streak_count` / `last_activity_date` |

**Triggers:**

- `on_auth_user_created` → `handle_new_user`
- `on_progress_streak` → `touch_streak`

### 17.5 Auth configuration (recommended for local)

| Setting | Recommendation |
|---------|----------------|
| Provider | Email enabled |
| Confirm email | Off for local smoke tests; on for production |
| Site URL | `http://localhost:5173` |
| Redirect URLs | `http://localhost:5173/**` (add production URL when deploying) |

### 17.6 Web app routes & discussion UI (current)

| Route / area | Behavior |
|--------------|----------|
| `/`, Auth, Home, Browse, Create, Join, Profile | Standard MVP shell |
| Session detail → Progress | Chapter checklist, Discuss shortcuts, member bars |
| Session detail → Discussion | Chapter chips; `ChapterDiscussion` builds tree via `buildCommentTree` |
| Post root | `parent_id: null` |
| Post reply | `parent_id` = target comment id; optimistic append + reload |
| Edit / Delete | Author; host can Remove (soft-delete) |

Primary UI: `src/pages/SessionDetail.tsx`, `src/components/ChapterDiscussion.tsx`, `src/lib/utils.ts` (`buildCommentTree`).

### 17.7 What is not configured yet

- Supabase Storage (avatars)
- Realtime subscriptions in the client
- Edge Functions (product features)
- OAuth providers
- Separate staging project

### 17.8 Troubleshooting (known)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Failed to fetch` / `ERR_CONNECTION_REFUSED` on sign-in | Local network blocking Cloudflare (`*.supabase.co`) | VPN or other network; project may still be healthy |
| Post works, Reply does nothing / RLS error | Missing `003` or old INSERT policy | Run `003_reply_insert_rls.sql` |
| `PGRST204` … `parent_id` | Missing column / migration `002` | Run `002_threaded_comments_moderation.sql` |
| Netlify Vite plugin “Edge Functions … fetch failed” | Local Netlify edge emulate noise | Ignore if Vite still serves `:5173` |

### 17.9 Setup checklist (repeatable)

**New Supabase project**

1. Dashboard → **SQL Editor** → run entire `supabase/schema.sql`.
2. Confirm tables under **Table Editor**.
3. Auth → set Site URL / Redirect URLs; optionally disable email confirm for local.
4. Copy **Project URL** + **publishable** key into `.env`.
5. `npm install` → `npm run dev` → register → verify `profiles` → create session → mark chapter → post root comment → **reply** under it → confirm nested display.

**Existing project (upgrade)**

1. Run `001` if `chapter_id` missing.
2. Run `002` if `parent_id` / `deleted_at` / host policies missing.
3. Run `003` so reply inserts pass RLS.
4. Hard-refresh the app; smoke-test root post + nested reply + host remove.
