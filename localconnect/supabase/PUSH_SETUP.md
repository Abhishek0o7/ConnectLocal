# Push notifications setup

Push notifications use the standard **Web Push** protocol — no third-party
account (Resend, OneSignal, Firebase) is required. You just need a pair of
VAPID keys, which you generate yourself, once, for free.

## 1. Generate VAPID keys

From the `localconnect/` folder:

```bash
npx web-push generate-vapid-keys
```

This prints something like:

```
Public Key:
BN4G...

Private Key:
2Qk...
```

## 2. Add these to `.env.local`

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the Public Key above>
VAPID_PUBLIC_KEY=<the same Public Key>
VAPID_PRIVATE_KEY=<the Private Key above>
VAPID_SUBJECT=mailto:you@example.com
```

`VAPID_SUBJECT` just needs to be a contact `mailto:` or `https:` URL — it's
sent to browser push services so they know who to contact if something's
wrong with your usage, it's not shown to users.

## 3. Add your Supabase service role key

The `/api/push/send` route needs to look up *other* users' subscriptions
(e.g. to notify the person you just messaged), which requires bypassing RLS.
Get this from **Supabase Dashboard → Project Settings → API → service_role
key** (careful: this key has full database access, never expose it to the
browser or commit it — it's only read server-side in `lib/supabase/admin.ts`).

```
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
```

## 4. Run the migration

If you haven't already, run `supabase/migration_genz_v3.sql` — it creates
the `push_subscriptions` table these routes read/write.

## 5. Restart and test

```bash
npm run dev
```

Go to **Profile → 🔔 Enable notifications**, accept the browser permission
prompt, then have a friend message you or accept a connection request from
another browser/device — you should get a real OS-level notification.

## What's wired up already

- New text message → notifies the recipient
- New voice note → notifies the recipient
- Connection request accepted → notifies the person who sent the request

## Not wired up yet (natural next additions, same pattern)

- Event reminders (would need a scheduled job — Supabase's free tier has no
  cron, so this would need either a paid Supabase plan with pg_cron, or an
  external scheduler like a Vercel Cron Job hitting a new `/api/push/event-reminders` route)
- New post from a friend
- New comment/reaction on your post

Each of these is a one-line `notifyUser(...)` call added at the right spot,
following the same pattern as the three above.
