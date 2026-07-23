-- ============================================================================
-- LocalConnect — Gen Z feature pack, Phase 4 (photo messages in chat)
-- Run AFTER migration_genz.sql, migration_genz_v2.sql, migration_genz_v3.sql
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', true)
on conflict (id) do nothing;

do $$
begin
  drop policy if exists "chat-photos public read" on storage.objects;
  create policy "chat-photos public read"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'chat-photos');

  drop policy if exists "chat-photos owner upload" on storage.objects;
  create policy "chat-photos owner upload"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

  drop policy if exists "chat-photos owner delete" on storage.objects;
  create policy "chat-photos owner delete"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);
end $$;

alter table public.messages add column if not exists photo_url text;

-- A message now just needs *one* of content / audio_url / photo_url.
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check
  check (
    (audio_url is not null)
    or (photo_url is not null)
    or (char_length(content) between 1 and 2000)
  );
