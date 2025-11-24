-- Allow hotel admins to view housekeeper profiles from access requests
CREATE POLICY "Hotel admins can view housekeepers from access requests"
ON public.housekeeper_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM housekeeper_access_requests har
    JOIN hotels h ON h.id = har.hotel_id
    WHERE h.user_id = auth.uid()
    AND har.housekeeper_profile_id = housekeeper_profiles.id
  )
);