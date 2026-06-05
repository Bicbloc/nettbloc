-- 1. daily_action_logs: drop unconstrained insert policy
DROP POLICY IF EXISTS "Authenticated can insert action logs" ON public.daily_action_logs;

-- 2. linen_training_samples: drop unconstrained insert policy
DROP POLICY IF EXISTS "Allow authenticated to insert training samples" ON public.linen_training_samples;

-- 3. pms_pending_rooms: scope SELECT to hotel members
DROP POLICY IF EXISTS "Authenticated can view pending rooms" ON public.pms_pending_rooms;
CREATE POLICY "Hotel members can view pending rooms"
  ON public.pms_pending_rooms
  FOR SELECT
  TO authenticated
  USING (can_access_hotel(hotel_id));

-- 4. staff_timesheets: replace unconstrained insert with hotel-scoped check
DROP POLICY IF EXISTS "Housekeepers can insert own timesheets" ON public.staff_timesheets;
CREATE POLICY "Hotel members can insert timesheets"
  ON public.staff_timesheets
  FOR INSERT
  TO authenticated
  WITH CHECK (can_access_hotel(hotel_id));

-- 5. incident-images storage: remove public unrestricted delete/update + broad staff delete
DROP POLICY IF EXISTS "Users can delete incident images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update incident images" ON storage.objects;
DROP POLICY IF EXISTS "Hotel staff can delete incident images" ON storage.objects;

CREATE POLICY "Hotel members can delete incident images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'incident-images'
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id::text = (storage.foldername(name))[1]
        AND can_access_hotel(i.hotel_id)
    )
  );

CREATE POLICY "Hotel members can update incident images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'incident-images'
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id::text = (storage.foldername(name))[1]
        AND can_access_hotel(i.hotel_id)
    )
  );

-- 6. linen-images storage: scope delete to hotel members (path is hotelId/...)
DROP POLICY IF EXISTS "Hotel owners can delete linen images" ON storage.objects;
CREATE POLICY "Hotel members can delete linen images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'linen-images'
    AND EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id::text = (storage.foldername(name))[1]
        AND can_access_hotel(h.id)
    )
  );