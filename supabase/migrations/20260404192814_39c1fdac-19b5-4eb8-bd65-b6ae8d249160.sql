-- Fix infinite recursion: hotels <-> technician_access_requests <-> technician_profiles

-- 1) Helper function to check if user is a technician with approved access to a hotel
CREATE OR REPLACE FUNCTION public.is_technician_for_hotel(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM technician_access_requests tar
    JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
    WHERE tar.hotel_id = _hotel_id
      AND tar.status = 'approved'
      AND lower(tp.email) = lower(auth.email())
  )
$$;

-- 2) Helper function to check if user owns a hotel
CREATE OR REPLACE FUNCTION public.is_hotel_owner(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = _hotel_id AND h.user_id = auth.uid()
  )
$$;

-- 3) Replace hotels policy for technicians
DROP POLICY IF EXISTS "Technician can view hotels with approved access" ON public.hotels;
CREATE POLICY "Technician can view hotels with approved access"
ON public.hotels FOR SELECT
USING (public.is_technician_for_hotel(id));

-- 4) Replace technician_profiles policy that joins hotels
DROP POLICY IF EXISTS "Hotel admins can view their technicians" ON public.technician_profiles;
CREATE POLICY "Hotel admins can view their technicians"
ON public.technician_profiles FOR SELECT
USING (
  lower(email) = lower(auth.email())
  OR EXISTS (
    SELECT 1 FROM technician_access_requests tar
    WHERE tar.technician_profile_id = technician_profiles.id
      AND public.is_hotel_owner(tar.hotel_id)
  )
);

-- 5) Replace technician_access_requests policy that joins hotels
DROP POLICY IF EXISTS "Hotel owners can manage technician requests" ON public.technician_access_requests;
CREATE POLICY "Hotel owners can manage technician requests"
ON public.technician_access_requests FOR ALL
USING (public.is_hotel_owner(hotel_id));