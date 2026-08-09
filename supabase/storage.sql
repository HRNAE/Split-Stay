-- ============================================================================
-- Storage setup for listing photos
-- Run AFTER creating the "listing-photos" bucket in Supabase Dashboard
-- (Storage > New bucket > name: listing-photos > Public bucket: ON)
-- ============================================================================

-- Anyone can view photos (bucket is public, but RLS on storage.objects
-- still needs an explicit policy)
create policy "listing photos are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

-- Authenticated users can upload only into a folder named after their own
-- user id (enforced by the path convention used in app/listings/new/page.tsx:
-- `${user.id}/${filename}`)
create policy "users can upload their own listing photos"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own listing photos"
  on storage.objects for delete
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
