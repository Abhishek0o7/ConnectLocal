-- ============================================================================
-- LocalConnect — Database schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Run policies.sql immediately after this file.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ── PROFILES ────────────────────────────────────────────────────────────────
-- One row per user, created automatically when they sign up (see trigger below).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  initials text not null default '',
  avatar_bg text not null default '#EEF0FF',
  avatar_fg text not null default '#534AB7',
  area text default '',
  city text default '',
  lat double precision,
  lng double precision,
  interests text[] not null default '{}',
  bio text default '',
  last_seen timestamptz default now(),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  full_name text := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  parts text[] := regexp_split_to_array(trim(full_name), '\s+');
  initials text := upper(
    substr(parts[1], 1, 1) || case when array_length(parts,1) > 1 then substr(parts[array_length(parts,1)], 1, 1) else '' end
  );
  palette text[][] := array[
    array['#EEF0FF','#534AB7'], array['#FAECE7','#993C1D'], array['#E0FBF7','#0F6E56'],
    array['#FBEAF0','#993556'], array['#FAEEDA','#854F0B'], array['#EAF3DE','#3B6D11']
  ];
  chosen text[] := palette[1 + (abs(hashtext(new.id::text)) % array_length(palette,1))];
begin
  insert into public.profiles (id, name, initials, avatar_bg, avatar_fg)
  values (new.id, full_name, initials, chosen[1], chosen[2]);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── CONNECTIONS (friend requests) ───────────────────────────────────────────
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_connection check (requester_id <> addressee_id),
  constraint unique_pair unique (requester_id, addressee_id)
);
create index if not exists idx_connections_addressee on public.connections(addressee_id, status);
create index if not exists idx_connections_requester on public.connections(requester_id, status);

-- ── MESSAGES ─────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_messages_pair on public.messages(least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);
create index if not exists idx_messages_receiver on public.messages(receiver_id, read_at);

-- ── FEED POSTS ───────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  tag text not null default 'general' check (tag in ('general','help','found','social','sell')),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_created on public.posts(created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_post on public.post_comments(post_id, created_at);

-- ── EVENTS ───────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text default '',
  location text not null,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_starts on public.events(starts_at);

create table if not exists public.event_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint unique_event_request unique (event_id, user_id)
);
create index if not exists idx_event_requests_event on public.event_requests(event_id, status);
create index if not exists idx_event_requests_user on public.event_requests(user_id, status);

-- ── HELPER: nearby profiles by distance (haversine, in km) ──────────────────
create or replace function public.nearby_profiles(origin_lat double precision, origin_lng double precision, radius_km double precision default 5)
returns table (
  id uuid, name text, initials text, avatar_bg text, avatar_fg text,
  area text, interests text[], last_seen timestamptz, distance_km double precision
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
      ) as distance_km
    from public.profiles p
    where p.lat is not null and p.lng is not null and p.id <> auth.uid()
  )
  select * from distances
  where distance_km <= radius_km
  order by distance_km asc;
$$;

-- ── REALTIME ─────────────────────────────────────────────────────────────────
-- Enable realtime delivery for chat messages and connection status changes.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.connections;
alter publication supabase_realtime add table public.event_requests;
