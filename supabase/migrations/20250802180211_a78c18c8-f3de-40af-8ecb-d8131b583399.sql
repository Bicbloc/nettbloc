-- Nettoyer définitivement tous les codes dupliqués
-- Garder uniquement le code le plus récent et actif pour chaque femme de chambre

-- Désactiver tous les anciens codes
UPDATE public.housekeeper_access_codes 
SET is_active = false 
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1';

-- Supprimer complètement les codes dupliqués, garder seulement le plus récent
DELETE FROM public.housekeeper_access_codes 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY housekeeper_id 
             ORDER BY created_at DESC
           ) as rn
    FROM public.housekeeper_access_codes 
    WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1'
    AND housekeeper_id IS NOT NULL
  ) t WHERE rn > 1
);

-- Réactiver les codes restants (1 par femme de chambre)
UPDATE public.housekeeper_access_codes 
SET is_active = true 
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1'
AND housekeeper_id IS NOT NULL;

-- Mettre à jour la table housekeepers avec les codes corrects
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