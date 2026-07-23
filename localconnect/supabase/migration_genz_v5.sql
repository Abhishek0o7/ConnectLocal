-- ============================================================================
-- LocalConnect — Gen Z feature pack, Phase 5 (delete your own messages)
-- Run AFTER migration_genz.sql through migration_genz_v4.sql
-- ============================================================================

drop policy if exists "delete own sent messages" on public.messages;
create policy "delete own sent messages"
  on public.messages for delete
  to authenticated
  using (auth.uid() = sender_id);
