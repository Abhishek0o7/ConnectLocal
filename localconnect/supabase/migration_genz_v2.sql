-- ============================================================================
-- LocalConnect — Gen Z feature pack, Phase 2 (safety + leaderboard + rate limits)
-- Run AFTER schema.sql, policies.sql, and migration_genz.sql.
-- ============================================================================

-- ── 1. BLOCK & REPORT ────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'post', 'message', 'event')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'fake_profile', 'other')),
  details text default '',
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed'))
);
create index if not exists idx_reports_target on public.reports(target_type, target_id);

alter table public.blocks enable row level security;
alter table public.reports enable row level security;

drop policy if exists "view own block list" on public.blocks;
create policy "view own block list"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "block someone" on public.blocks;
create policy "block someone"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "unblock someone" on public.blocks;
create policy "unblock someone"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "view own submitted reports" on public.reports;
create policy "view own submitted reports"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "submit a report" on public.reports;
create policy "submit a report"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Blocking hides people from discovery and cuts off messaging both ways.
-- nearby_profiles() now also excludes anyone in either direction of a block.
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

-- Enforce the block at the message layer too, in case of a stale connection.
drop policy if exists "send message only to accepted connection" on public.messages;
drop policy if exists "send message only to accepted connection" on public.messages;
create policy "send message only to accepted connection"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = sender_id and b.blocked_id = receiver_id)
         or (b.blocker_id = receiver_id and b.blocked_id = sender_id)
    )
    and exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and (
          (c.requester_id = auth.uid() and c.addressee_id = receiver_id)
          or (c.addressee_id = auth.uid() and c.requester_id = receiver_id)
        )
    )
  );

-- ── 2. RATE LIMITING ─────────────────────────────────────────────────────────
-- Generic helper: has this user inserted more than `max_count` rows into
-- `tbl` in the last `window_minutes`? Used by trigger functions below.
create or replace function public.exceeded_rate_limit(p_user_id uuid, p_table text, p_window_minutes int, p_max_count int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  cnt int;
begin
  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - ($2 || $3)::interval',
    p_table,
    case p_table
      when 'connections' then 'requester_id'
      when 'posts' then 'author_id'
      when 'event_requests' then 'user_id'
      else 'author_id'
    end
  ) into cnt using p_user_id, p_window_minutes, ' minutes';
  return cnt >= p_max_count;
end;
$$;

create or replace function public.check_connection_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.exceeded_rate_limit(new.requester_id, 'connections', 60, 20) then
    raise exception 'Too many connection requests — please wait a bit before sending more.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_connection_rate_limit on public.connections;
create trigger trg_connection_rate_limit
  before insert on public.connections
  for each row execute function public.check_connection_rate_limit();

create or replace function public.check_post_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.exceeded_rate_limit(new.author_id, 'posts', 60, 10) then
    raise exception 'Too many posts — please wait a bit before posting again.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_post_rate_limit on public.posts;
create trigger trg_post_rate_limit
  before insert on public.posts
  for each row execute function public.check_post_rate_limit();

create or replace function public.check_event_request_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.exceeded_rate_limit(new.user_id, 'event_requests', 60, 15) then
    raise exception 'Too many join requests — please wait a bit before requesting more.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_event_request_rate_limit on public.event_requests;
create trigger trg_event_request_rate_limit
  before insert on public.event_requests
  for each row execute function public.check_event_request_rate_limit();

-- ── 3. NEARBY LEADERBOARD (privacy-safe: counts only, no partner identities) ─
drop function if exists public.nearby_leaderboard(double precision, double precision, double precision);
create or replace function public.nearby_leaderboard(origin_lat double precision, origin_lng double precision, radius_km double precision default 5)
returns table (
  id uuid, name text, initials text, avatar_bg text, avatar_fg text,
  connection_count bigint, best_streak int
)
language sql stable
security definer set search_path = public
as $$
  with nearby as (
    select p.id, p.name, p.initials, p.avatar_bg, p.avatar_fg
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
    n.id, n.name, n.initials, n.avatar_bg, n.avatar_fg,
    count(c.id) as connection_count,
    coalesce(max(c.streak_count), 0) as best_streak
  from nearby n
  left join public.connections c
    on c.status = 'accepted' and (c.requester_id = n.id or c.addressee_id = n.id)
  group by n.id, n.name, n.initials, n.avatar_bg, n.avatar_fg
  order by connection_count desc, best_streak desc
  limit 10;
$$;
