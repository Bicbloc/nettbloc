-- Allow the anonymous/authenticated Cafetière interface to read the room registry
-- when the hotel has an active access session (mirrors the rooms table policy).
CREATE POLICY "Anonymous can view registry with valid session"
ON public.hotel_rooms_registry
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = hotel_rooms_registry.hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
  )
);

GRANT SELECT ON public.hotel_rooms_registry TO anon;
GRANT SELECT ON public.hotel_rooms_registry TO authenticated;