# LocalConnect

A neighborhood social app — find people nearby, connect, chat in real time, share
posts, and host/join local events. Built with **Next.js 14** (App Router) and
**Supabase** (Postgres database, auth, realtime, row-level security).

This replaces your original prototype's fake in-memory data with a real backend:
accounts persist, messages actually deliver between devices, and your data is
protected by row-level security rules — not just hidden in the UI.

---

## 1. Create your Supabase project (5 min)

1. Go to [supabase.com](https://supabase.com) → **New project**. Free tier is fine to start.
2. Once it's created, open **SQL Editor** in the left sidebar.
3. Paste the contents of `supabase/schema.sql`, click **Run**.
4. Paste the contents of `supabase/policies.sql`, click **Run**.
   - `policies.sql` turns on Row Level Security. Without it, anyone with your
     public API key could read or edit any row in your database — don't skip it.
5. Go to **Authentication → Providers** and confirm **Email** is enabled (it is by default).
   - For a real launch, also set up a custom SMTP provider under
     **Authentication → Emails** so confirmation emails don't get rate-limited
     or land in spam — Supabase's default sender is meant for testing only.
6. Go to **Project Settings → API**. You'll need the **Project URL** and the
   **anon/public key** in the next step.

## 2. Configure the app

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and paste in your Project URL and anon key:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Then install and run it locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign up, and (importantly) allow location access
when the onboarding screen asks — that's what powers "people near you."

To fully test chat/connect/events, sign up a second account in an incognito
window and connect the two.

## 3. Deploy

**Frontend (Vercel):**
1. Push this project to a GitHub repo.
2. In Vercel: **New Project** → import the repo.
3. Add the two environment variables from `.env.local` in the Vercel project settings.
4. Deploy. Vercel auto-detects Next.js — no other config needed.

**Backend:** nothing to deploy — Supabase is already live and managed. Just
make sure you're on a paid Supabase plan before real users show up; the free
tier pauses projects after a week of inactivity and has row/storage limits.

---

## What's implemented

| Feature | Status |
|---|---|
| Email/password signup & login | ✅ |
| Profile with location, area, interests, bio | ✅ |
| Nearby discovery (real distance via lat/lng) | ✅ |
| Connect requests (send/accept/decline) | ✅ |
| Realtime 1-on-1 chat (only between accepted connections) | ✅ |
| Feed: posts, tags, likes | ✅ |
| Events: create, request to join, host accepts/declines | ✅ |
| Row-level security on every table | ✅ |

## What you should still add before a public launch

This is a solid, working foundation — not a finished consumer product. Before
real strangers start using it, budget time for:

- **Content moderation & reporting** — a way to report/block users and posts.
  Currently anyone connected can message anyone; there's no abuse handling.
- **Push/email notifications** — right now you only see new messages/requests
  while the app is open. Supabase Edge Functions + a service like Resend or
  OneSignal can add this.
- **Rate limiting** — prevent spam signups, mass connection requests, or post
  flooding (Supabase has some built-in auth rate limits; app-level actions do not).
- **Profile photos** — currently avatars are colored initials. Supabase Storage
  can handle image uploads with a moderate amount of added code.
- **Comment UI** — the database supports comments (`post_comments` table) but
  there's no UI to write one yet, only to see the count.
- **Terms of Service / Privacy Policy** — required before collecting location
  and personal data from real users in most jurisdictions.
- **Testing** — no automated tests yet. Given this handles people's location
  and private messages, at minimum test the RLS policies before launch (try
  accessing another user's data with a non-owner session).

## Project structure

```
app/
  (auth pages)      login/, signup/, onboarding/
  (main)/           the app shell: people, chat, feed, events, profile
components/         PersonCard, PostCard, EventCard, Header, BottomNav, etc.
lib/
  supabase/         browser + server Supabase clients, auth middleware helper
  types/db.ts        shared TypeScript types matching the database schema
supabase/
  schema.sql         tables, indexes, the nearby_profiles() distance function
  policies.sql       row-level security rules
middleware.ts        refreshes the auth session and protects routes
```
