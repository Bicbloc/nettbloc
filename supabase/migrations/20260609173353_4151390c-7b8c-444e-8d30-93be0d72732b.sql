-- 1) device_push_tokens (hotel_id is text)
DROP POLICY IF EXISTS "Anyone can read device tokens" ON public.device_push_tokens;
DROP POLICY IF EXISTS "Anyone can register a device token" ON public.device_push_tokens;
DROP POLICY IF EXISTS "Anyone can update a device token" ON public.device_push_tokens;

CREATE POLICY "Hotel owners can read device tokens"
ON public.device_push_tokens
FOR SELECT
USING (public.is_hotel_owner(hotel_id::uuid));

CREATE POLICY "Devices can register a token for a real hotel"
ON public.device_push_tokens
FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = device_push_tokens.hotel_id::uuid));

CREATE POLICY "Devices can update a token for a real hotel"
ON public.device_push_tokens
FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = device_push_tokens.hotel_id::uuid))
WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = device_push_tokens.hotel_id::uuid));

-- 2) governess_hotel_sessions
DROP POLICY IF EXISTS "Governess can insert own sessions" ON public.governess_hotel_sessions;
CREATE POLICY "Governess can insert own approved sessions"
ON public.governess_hotel_sessions
FOR INSERT
WITH CHECK (
  governess_profile_id = public.get_current_governess_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.governess_access_requests gar
    WHERE gar.hotel_id = governess_hotel_sessions.hotel_id
      AND gar.governess_profile_id = public.get_current_governess_profile_id()
      AND gar.status = 'approved'
  )
);

-- 3) hotel_access_sessions
DROP POLICY IF EXISTS "Authenticated can create own sessions" ON public.hotel_access_sessions;
CREATE POLICY "Staff can create approved sessions"
ON public.hotel_access_sessions
FOR INSERT
WITH CHECK (
  public.can_view_hotel_access_session(housekeeper_profile_id, hotel_id)
  AND (
    public.is_hotel_owner(hotel_id)
    OR EXISTS (
      SELECT 1 FROM public.housekeeper_access_requests har
      WHERE har.hotel_id = hotel_access_sessions.hotel_id
        AND har.housekeeper_profile_id = hotel_access_sessions.housekeeper_profile_id
        AND har.status = 'approved'
    )
  )
);

-- 4) storage lost-items
DROP POLICY IF EXISTS "Hotel staff can upload lost items images" ON storage.objects;
DROP POLICY IF EXISTS "Hotel staff can update lost items images" ON storage.objects;

CREATE POLICY "Hotel staff can upload lost items images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lost-items'
  AND public.can_access_hotel(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Hotel staff can update lost items images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'lost-items'
  AND public.can_access_hotel(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'lost-items'
  AND public.can_access_hotel(((storage.foldername(name))[1])::uuid)
);