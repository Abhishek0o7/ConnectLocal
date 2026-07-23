import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const vapidConfigured =
  !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY && !!process.env.VAPID_SUBJECT;

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

/**
 * Sends a push notification to every subscribed device for `userId`.
 * Call this from other server-side code paths (or client code right after an
 * action, as this app does) — e.g. after a message insert or a connection
 * being accepted. Requires VAPID_* env vars; see PUSH_SETUP.md.
 */
export async function POST(req: Request) {
  if (!vapidConfigured) {
    return NextResponse.json(
      { error: "Push notifications aren't configured yet — see supabase/PUSH_SETUP.md" },
      { status: 501 }
    );
  }

  // Caller must be authenticated (any logged-in user can trigger a
  // notification to a friend, e.g. "new message" — but not on behalf of
  // someone else's account).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { userId, title, body, url } = await req.json();
  if (!userId || !title) {
    return NextResponse.json({ error: "userId and title are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );

  // Clean up subscriptions the browser has revoked (410 Gone / 404).
  const dead = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && [404, 410].includes((r.reason as any)?.statusCode);
  });
  if (dead.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", dead.map((d) => d.endpoint));
  }

  return NextResponse.json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length });
}
