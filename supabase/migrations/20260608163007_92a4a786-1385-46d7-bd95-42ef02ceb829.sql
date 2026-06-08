
-- 1. lost-items DELETE: scope to the owning hotel via path prefix
DROP POLICY IF EXISTS "Hotel owners can delete lost items images" ON storage.objects;
CREATE POLICY "Hotel members can delete lost items images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lost-items'
  AND can_access_hotel(((storage.foldername(name))[1])::uuid)
);

-- 2. linen-images INSERT: drop both loose policies, create one scoped to hotel path
DROP POLICY IF EXISTS "Hotel owners can upload linen images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload linen images" ON storage.objects;
CREATE POLICY "Hotel members can upload linen images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'linen-images'
  AND can_access_hotel(((storage.foldername(name))[1])::uuid)
);

-- 3. linen-scans INSERT: scope to hotel path
DROP POLICY IF EXISTS "Authenticated users can upload linen scans" ON storage.objects;
CREATE POLICY "Hotel members can upload linen scans"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'linen-scans'
  AND can_access_hotel(((storage.foldername(name))[1])::uuid)
);
