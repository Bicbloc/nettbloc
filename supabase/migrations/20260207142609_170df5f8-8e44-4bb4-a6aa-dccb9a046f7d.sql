-- Fix technician access to hotel data
-- Update can_access_hotel function to include technicians with approved access

CREATE OR REPLACE FUNCTION public.can_access_hotel(p_hotel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 
    -- User is the hotel owner
    EXISTS (
      SELECT 1 FROM hotels WHERE id = p_hotel_id AND user_id = auth.uid()
    )
    OR
    -- User is an active sub-account linked to this hotel
    EXISTS (
      SELECT 1 FROM sub_accounts 
      WHERE hotel_id = p_hotel_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
    OR
    -- User is a technician with approved access to this hotel
    EXISTS (
      SELECT 1 FROM technician_access_requests tar
      JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
      WHERE tar.hotel_id = p_hotel_id 
      AND tar.status = 'approved'
      AND tp.id = auth.uid()
    )
    OR
    -- User is a governess with active session
    EXISTS (
      SELECT 1 FROM governess_hotel_sessions ghs
      JOIN governess_profiles gp ON gp.id = ghs.governess_profile_id
      WHERE ghs.hotel_id = p_hotel_id
      AND ghs.is_active = true
      AND gp.id = auth.uid()
    )
    OR
    -- User is a housekeeper with active access session
    EXISTS (
      SELECT 1 FROM hotel_access_sessions has
      JOIN housekeeper_profiles hp ON hp.id = has.housekeeper_profile_id
      WHERE has.hotel_id = p_hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
      AND hp.id = auth.uid()
    );
END;
$$;

-- Add specific policy for technicians to update incidents
DROP POLICY IF EXISTS "Technicians can update incidents" ON incidents;
CREATE POLICY "Technicians can update incidents"
ON incidents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM technician_access_requests tar
    JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
    WHERE tar.hotel_id = incidents.hotel_id 
    AND tar.status = 'approved'
    AND tp.id = auth.uid()
  )
);

-- Add policy for technicians to view incidents
DROP POLICY IF EXISTS "Technicians can view incidents" ON incidents;
CREATE POLICY "Technicians can view incidents"
ON incidents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM technician_access_requests tar
    JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
    WHERE tar.hotel_id = incidents.hotel_id 
    AND tar.status = 'approved'
    AND tp.id = auth.uid()
  )
);

-- Add policy for technicians to insert incidents
DROP POLICY IF EXISTS "Technicians can create incidents" ON incidents;
CREATE POLICY "Technicians can create incidents"
ON incidents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM technician_access_requests tar
    JOIN technician_profiles tp ON tp.id = tar.technician_profile_id
    WHERE tar.hotel_id = incidents.hotel_id 
    AND tar.status = 'approved'
    AND tp.id = auth.uid()
  )
);