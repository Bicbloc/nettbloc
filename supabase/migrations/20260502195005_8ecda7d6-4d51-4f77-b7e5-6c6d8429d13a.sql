
DROP POLICY IF EXISTS "Governess can view hotels with active sessions" ON public.hotels;

CREATE POLICY "Governess can view hotels with active sessions"
  ON public.hotels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.governess_hotel_sessions ghs
      WHERE ghs.hotel_id = hotels.id
        AND ghs.is_active = true
        AND ghs.governess_profile_id = public.get_current_governess_profile_id()
    )
  );
