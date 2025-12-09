-- Supprimer les chambres parasites (format 2 chiffres) pour l'hôtel ARTOIS qui utilise le format 3 chiffres
-- Cela inclut les chambres 01, 02, 03, 010, 011, etc.
DELETE FROM public.rooms 
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1'
  AND (
    length(room_number) < 3 
    OR room_number ~ '^0\d{2}$'  -- Exclure les formats 010, 011, etc.
  );

-- Également nettoyer le registre
DELETE FROM public.hotel_rooms_registry
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1'
  AND (
    length(room_number) < 3 
    OR room_number ~ '^0\d{2}$'
  );