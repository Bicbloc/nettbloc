-- Nettoyer les codes d'accès en double et s'assurer qu'il n'y a qu'un seul code actif par femme de chambre
-- D'abord, désactiver tous les anciens codes
UPDATE public.housekeeper_access_codes 
SET is_active = false 
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';

-- Supprimer les codes orphelins (sans housekeeper_id)
DELETE FROM public.housekeeper_access_codes 
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1' 
AND housekeeper_id IS NULL;

-- Créer un nouveau code unique pour chaque femme de chambre active
INSERT INTO public.housekeeper_access_codes (hotel_id, housekeeper_id, access_code, created_by, is_active)
SELECT 
    h.hotel_id,
    h.id as housekeeper_id,
    (SELECT hotels.hotel_code FROM public.hotels WHERE hotels.id = h.hotel_id) || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0') as access_code,
    (SELECT hotels.user_id FROM public.hotels WHERE hotels.id = h.hotel_id),
    true
FROM public.housekeepers h
WHERE h.hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1' 
AND h.is_active = true
ON CONFLICT DO NOTHING;

-- Mettre à jour la table housekeepers avec les nouveaux codes
UPDATE public.housekeepers 
SET access_code = (
    SELECT hac.access_code 
    FROM public.housekeeper_access_codes hac 
    WHERE hac.housekeeper_id = housekeepers.id 
    AND hac.is_active = true 
    LIMIT 1
)
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1' 
AND is_active = true;