-- Supprimer les chambres invalides (format 2 chiffres) pour l'hôtel ARTOIS qui utilise le format 3 chiffres
DELETE FROM public.rooms 
WHERE hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1'
  AND length(room_number) < 3;