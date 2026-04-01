
-- Recreate update policy without auth.users reference
DROP POLICY IF EXISTS "Staff can update own timesheets" ON public.staff_timesheets;

CREATE POLICY "Staff can update own timesheets" ON public.staff_timesheets
FOR UPDATE
USING (
  (staff_id = auth.uid())
  OR (housekeeper_profile_id IN (
    SELECT hp.id FROM housekeeper_profiles hp WHERE hp.email = auth.email()
  ))
  OR (EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = staff_timesheets.hotel_id AND h.user_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM sub_accounts sa WHERE sa.user_id = auth.uid() AND sa.hotel_id = staff_timesheets.hotel_id AND sa.is_active = true
  ))
)
WITH CHECK (
  (staff_id = auth.uid())
  OR (housekeeper_profile_id IN (
    SELECT hp.id FROM housekeeper_profiles hp WHERE hp.email = auth.email()
  ))
  OR (EXISTS (
    SELECT 1 FROM hotels h WHERE h.id = staff_timesheets.hotel_id AND h.user_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM sub_accounts sa WHERE sa.user_id = auth.uid() AND sa.hotel_id = staff_timesheets.hotel_id AND sa.is_active = true
  ))
);

-- Recreate staff view policy without auth.users reference
CREATE POLICY "Staff can view their own timesheets" ON public.staff_timesheets
FOR SELECT
USING (
  (hotel_id IN (
    SELECT har.hotel_id FROM housekeeper_access_requests har
    WHERE har.housekeeper_profile_id = get_housekeeper_profile_id() AND har.status = 'approved'
  ))
  OR (hotel_id IN (
    SELECT gar.hotel_id FROM governess_access_requests gar
    WHERE gar.governess_profile_id IN (
      SELECT gp.id FROM governess_profiles gp WHERE gp.email = auth.email()
    ) AND gar.status = 'approved'
  ))
  OR (hotel_id IN (
    SELECT tar.hotel_id FROM technician_access_requests tar
    WHERE tar.technician_profile_id IN (
      SELECT tp.id FROM technician_profiles tp WHERE tp.email = auth.email()
    ) AND tar.status = 'approved'
  ))
);
