-- ============================================================================
-- LocalConnect — Gen Z feature pack, Phase 3 (media, stories, recurring events,
-- comment reactions, push notification plumbing)
-- Run AFTER schema.sql, policies.sql, migration_genz.sql, migration_genz_v2.sql
-- ============================================================================

-- ── 1. STORAGE BUCKETS ───────────────────────────────────────────────────────
-- Four public-read buckets, one per media type. Files are stored under a
-- path prefixed with the uploader's user id (e.g. `avatars/<user_id>/x.jpg`)
-- so the RLS policies below can check ownership from the path alone.
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('post-photos', 'post-photos', true),
  ('event-photos', 'event-photos', true),
  ('voice-notes', 'voice-notes', true),
  ('stories', 'stories', true)
on conflict (id) do nothing;

do $$
declare
  b text;
begin
  foreach b in array array['avatars','post-photos','event-photos','voice-notes','stories'] loop
    execute format($f$
      drop policy if exists "%1$s public read" on storage.objects;
create policy "%1$s public read"
        on storage.objects for select
        to authenticated
        using (bucket_id = '%1$s');
    $f$, b);

    execute format($f$
      drop policy if exists "%1$s owner upload" on storage.objects;
create policy "%1$s owner upload"
        on storage.objects for insert
        to authenticated
        with check (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text);
    $f$, b);

    execute format($f$
      drop policy if exists "%1$s owner delete" on storage.objects;
create policy "%1$s owner delete"
        on storage.objects for delete
        to authenticated
        using (bucket_id = '%1$s' and (storage.foldername(name))[1] = auth.uid()::text);
    $f$, b);
  end loop;
exception when duplicate_object then
  null; -- safe to re-run
end $$;

-- ── 2. PHOTOS ────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url text;
alter table public.posts add column if not exists photo_url text;
alter table public.events add column if not exists photo_url text;

-- ── 3. VOICE NOTES ───────────────────────────────────────────────────────────
alter table public.messages add column if not exists audio_url text;
alter table public.messages add column if not exists audio_seconds int;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check
  check (
    (audio_url is not null) or (char_length(content) between 1 and 2000)
  );
alter table public.messages alter column content set default '';

-- ── 4. STORIES (24h disappearing updates) ───────────────────────────────────
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text default '',
  image_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint story_has_content check (image_url is not null or char_length(content) > 0)
);
create index if not exists idx_stories_author on public.stories(author_id, expires_at);

alter table public.stories enable row level security;

-- Visible to yourself and anyone you're an accepted connection with, and only
-- while unexpired — mirrors the ephemeral, close-friends feel of the format.
drop policy if exists "stories viewable by self or accepted connections" on public.stories;
create policy "stories viewable by self or accepted connections"
  on public.stories for select
  to authenticated
  using (
    expires_at > now()
    and (
      author_id = auth.uid()
      or exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and (
            (c.requester_id = auth.uid() and c.addressee_id = author_id)
            or (c.addressee_id = auth.uid() and c.requester_id = author_id)
          )
      )
    )
  );

drop policy if exists "post your own story" on public.stories;
create policy "post your own story"
  on public.stories for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "delete your own story" on public.stories;
create policy "delete your own story"
  on public.stories for delete
  to authenticated
  using (auth.uid() = author_id);

do $$
begin
  alter publication supabase_realtime add table public.stories;
exception when duplicate_object then
  null; -- already added by a previous run, safe to ignore
end $$;

-- ── 5. RECURRING EVENTS ──────────────────────────────────────────────────────
alter table public.events add column if not exists recurrence text not null default 'none'
  check (recurrence in ('none', 'weekly', 'biweekly', 'monthly'));
alter table public.events add column if not exists parent_event_id uuid references public.events(id) on delete cascade;

-- Given one event, creates its next N occurrences (host-triggered from the
-- client rather than a background cron job, to keep this simple to run on
-- Supabase's free tier with no scheduled functions).
create or replace function public.generate_recurring_events(p_event_id uuid, p_count int default 4)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  ev record;
  step interval;
  i int;
begin
  select * into ev from public.events where id = p_event_id;
  if ev.id is null or ev.recurrence = 'none' then
    return;
  end if;

  step := case ev.recurrence
    when 'weekly' then interval '7 days'
    when 'biweekly' then interval '14 days'
    when 'monthly' then interval '1 month'
  end;

  for i in 1..p_count loop
    insert into public.events (host_id, title, description, location, starts_at, recurrence, parent_event_id, photo_url)
    values (ev.host_id, ev.title, ev.description, ev.location, ev.starts_at + (step * i), 'none', ev.id, ev.photo_url);
  end loop;
end;
$$;

-- ── 6. COMMENT REACTIONS ─────────────────────────────────────────────────────
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('🔥','❤️','😂','👀')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_reactions enable row level security;

drop policy if exists "comment reactions viewable by authenticated users" on public.comment_reactions;
create policy "comment reactions viewable by authenticated users"
  on public.comment_reactions for select
  to authenticated
  using (true);

drop policy if exists "react to a comment" on public.comment_reactions;
create policy "react to a comment"
  on public.comment_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "change own comment reaction" on public.comment_reactions;
create policy "change own comment reaction"
  on public.comment_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "remove own comment reaction" on public.comment_reactions;
create policy "remove own comment reaction"
  on public.comment_reactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── 8. SURFACE avatar_url IN THE RPCS (column just added above in this file) ─
drop function if exists public.nearby_profiles(double precision, double precision, double precision);
create or replace function public.nearby_profiles(origin_lat double precision, origin_lng double precision, radius_km double precision default 5)
returns table (
  id uuid, name text, initials text, avatar_bg text, avatar_fg text, avatar_url text,
  area text, interests text[], last_seen timestamptz, distance_km double precision,
  mood_emoji text, mood_text text
)
language sql stable
as $$
  with distances as (
    select
      p.id, p.name, p.initials, p.avatar_bg, p.avatar_fg, p.avatar_url, p.area, p.interests, p.last_seen,
      (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(origin_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(origin_lng))
            + sin(radians(origin_lat)) * sin(radians(p.lat))
          ))
        )
      ) as distance_km,
      p.mood_emoji, p.mood_text
    from public.profiles p
    where p.lat is not null and p.lng is not null and p.id <> auth.uid()
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
  )
  select * from distances
  where distance_km <= radius_km
  order by distance_km asc;
$$;

drop function if exists public.nearby_leaderboard(double precision, double precision, double precision);
create or replace function public.nearby_leaderboard(origin_lat double precision, origin_lng double precision, radius_km double precision default 5)
returns table (
  id uuid, name text, initials text, avatar_bg text, avatar_fg text, avatar_url text,
  connection_count bigint, best_streak int
)
language sql stable
security definer set search_path = public
as $$
  with nearby as (
    select p.id, p.name, p.initials, p.avatar_bg, p.avatar_fg, p.avatar_url
    from public.profiles p
    where p.lat is not null and p.lng is not null
      and (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(origin_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(origin_lng))
            + sin(radians(origin_lat)) * sin(radians(p.lat))
          ))
        )
      ) <= radius_km
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
  )
  select
    n.id, n.name, n.initials, n.avatar_bg, n.avatar_fg, n.avatar_url,
    count(c.id) as connection_count,
    coalesce(max(c.streak_count), 0) as best_streak
  from nearby n
  left join public.connections c
    on c.status = 'accepted' and (c.requester_id = n.id or c.addressee_id = n.id)
  group by n.id, n.name, n.initials, n.avatar_bg, n.avatar_fg, n.avatar_url
  order by connection_count desc, best_streak desc
  limit 10;
$$;

-- ── 9. PUSH NOTIFICATION SUBSCRIPTIONS ───────────────────────────────────────
-- Stores browser Web Push subscriptions. Sending the actual push (on new
-- message / connection accepted / event reminder) happens from a Next.js API
-- route using these rows and the standard Web Push protocol — see
-- PUSH_SETUP.md for the one-time VAPID key generation step you'll need to do
-- yourself (no third-party account required, just a free local command).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

drop policy if exists "manage own push subscriptions" on public.push_subscriptions;
create policy "manage own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
