-- Helper: who can view a hotel access session row
CREATE OR REPLACE FUNCTION public.can_view_hotel_access_session(_housekeeper_profile_id uuid, _hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_hotel_owner(_hotel_id)
    OR EXISTS (SELECT 1 FROM public.housekeeper_profiles p WHERE p.id = _housekeeper_profile_id AND lower(p.email) = lower(auth.email()))
    OR EXISTS (SELECT 1 FROM public.technician_profiles p WHERE p.id = _housekeeper_profile_id AND lower(p.email) = lower(auth.email()))
    OR EXISTS (SELECT 1 FROM public.governess_profiles p WHERE p.id = _housekeeper_profile_id AND lower(p.email) = lower(auth.email()));
$$;

-- ===== hotel_access_sessions =====
DROP POLICY IF EXISTS "Anyone can view active sessions" ON public.hotel_access_sessions;
DROP POLICY IF EXISTS "Anonymous can create hotel access sessions" ON public.hotel_access_sessions;

CREATE POLICY "Owners and own staff can view sessions"
ON public.hotel_access_sessions
FOR SELECT
TO authenticated
USING (public.can_view_hotel_access_session(housekeeper_profile_id, hotel_id));

CREATE POLICY "Authenticated can create own sessions"
ON public.hotel_access_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.can_view_hotel_access_session(housekeeper_profile_id, hotel_id));

-- ===== incident_comments =====
DROP POLICY IF EXISTS "Anyone can add incident comments" ON public.incident_comments;
DROP POLICY IF EXISTS "Anyone can view incident comments" ON public.incident_comments;

CREATE POLICY "Hotel members can view incident comments"
ON public.incident_comments
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.incidents i
  WHERE i.id = incident_comments.incident_id
    AND public.can_access_hotel(i.hotel_id)
));

CREATE POLICY "Hotel members can add incident comments"
ON public.incident_comments
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.incidents i
  WHERE i.id = incident_comments.incident_id
    AND public.can_access_hotel(i.hotel_id)
));

-- ===== password_reset_logs =====
DROP POLICY IF EXISTS "Anyone can insert password reset logs" ON public.password_reset_logs;

CREATE POLICY "Users can insert their own password reset logs"
ON public.password_reset_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ===== incident reference data: restrict to authenticated =====
DROP POLICY IF EXISTS "Housekeepers can view incident types" ON public.incident_types;
CREATE POLICY "Authenticated can view incident types"
ON public.incident_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Housekeepers can view incident categories" ON public.incident_categories;
CREATE POLICY "Authenticated can view incident categories"
ON public.incident_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Housekeepers can view incident items" ON public.incident_items;
CREATE POLICY "Authenticated can view incident items"
ON public.incident_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Housekeepers can view staff roles" ON public.staff_roles;
DROP POLICY IF EXISTS "Anyone can view staff roles" ON public.staff_roles;
CREATE POLICY "Authenticated can view staff roles"
ON public.staff_roles FOR SELECT TO authenticated USING (true);

-- ===== linen_training_samples =====
DROP POLICY IF EXISTS "Allow housekeepers to view training samples" ON public.linen_training_samples;
CREATE POLICY "Hotel members can view training samples"
ON public.linen_training_samples
FOR SELECT
TO authenticated
USING (public.can_access_hotel(hotel_id));

-- ===== linen_types =====
DROP POLICY IF EXISTS "Anyone can view linen types" ON public.linen_types;

-- ===== storage: linen-deliveries =====
DROP POLICY IF EXISTS "Users can view their delivery documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their delivery documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload delivery documents" ON storage.objects;

CREATE POLICY "Hotel members can view delivery documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'linen-deliveries'
  AND public.can_access_hotel(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Hotel members can upload delivery documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'linen-deliveries'
  AND public.can_access_hotel(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Hotel members can delete delivery documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'linen-deliveries'
  AND public.can_access_hotel(((storage.foldername(name))[1])::uuid)
);