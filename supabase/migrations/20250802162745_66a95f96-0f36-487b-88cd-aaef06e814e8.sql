-- Fonction pour supprimer toutes les femmes de chambre et leurs codes d'accès
CREATE OR REPLACE FUNCTION public.cleanup_all_housekeepers_for_hotel(p_hotel_id uuid)
RETURNS TABLE(deleted_housekeepers int, deleted_codes int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  housekeeper_count int;
  code_count int;
BEGIN
  -- Compter les codes d'accès avant suppression
  SELECT COUNT(*) INTO code_count 
  FROM public.housekeeper_access_codes 
  WHERE hotel_id = p_hotel_id;
  
  -- Compter les femmes de chambre avant suppression
  SELECT COUNT(*) INTO housekeeper_count 
  FROM public.housekeepers 
  WHERE hotel_id = p_hotel_id;
  
  -- Supprimer tous les codes d'accès pour cet hôtel
  DELETE FROM public.housekeeper_access_codes 
  WHERE hotel_id = p_hotel_id;
  
  -- Supprimer toutes les femmes de chambre pour cet hôtel
  DELETE FROM public.housekeepers 
  WHERE hotel_id = p_hotel_id;
  
  -- Nettoyer les sessions actives et les tokens
  DELETE FROM public.housekeeper_tokens 
  WHERE housekeeper_id IN (
    SELECT id FROM public.housekeepers WHERE hotel_id = p_hotel_id
  );
  
  RETURN QUERY SELECT housekeeper_count, code_count;
END;
$$;