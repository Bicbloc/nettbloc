-- Add technician access to manual_tasks UPDATE policy
DROP POLICY IF EXISTS "Staff can update their assigned tasks status" ON public.manual_tasks;

CREATE POLICY "Staff can update their assigned tasks status"
ON public.manual_tasks FOR UPDATE
TO public
USING (
  (hotel_id IN (
    SELECT hotel_id FROM housekeeper_access_requests
    WHERE housekeeper_profile_id = get_housekeeper_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM governess_access_requests
    WHERE governess_profile_id IN (
      SELECT id FROM governess_profiles
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    )
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM technician_access_requests
    WHERE technician_profile_id IN (
      SELECT id FROM technician_profiles
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    )
    AND status = 'approved'
  ))
)
WITH CHECK (
  (hotel_id IN (
    SELECT hotel_id FROM housekeeper_access_requests
    WHERE housekeeper_profile_id = get_housekeeper_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM governess_access_requests
    WHERE governess_profile_id IN (
      SELECT id FROM governess_profiles
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    )
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM technician_access_requests
    WHERE technician_profile_id IN (
      SELECT id FROM technician_profiles
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
    )
    AND status = 'approved'
  ))
);