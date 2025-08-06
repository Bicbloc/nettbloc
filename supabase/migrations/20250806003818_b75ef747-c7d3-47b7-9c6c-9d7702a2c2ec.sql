-- Allow housekeepers to search hotels by hotel_code for access requests
CREATE POLICY "Allow hotel code lookup for housekeeper access requests"
ON public.hotels
FOR SELECT
TO authenticated
USING (true);

-- This allows housekeepers to find hotels by code to make access requests
-- The policy is permissive for SELECT only to enable hotel discovery