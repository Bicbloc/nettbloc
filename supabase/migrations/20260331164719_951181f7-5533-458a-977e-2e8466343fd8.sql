CREATE OR REPLACE FUNCTION public.can_access_hotel(p_hotel_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      JOIN auth.users u ON u.email = tp.email
      WHERE tar.hotel_id = p_hotel_id 
      AND tar.status = 'approved'
      AND u.id = auth.uid()
    )
    OR
    -- User is a governess with active session
    EXISTS (
      SELECT 1 FROM governess_hotel_sessions ghs
      JOIN governess_profiles gp ON gp.id = ghs.governess_profile_id
      JOIN auth.users u ON u.email = gp.email
      WHERE ghs.hotel_id = p_hotel_id
      AND ghs.is_active = true
      AND u.id = auth.uid()
    )
    OR
    -- User is a housekeeper with active access session
    EXISTS (
      SELECT 1 FROM hotel_access_sessions has
      JOIN housekeeper_profiles hp ON hp.id = has.housekeeper_profile_id
      JOIN auth.users u ON u.email = hp.email
      WHERE has.hotel_id = p_hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
      AND u.id = auth.uid()
    );
END;
$function$;