-- Function to get approved hotels for a technician (bypass RLS)
CREATE OR REPLACE FUNCTION get_approved_hotels_for_technician(p_technician_profile_id UUID)
RETURNS TABLE (
  hotel_id UUID,
  hotel_name TEXT,
  hotel_code TEXT,
  approved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id AS hotel_id,
    h.name AS hotel_name,
    h.hotel_code,
    tar.reviewed_at AS approved_at
  FROM technician_access_requests tar
  JOIN hotels h ON h.id = tar.hotel_id
  WHERE tar.technician_profile_id = p_technician_profile_id
    AND tar.status = 'approved'
  ORDER BY tar.reviewed_at DESC;
END;
$$;