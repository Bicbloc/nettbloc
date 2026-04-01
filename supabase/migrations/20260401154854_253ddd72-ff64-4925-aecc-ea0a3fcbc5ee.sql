
-- Create SECURITY DEFINER function for governess profile ID (like get_housekeeper_profile_id)
CREATE OR REPLACE FUNCTION public.get_governess_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN (
    SELECT gp.id 
    FROM public.governess_profiles gp 
    JOIN auth.users u ON u.email = gp.email 
    WHERE u.id = auth.uid()
  );
END;
$$;

-- Create SECURITY DEFINER function for technician profile ID
CREATE OR REPLACE FUNCTION public.get_technician_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN (
    SELECT tp.id 
    FROM public.technician_profiles tp 
    JOIN auth.users u ON u.email = tp.email 
    WHERE u.id = auth.uid()
  );
END;
$$;

-- Drop and recreate staff SELECT policy without direct auth.users reference
DROP POLICY IF EXISTS "Staff can view their assigned tasks" ON public.manual_tasks;

CREATE POLICY "Staff can view their assigned tasks"
ON public.manual_tasks FOR SELECT
TO authenticated
USING (
  (hotel_id IN (
    SELECT hotel_id FROM housekeeper_access_requests
    WHERE housekeeper_profile_id = public.get_housekeeper_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM governess_access_requests
    WHERE governess_profile_id = public.get_governess_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM technician_access_requests
    WHERE technician_profile_id = public.get_technician_profile_id()
    AND status = 'approved'
  ))
);

-- Drop and recreate staff UPDATE policy without direct auth.users reference
DROP POLICY IF EXISTS "Staff can update their assigned tasks status" ON public.manual_tasks;

CREATE POLICY "Staff can update their assigned tasks status"
ON public.manual_tasks FOR UPDATE
TO authenticated
USING (
  (hotel_id IN (
    SELECT hotel_id FROM housekeeper_access_requests
    WHERE housekeeper_profile_id = public.get_housekeeper_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM governess_access_requests
    WHERE governess_profile_id = public.get_governess_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM technician_access_requests
    WHERE technician_profile_id = public.get_technician_profile_id()
    AND status = 'approved'
  ))
)
WITH CHECK (
  (hotel_id IN (
    SELECT hotel_id FROM housekeeper_access_requests
    WHERE housekeeper_profile_id = public.get_housekeeper_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM governess_access_requests
    WHERE governess_profile_id = public.get_governess_profile_id()
    AND status = 'approved'
  ))
  OR
  (hotel_id IN (
    SELECT hotel_id FROM technician_access_requests
    WHERE technician_profile_id = public.get_technician_profile_id()
    AND status = 'approved'
  ))
);
