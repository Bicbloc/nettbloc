-- Corriger l'assignation des codes d'accès
-- Lier les codes existants aux femmes de chambre correspondantes

UPDATE public.housekeeper_access_codes 
SET housekeeper_id = h.id
FROM public.housekeepers h
WHERE housekeeper_access_codes.hotel_id = h.hotel_id 
AND housekeeper_access_codes.access_code = h.access_code 
AND housekeeper_access_codes.housekeeper_id IS NULL
AND h.is_active = true;

-- Supprimer les codes orphelins (qui n'ont pas de femme de chambre correspondante)
DELETE FROM public.housekeeper_access_codes 
WHERE housekeeper_id IS NULL;