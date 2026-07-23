-- ============================================================================
-- LocalConnect — Gen Z feature pack migration
-- Run this in the Supabase SQL Editor AFTER schema.sql and policies.sql have
-- already been run once. Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
--
-- Adds:
--   1. Vibe/mood status on profiles ("👀 down to hang")
--   2. Multi-emoji reactions on posts (🔥 ❤️ 😂 👀) alongside the existing like
--   3. Daily chat streaks between accepted connections (🔥 flame + count)
-- ============================================================================

-- ── 1. VIBE / MOOD STATUS ───────────────────────────────────────────────────
alter table public.profiles
  add column if not exists mood_emoji text,
  add column if not exists mood_text text,
  add column if not exists mood_set_at timestamptz;

-- Moods older than 12 hours are treated as expired in the app (checked
-- client-side against mood_set_at) so statuses feel current, like a story.

-- Update nearby_profiles() to also return mood fields.
-- Must DROP first: Postgres won't let CREATE OR REPLACE change a function's
-- return columns (only the body), so the old signature has to go first.
drop function if exists public.nearby_profiles(double precision, double precision, double precision);

create or replace function public.nearby_profiles(origin_lat double precision, origin_lng double precision, radius_km double precision default 5)
returns table (
  id uuid, name text, initials text, avatar_bg text, avatar_fg text,
  area text, interests text[], last_seen timestamptz, distance_km double precision,
  mood_emoji text, mood_text text
)
language sql stable
as $$
  with distances as (
    select
      p.id, p.name, p.initials, p.avatar_bg, p.avatar_fg, p.area, p.interests, p.last_seen,
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
  )
  select * from distances
  where distance_km <= radius_km
  order by distance_km asc;
$$;

-- ── 2. POST REACTIONS (multi-emoji, replaces single heart) ─────────────────
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('🔥','❤️','😂','👀')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id) -- one reaction per user per post; switching emoji overwrites it
);
create index if not exists idx_reactions_post on public.post_reactions(post_id);

alter table public.post_reactions enable row level security;

drop policy if exists "reactions are viewable by authenticated users" on public.post_reactions;
create policy "reactions are viewable by authenticated users"
  on public.post_reactions for select
  to authenticated
  using (true);

drop policy if exists "react to a post" on public.post_reactions;
create policy "react to a post"
  on public.post_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "change own reaction" on public.post_reactions;
create policy "change own reaction"
  on public.post_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "remove own reaction" on public.post_reactions;
create policy "remove own reaction"
  on public.post_reactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── 3. CONNECTION STREAKS ────────────────────────────────────────────────────
alter table public.connections
  add column if not exists streak_count integer not null default 0,
  add column if not exists last_interaction_date date;

-- Bumps the streak on a connection whenever both people have messaged each
-- other on two consecutive calendar days; resets to 1 if a day was missed.
create or replace function public.bump_connection_streak()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conn record;
  today date := (new.created_at at time zone 'utc')::date;
begin
  select * into conn from public.connections
  where status = 'accepted'
    and (
      (requester_id = new.sender_id and addressee_id = new.receiver_id)
      or (requester_id = new.receiver_id and addressee_id = new.sender_id)
    )
  limit 1;

  if conn.id is null then
    return new;
  end if;

  if conn.last_interaction_date is null then
    update public.connections set streak_count = 1, last_interaction_date = today where id = conn.id;
  elsif conn.last_interaction_date = today then
    -- already counted today, no change
    null;
  elsif conn.last_interaction_date = today - interval '1 day' then
    update public.connections set streak_count = conn.streak_count + 1, last_interaction_date = today where id = conn.id;
  else
    update public.connections set streak_count = 1, last_interaction_date = today where id = conn.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_message_bump_streak on public.messages;
create trigger on_message_bump_streak
  after insert on public.messages
  for each row execute function public.bump_connection_streak();

do $$
begin
  alter publication supabase_realtime add table public.post_reactions;
exception when duplicate_object then
  null; -- already added by a previous run, safe to ignore
end $$;
