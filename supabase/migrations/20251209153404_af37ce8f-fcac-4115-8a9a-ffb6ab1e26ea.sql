-- Étape 1: Assigner le pattern Apaleo à l'hôtel "le B" au lieu de Royal Hotel
UPDATE public.report_training_patterns
SET assigned_to_hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae'
WHERE pms_type = 'apaleo'
  AND assigned_to_hotel_id = '26ffa7d9-c765-4d27-89b1-168e29c1c282';

-- Étape 4: Nettoyer les chambres parasites (07, 08 etc.) pour l'hôtel "le B"
-- Ces chambres ont été créées par erreur car le pattern n'était pas appliqué
DELETE FROM public.rooms 
WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae'
  AND room_number IN ('07', '08', '7', '8')
  AND NOT EXISTS (
    SELECT 1 FROM public.hotel_rooms_registry r 
    WHERE r.hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae' 
    AND r.room_number = rooms.room_number
    AND r.is_active = true
  );

-- Nettoyer aussi le registre si nécessaire
DELETE FROM public.hotel_rooms_registry
WHERE hotel_id = 'c37cb704-6224-4b73-bcf7-0fdb5e1790ae'
  AND room_number IN ('07', '08', '7', '8')
  AND is_active = false;