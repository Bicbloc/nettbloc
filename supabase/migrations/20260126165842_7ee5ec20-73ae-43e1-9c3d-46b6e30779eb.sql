-- Phase 1: Fonction RPC search_hotel_by_code pour permettre la recherche d'hôtels par code
-- Cette fonction utilise SECURITY DEFINER pour bypasser RLS et retourner uniquement les infos publiques

CREATE OR REPLACE FUNCTION public.search_hotel_by_code(p_code text)
RETURNS TABLE(id uuid, name text, hotel_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.name, h.hotel_code
  FROM public.hotels h
  WHERE h.hotel_code = upper(trim(p_code))
  AND h.status IS DISTINCT FROM 'suspended';
END;
$$;

-- Accorder l'accès à la fonction pour les utilisateurs authentifiés et anonymes
GRANT EXECUTE ON FUNCTION public.search_hotel_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_hotel_by_code(text) TO anon;