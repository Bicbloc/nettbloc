
-- Allow governesses with active sessions to view the hotels they have access to
CREATE POLICY "Governess can view hotels with active sessions"
ON public.hotels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM governess_hotel_sessions ghs
    WHERE ghs.hotel_id = hotels.id
    AND ghs.is_active = true
    AND ghs.governess_profile_id IN (
      SELECT gp.id FROM governess_profiles gp
      WHERE gp.email = (SELECT auth.email())
    )
  )
);

-- Also allow housekeepers with active sessions to view hotels
CREATE POLICY "Housekeeper can view hotels with active access"
ON public.hotels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = hotels.id
    AND has.is_active = true
    AND has.housekeeper_profile_id IN (
      SELECT hp.id FROM housekeeper_profiles hp
      WHERE hp.email = (SELECT auth.email())
    )
  )
);

-- Allow technicians with approved access to view hotels
CREATE POLICY "Technician can view hotels with approved access"
ON public.hotels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM technician_access_requests tar
    WHERE tar.hotel_id = hotels.id
    AND tar.status = 'approved'
    AND tar.technician_profile_id IN (
      SELECT tp.id FROM technician_profiles tp
      WHERE tp.email = (SELECT auth.email())
    )
  )
);
