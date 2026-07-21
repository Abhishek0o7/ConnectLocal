-- ============================================================================
-- LocalConnect — Row Level Security policies
-- Run this AFTER schema.sql. Without this, anyone with your anon key could
-- read or write any row in the database — this file is not optional.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.events enable row level security;
alter table public.event_requests enable row level security;

-- ── PROFILES ────────────────────────────────────────────────────────────────
-- This is a discovery app: any signed-in user can see any profile's public
-- fields. Users can only edit their own row.
create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── CONNECTIONS ──────────────────────────────────────────────────────────────
create policy "view own connections"
  on public.connections for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "send a connection request"
  on public.connections for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "respond to or cancel a connection"
  on public.connections for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "cancel own pending request"
  on public.connections for delete
  to authenticated
  using (auth.uid() = requester_id);

-- ── MESSAGES ─────────────────────────────────────────────────────────────────
-- Only accepted connections can message each other.
create policy "view own messages"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "send message only to accepted connection"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and (
          (c.requester_id = auth.uid() and c.addressee_id = receiver_id)
          or (c.addressee_id = auth.uid() and c.requester_id = receiver_id)
        )
    )
  );

create policy "mark received messages as read"
  on public.messages for update
  to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- ── POSTS ────────────────────────────────────────────────────────────────────
create policy "posts are viewable by authenticated users"
  on public.posts for select
  to authenticated
  using (true);

create policy "create own post"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "update or delete own post"
  on public.posts for update
  to authenticated
  using (auth.uid() = author_id);

create policy "delete own post"
  on public.posts for delete
  to authenticated
  using (auth.uid() = author_id);

-- ── POST LIKES ───────────────────────────────────────────────────────────────
create policy "likes are viewable by authenticated users"
  on public.post_likes for select
  to authenticated
  using (true);

create policy "like a post as self"
  on public.post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "unlike own like"
  on public.post_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── POST COMMENTS ────────────────────────────────────────────────────────────
create policy "comments are viewable by authenticated users"
  on public.post_comments for select
  to authenticated
  using (true);

create policy "comment as self"
  on public.post_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "delete own comment"
  on public.post_comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- ── EVENTS ───────────────────────────────────────────────────────────────────
create policy "events are viewable by authenticated users"
  on public.events for select
  to authenticated
  using (true);

create policy "host own event"
  on public.events for insert
  to authenticated
  with check (auth.uid() = host_id);

create policy "update or delete own event"
  on public.events for update
  to authenticated
  using (auth.uid() = host_id);

create policy "delete own event"
  on public.events for delete
  to authenticated
  using (auth.uid() = host_id);

-- ── EVENT REQUESTS ───────────────────────────────────────────────────────────
create policy "view requests you sent or that target your event"
  on public.event_requests for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );

create policy "request to join an event"
  on public.event_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "host responds or requester cancels"
  on public.event_requests for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );
