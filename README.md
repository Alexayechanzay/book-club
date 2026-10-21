# Books & Friends

Books & Friends is a social reading app. A member creates a session for one book, other members join, everyone marks chapters complete, and each chapter has its own branching discussion with emoji reactions. A weekly chapter goal and a reading streak sit on the home screen.

Two clients share one Supabase project:

| Client | Folder | Stack |
|--------|--------|--------|
| Web | repo root | Vite, React, TypeScript, React Router |
| Mobile | `mobile/` | Expo SDK 58, React Native, React Navigation |

Auth, data, and files live in Supabase (Auth, Postgres with row-level security, and a public `avatars` storage bucket). Clients use the publishable key only. The service-role key never belongs in either app.

`SPEC.md` is the product specification. This README describes the code as it stands. The spec still says the mobile app, avatars, and Burmese UI are later work; those three are already in the repo.

## What a member can do

- Register and sign in with email and password. A database trigger creates a `profiles` row on signup.
- Set a display name, an optional profile photo, and a weekly chapter goal.
- Create a public or private session for one book: title, author, and an ordered chapter list.
- Browse recent public sessions, or join a private session with an invite code (`join_session_by_code`).
- Toggle chapters complete. The progress bar is completed chapters divided by the chapter count. The same write updates the streak.
- Open a chapter and post a root comment, reply under any comment, edit or soft-delete their own comments, and react with more than one emoji. The session host can soft-delete any comment in that session.
- On the web app, switch the interface between English and Burmese. Book titles, comments, and display names stay in the language they were written.

Still out of this version: notifications, search, friend graphs, kicking members, locking threads, page-based progress, realtime subscriptions, and OAuth.

## Repository map

```
book-club/
├── index.html              web entry HTML
├── src/                    web app
│   ├── main.tsx            mounts React
│   ├── App.tsx             providers and routes
│   ├── pages/              one screen per route
│   ├── components/         shared UI (layout, discussion, avatar, progress)
│   ├── contexts/           auth session and locale
│   ├── locales/            English and Burmese strings
│   └── lib/                Supabase client, types, comment tree, avatar upload
├── mobile/                 Expo app (own package.json)
│   ├── App.tsx             stack + bottom tabs
│   ├── index.ts            Expo root
│   └── src/                screens, navigation, auth, discussion
├── supabase/
│   ├── schema.sql          full schema for a new project
│   └── migrations/         incremental SQL for an existing project
├── netlify.toml            web build and SPA redirect
├── SPEC.md                 product spec
└── .env.example            web env template
```

`node_modules/`, `dist/`, `.env`, and `.netlify/` are local or generated. Do not commit them.

## Web app

### Startup

`src/main.tsx` renders `App`. `App` wraps the tree in this order:

1. `LocaleProvider` reads `bf-locale` from `localStorage` (`en` or `my`), sets `document.documentElement.lang`, the document title, and the meta description.
2. `AuthProvider` listens to Supabase Auth, keeps the session, and loads the matching `profiles` row.
3. `BrowserRouter` plus `Layout` draws the header, the language switch, and the signed-in bottom nav.

`ProtectedRoute` sends a signed-out visitor to `/auth?mode=signin`. While auth is still resolving it shows a loading line.

### Routes

| Path | Page | Who |
|------|------|-----|
| `/` | `Landing` | public |
| `/auth` | `Auth` (`?mode=signin` or `signup`) | public |
| `/home` | `Home` | signed in |
| `/browse` | `Browse` | signed in |
| `/create` | `CreateSession` | signed in |
| `/join` | `JoinPrivate` | signed in |
| `/sessions/:id` | `SessionDetail` | signed in |
| `/profile` | `Profile` | signed in |

`Home` loads the member’s sessions, streak, and how many chapters they finished this UTC week against `reading_goals`. `Browse` lists recent `public` sessions. `CreateSession` inserts `reading_sessions`, generates an invite code, inserts `chapters`, and adds the host as a member. Blank chapter titles become “Chapter N” in the language that is active at create time. `JoinPrivate` calls the `join_session_by_code` RPC.

`SessionDetail` is the large screen. It loads the session, chapters, members, progress, comments, and reactions. Members get a chapter checklist and a discussion tab. Public visitors who have not joined see a join button. Private visitors are pointed at the invite-code page. `ChapterDiscussion` renders one chapter’s thread.

### How screens talk to Supabase

There is no separate API layer. Pages call `supabase` from `src/lib/supabase.ts`, which is `createClient` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Postgres row-level security decides what each signed-in user can read or write. After a mutation the screen loads again. There is no Realtime subscription.

Shared helpers in `src/lib/utils.ts`:

- `progressPercent` for the bar label.
- `inviteCode` for the share code created with a session.
- `buildCommentTree` turns a flat `comments` list (`parent_id` null for a root) into a nested tree.
- `formatTimestamp` and `formatRelative` format comment times for the active locale.
- `startOfWeekUtc` is the start of the weekly goal window.

`src/lib/types.ts` mirrors the tables the UI selects. `src/lib/avatar.ts` uploads to the `avatars` bucket at `{userId}/{uuid}.ext`, writes the public URL onto `profiles.avatar_url`, and deletes the previous object when it belongs to that user. The client rejects anything that is not JPEG, PNG, WebP, or GIF, and anything over 1 MB.

### Languages

`src/locales/en.ts` is the source of the `Messages` type. `src/locales/my.ts` must match that shape. `translate` looks up a dotted key such as `session.join` and replaces `{{name}}` placeholders. Components call `useLocale().t`. The header switch is `EN` / `မြန်မာ`. Burmese text uses Noto Sans Myanmar because the display fonts do not include Myanmar glyphs.

Visibility stays `public` or `private` in the database. The badge text is translated at render time. Supabase’s own error strings stay in English. The app translates its fallbacks, including the message shown when the browser cannot reach `*.supabase.co`.

## Mobile app

`mobile/` is a separate npm project. It uses the same tables, RPCs, and storage bucket. Auth persists with AsyncStorage (`mobile/src/lib/supabase.ts`). `detectSessionInUrl` is off because this client is not a browser.

`mobile/App.tsx` switches the root stack on the auth session:

- Signed out: `Landing`, then `Auth`.
- Signed in: bottom tabs `Home`, `Browse`, `Create`, `Join`, and `Profile` (tab title “You”), plus a stack screen `Session` opened with `{ id }`.

Screens live in `mobile/src/screens/`. `SessionScreen` covers chapters, member progress, the invite code, and the thread. `Discussion.tsx` is the React Native comment tree. `mobile/src/lib/avatar.ts` picks a photo with `expo-image-picker` and uploads the same way as the web client.

The mobile UI is English only. Colors are in `mobile/src/theme.ts`.

Expo Go from the Play Store may be an older SDK than this project (`expo` ~58, React Native 0.88). Use an Expo Go build that matches SDK 58, then run the dev server and scan the QR code.

## Database

`supabase/schema.sql` is the full definition for a new project: tables, RLS, functions, triggers, and the `avatars` bucket policies. Migrations are the upgrade path when that file was applied earlier and the database needs the later changes.

| File | What it adds |
|------|----------------|
| `001_chapter_discussions.sql` | `comments.chapter_id` |
| `002_threaded_comments_moderation.sql` | `parent_id`, `deleted_at`, host soft-delete policies |
| `003_reply_insert_rls.sql` | `comment_parent_ok` so a reply insert is allowed under RLS |
| `004_avatar_storage.sql` | public `avatars` bucket and per-user object policies |

**New project:** run `schema.sql` once in the SQL editor. It already includes the equivalents of 001–004.

**Existing project:** run only the migrations that are not already applied, in numeric order.

Tables: `profiles`, `reading_sessions`, `chapters`, `session_members`, `chapter_progress`, `comments`, `reactions`, `reading_goals`.

| Function | Role |
|----------|------|
| `handle_new_user` | After `auth.users` insert, create `profiles`. |
| `touch_streak` | After `chapter_progress` insert, update `streak_count` and `last_activity_date`. |
| `is_session_member` / `is_session_host` | Security-definer checks used by RLS. |
| `comment_parent_ok` | A reply’s parent belongs to the same session and chapter. |
| `join_session_by_code` | Join a private session without listing every private row. |

A member can read and write their own progress and reactions. Comments are visible to session members. The author can edit or soft-delete their comment. The host can soft-delete any comment in the session. Soft-delete sets `deleted_at` and keeps child replies in the tree. Private sessions do not appear in browse. Avatar objects must live under a folder named with the signed-in user’s id.

If replies fail while root posts succeed, migration `003` is missing. If PostgREST reports `PGRST204` for `parent_id`, migration `002` is missing.

## Run the web app

```bash
npm install
```

Copy `.env.example` to `.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Vite only exposes variables that start with `VITE_`. The live project URL and dashboard are in `SPEC.md` section 17. Put the same two variables in the Netlify UI before a deploy.

```bash
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`. In Supabase Auth, set the site URL to that origin and add `http://localhost:5173/**` as a redirect URL. Turning off “Confirm email” makes local sign-up faster. Turn it back on for a public deploy.

```bash
npm run build
npm run preview
```

`netlify.toml` builds with `npm run build`, publishes `dist`, and rewrites every path to `index.html` so client routes work.

If sign-in fails with “Failed to fetch” or `ERR_CONNECTION_REFUSED` against `*.supabase.co`, the keys are fine and the network is blocking the API host. Try a VPN or another network, and confirm the project is not paused in the Supabase dashboard.

## Run the mobile app

From the repo root:

```bash
npm run mobile
```

That runs `npm --prefix mobile start`. Or `cd mobile` and `npm install` then `npm start`.

Copy `mobile/.env.example` to `mobile/.env` and set the same Supabase project:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Sign in with the same account as the web app. Both clients read and write the same rows.

## Profile photos

The bucket is public, named `avatars`, limited to 1 MB and to JPEG, PNG, WebP, and GIF. Policies allow an authenticated user to insert, read, update, and delete only objects inside their own `{userId}/` folder. `schema.sql` and `004_avatar_storage.sql` create the bucket and those policies. If the bucket was created by hand in the dashboard, the client still enforces the size and type limits. Each upload uses a new file name so a replaced photo is not served from a stale CDN cache.

## Where to look next

| Question | Start here |
|----------|------------|
| Product rules and screen list | `SPEC.md` |
| Exact tables, RLS, and RPCs | `supabase/schema.sql` |
| Web routes | `src/App.tsx` |
| Session and discussion behavior | `src/pages/SessionDetail.tsx`, `src/components/ChapterDiscussion.tsx` |
| Copy for both languages | `src/locales/en.ts`, `src/locales/my.ts` |
| Mobile navigation | `mobile/App.tsx`, `mobile/src/navigation/types.ts` |
