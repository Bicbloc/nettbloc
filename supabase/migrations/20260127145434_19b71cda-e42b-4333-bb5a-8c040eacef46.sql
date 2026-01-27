-- Créer une fonction RPC pour récupérer les infos d'un hôtel approuvé pour une femme de chambre
-- Cette fonction vérifie que la femme de chambre a bien une demande approuvée pour cet hôtel
CREATE OR REPLACE FUNCTION public.get_hotel_for_housekeeper(p_housekeeper_profile_id uuid, p_hotel_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  hotel_code text,
  email text,
  address text,
  settings jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que la femme de chambre a une demande approuvée pour cet hôtel
  IF NOT EXISTS (
    SELECT 1 FROM public.housekeeper_access_requests har
    WHERE har.housekeeper_profile_id = p_housekeeper_profile_id
      AND har.hotel_id = p_hotel_id
      AND har.status = 'approved'
  ) THEN
    -- Pas d'accès approuvé, retourner vide
    RETURN;
  END IF;

  -- Retourner les infos de l'hôtel
  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    h.hotel_code,
    h.email,
    h.address,
    h.settings
  FROM public.hotels h
  WHERE h.id = p_hotel_id
    AND h.status IS DISTINCT FROM 'suspended';
END;
$$;

-- Accorder les droits d'exécution
GRANT EXECUTE ON FUNCTION public.get_hotel_for_housekeeper(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hotel_for_housekeeper(uuid, uuid) TO anon;