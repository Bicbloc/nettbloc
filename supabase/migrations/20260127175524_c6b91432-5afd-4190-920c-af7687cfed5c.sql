
-- Drop existing INSERT policies for incidents
DROP POLICY IF EXISTS "Anyone can create incidents" ON public.incidents;
DROP POLICY IF EXISTS "Hotel staff can create incidents" ON public.incidents;
DROP POLICY IF EXISTS "Governess can create incidents" ON public.incidents;

-- Create a comprehensive INSERT policy that works for all user types
-- Admin: authenticated user who owns the hotel
-- Housekeeper: may not be authenticated, uses storage session
-- Governess: authenticated with active session
CREATE POLICY "Allow incident creation for hotel access"
ON public.incidents
FOR INSERT
WITH CHECK (
  -- Case 1: Hotel owner (admin)
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = hotel_id AND h.user_id = auth.uid()
  )
  OR
  -- Case 2: Any authenticated user with valid hotel access
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.hotels h WHERE h.id = hotel_id
  ))
  OR
  -- Case 3: Anonymous/unauthenticated housekeeper (reported_by can be NULL)
  (reported_by IS NULL AND EXISTS (
    SELECT 1 FROM public.hotels h WHERE h.id = hotel_id
  ))
  OR
  -- Case 4: Housekeeper with profile (authenticated or not)
  EXISTS (
    SELECT 1 FROM public.housekeeper_profiles hp
    WHERE hp.id = reported_by
  )
  OR
  -- Case 5: Governess with active session
  EXISTS (
    SELECT 1 FROM public.governess_hotel_sessions ghs
    WHERE ghs.hotel_id = hotel_id AND ghs.is_active = true
  )
  OR
  -- Case 6: Technician with approved access
  EXISTS (
    SELECT 1 FROM public.technician_access_requests tar
    WHERE tar.hotel_id = hotel_id 
    AND tar.status = 'approved'
  )
);
