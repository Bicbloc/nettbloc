CREATE OR REPLACE FUNCTION public.is_housekeeper_for_hotel(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hotel_access_sessions has
    JOIN public.housekeeper_profiles hp ON hp.id = has.housekeeper_profile_id
    WHERE has.hotel_id = _hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
      AND lower(hp.email) = lower(auth.email())
  );
$$;

DROP POLICY IF EXISTS "Housekeeper can view hotels with active access" ON public.hotels;
CREATE POLICY "Housekeeper can view hotels with active access"
ON public.hotels
FOR SELECT
TO public
USING (public.is_housekeeper_for_hotel(id));

DROP POLICY IF EXISTS "Users can manage their hotel sessions" ON public.hotel_access_sessions;
CREATE POLICY "Users can manage their hotel sessions"
ON public.hotel_access_sessions
FOR ALL
TO public
USING (public.is_hotel_owner(hotel_id))
WITH CHECK (public.is_hotel_owner(hotel_id));

DROP POLICY IF EXISTS "Users can manage their hotel sessions" ON public.hotel_sessions;
CREATE POLICY "Users can manage their hotel sessions"
ON public.hotel_sessions
FOR ALL
TO public
USING (public.is_hotel_owner(hotel_id))
WITH CHECK (public.is_hotel_owner(hotel_id));

DROP POLICY IF EXISTS "Hotel owners can view access requests" ON public.housekeeper_access_requests;
CREATE POLICY "Hotel owners can view access requests"
ON public.housekeeper_access_requests
FOR SELECT
TO public
USING (public.is_hotel_owner(hotel_id));

DROP POLICY IF EXISTS "Hotel owners can update access requests" ON public.housekeeper_access_requests;
CREATE POLICY "Hotel owners can update access requests"
ON public.housekeeper_access_requests
FOR UPDATE
TO public
USING (public.is_hotel_owner(hotel_id))
WITH CHECK (public.is_hotel_owner(hotel_id));

DROP POLICY IF EXISTS "Hotel owners can update requests" ON public.governess_access_requests;
CREATE POLICY "Hotel owners can update requests"
ON public.governess_access_requests
FOR UPDATE
TO public
USING (public.is_hotel_owner(hotel_id))
WITH CHECK (public.is_hotel_owner(hotel_id));