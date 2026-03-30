
-- Drop old INSERT policy
DROP POLICY IF EXISTS "Hotel staff can insert lost items" ON public.lost_and_found;

-- Create improved INSERT policy with fallback via access requests
CREATE POLICY "Hotel staff can insert lost items" ON public.lost_and_found
FOR INSERT TO authenticated
WITH CHECK (
  -- Hotel owner
  EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = lost_and_found.hotel_id
      AND hotels.user_id = auth.uid()
  )
  -- Housekeeper linked via housekeepers table
  OR EXISTS (
    SELECT 1 FROM public.housekeepers
    WHERE housekeepers.hotel_id = lost_and_found.hotel_id
      AND housekeepers.user_id = auth.uid()
      AND housekeepers.is_active = true
  )
  -- Housekeeper with approved access request (fallback for mismatched user_id)
  OR EXISTS (
    SELECT 1 FROM public.housekeeper_access_requests har
    JOIN public.housekeeper_profiles hp ON hp.id = har.housekeeper_profile_id
    WHERE har.hotel_id = lost_and_found.hotel_id
      AND hp.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND har.status = 'approved'
  )
  -- Governess with approved access
  OR EXISTS (
    SELECT 1 FROM public.governess_access_requests gar
    WHERE gar.hotel_id = lost_and_found.hotel_id
      AND gar.governess_profile_id = auth.uid()
      AND gar.status = 'approved'
  )
  -- Sub-accounts
  OR EXISTS (
    SELECT 1 FROM public.sub_accounts sa
    WHERE sa.hotel_id = lost_and_found.hotel_id
      AND sa.user_id = auth.uid()
      AND sa.is_active = true
  )
);
