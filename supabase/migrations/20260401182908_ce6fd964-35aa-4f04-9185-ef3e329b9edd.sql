
-- Fix: Hotel admins should be able to view technician profiles via technician_access_requests (not hotel_access_sessions)
DROP POLICY IF EXISTS "Hotel admins can view their technicians" ON public.technician_profiles;

CREATE POLICY "Hotel admins can view their technicians"
ON public.technician_profiles
FOR SELECT
USING (
  -- Technician can view their own profile
  lower(email) = lower(auth.email())
  OR
  -- Hotel admin can view technicians who requested access to their hotels
  EXISTS (
    SELECT 1
    FROM technician_access_requests tar
    JOIN hotels h ON h.id = tar.hotel_id
    WHERE tar.technician_profile_id = technician_profiles.id
      AND h.user_id = auth.uid()
  )
);

-- Also fix the incidents UPDATE policy for technicians to use email matching as fallback
DROP POLICY IF EXISTS "Technicians can update incidents" ON public.incidents;

CREATE POLICY "Technicians can update incidents"
ON public.incidents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM technician_access_requests tar
    JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
    WHERE tar.hotel_id = incidents.hotel_id
      AND tar.status = 'approved'
      AND lower(tp.email) = lower(auth.email())
  )
);

-- Fix SELECT too for consistency
DROP POLICY IF EXISTS "Technicians can view incidents" ON public.incidents;

CREATE POLICY "Technicians can view incidents"
ON public.incidents
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM technician_access_requests tar
    JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
    WHERE tar.hotel_id = incidents.hotel_id
      AND tar.status = 'approved'
      AND lower(tp.email) = lower(auth.email())
  )
);

-- Fix INSERT too
DROP POLICY IF EXISTS "Technicians can create incidents" ON public.incidents;

CREATE POLICY "Technicians can create incidents"
ON public.incidents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM technician_access_requests tar
    JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
    WHERE tar.hotel_id = incidents.hotel_id
      AND tar.status = 'approved'
      AND lower(tp.email) = lower(auth.email())
  )
);
