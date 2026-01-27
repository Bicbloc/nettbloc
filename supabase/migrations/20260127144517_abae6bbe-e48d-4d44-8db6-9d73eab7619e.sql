-- Créer la fonction RPC pour récupérer les hôtels approuvés d'une femme de chambre
-- Cette fonction bypass RLS et permet aux femmes de chambre de voir leurs hôtels
CREATE OR REPLACE FUNCTION public.get_approved_hotels_for_housekeeper(p_housekeeper_profile_id uuid)
RETURNS TABLE(
  hotel_id uuid,
  hotel_name text,
  hotel_code text,
  approved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (h.id)
    h.id as hotel_id,
    h.name as hotel_name,
    h.hotel_code as hotel_code,
    har.reviewed_at as approved_at
  FROM public.housekeeper_access_requests har
  JOIN public.hotels h ON h.id = har.hotel_id
  WHERE har.housekeeper_profile_id = p_housekeeper_profile_id
    AND har.status = 'approved'
    AND h.status IS DISTINCT FROM 'suspended'
  ORDER BY h.id, har.reviewed_at DESC;
END;
$$;

-- Accorder les droits d'exécution
GRANT EXECUTE ON FUNCTION public.get_approved_hotels_for_housekeeper(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_hotels_for_housekeeper(uuid) TO anon;