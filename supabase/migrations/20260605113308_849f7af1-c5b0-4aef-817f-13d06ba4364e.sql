-- 1. incident_types / categories / items: scope SELECT to hotel members (null hotel_id = system default, public)
DROP POLICY IF EXISTS "Authenticated can view incident types" ON public.incident_types;
CREATE POLICY "Hotel members can view incident types"
ON public.incident_types FOR SELECT TO authenticated
USING (hotel_id IS NULL OR can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "Authenticated can view incident categories" ON public.incident_categories;
CREATE POLICY "Hotel members can view incident categories"
ON public.incident_categories FOR SELECT TO authenticated
USING (hotel_id IS NULL OR can_access_hotel(hotel_id));

DROP POLICY IF EXISTS "Authenticated can view incident items" ON public.incident_items;
CREATE POLICY "Hotel members can view incident items"
ON public.incident_items FOR SELECT TO authenticated
USING (hotel_id IS NULL OR can_access_hotel(hotel_id));

-- 2. staff_roles: scope SELECT to hotel members; system roles remain public
DROP POLICY IF EXISTS "Authenticated can view staff roles" ON public.staff_roles;
CREATE POLICY "Hotel members can view staff roles"
ON public.staff_roles FOR SELECT TO authenticated
USING (hotel_id IS NULL OR is_system = true OR can_access_hotel(hotel_id));

-- 3. technician_access_requests: fix broken INSERT check
DROP POLICY IF EXISTS "Technicians can create access requests" ON public.technician_access_requests;
CREATE POLICY "Technicians can create access requests"
ON public.technician_access_requests FOR INSERT TO authenticated
WITH CHECK (technician_profile_id = get_technician_profile_id());

-- 4. incident-images storage: enforce hotel membership on upload
DROP POLICY IF EXISTS "Authenticated users can upload incident images" ON storage.objects;
DROP POLICY IF EXISTS "Hotel staff can upload incident images" ON storage.objects;
CREATE POLICY "Hotel members can upload incident images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'incident-images'
  AND EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id::text = (storage.foldername(name))[1]
      AND can_access_hotel(i.hotel_id)
  )
);

-- 5. linen-scans storage: scope DELETE to hotel members (path is hotelId/file)
DROP POLICY IF EXISTS "Users can delete own linen scans" ON storage.objects;
CREATE POLICY "Hotel members can delete linen scans"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'linen-scans'
  AND can_access_hotel(((storage.foldername(name))[1])::uuid)
);

-- 6. linen-images storage: fix broken DELETE reference (path is hotelId/type/file)
DROP POLICY IF EXISTS "Hotel members can delete linen images" ON storage.objects;
CREATE POLICY "Hotel members can delete linen images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'linen-images'
  AND can_access_hotel(((storage.foldername(name))[1])::uuid)
);