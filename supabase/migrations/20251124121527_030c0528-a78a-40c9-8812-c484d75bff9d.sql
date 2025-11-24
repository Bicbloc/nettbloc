-- 1. Ajouter une policy RLS pour permettre aux femmes de chambre de voir les chambres
CREATE POLICY "Housekeepers can view rooms through access sessions"
ON public.rooms
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.hotel_access_sessions has
    WHERE has.hotel_id = rooms.hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
  )
);

-- 2. Ajouter une policy pour permettre aux femmes de chambre de mettre à jour le statut des chambres
CREATE POLICY "Housekeepers can update room status through access sessions"
ON public.rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.hotel_access_sessions has
    WHERE has.hotel_id = rooms.hotel_id
      AND has.is_active = true
      AND has.expires_at > now()
  )
);

-- 3. Créer des chambres de test pour l'hôtel ARTOIS (HTL904)
INSERT INTO public.rooms (hotel_id, room_number, status, floor, room_type, cleaning_priority, notes)
VALUES 
  ('8925d462-e1c8-4699-bcbe-cb16e5d707c1', '101', 'dirty', 1, 'standard', 1, 'Chambre standard - premier étage'),
  ('8925d462-e1c8-4699-bcbe-cb16e5d707c1', '102', 'dirty', 1, 'standard', 2, 'Prioritaire - client VIP'),
  ('8925d462-e1c8-4699-bcbe-cb16e5d707c1', '103', 'dirty', 1, 'deluxe', 1, 'Chambre deluxe avec vue'),
  ('8925d462-e1c8-4699-bcbe-cb16e5d707c1', '201', 'dirty', 2, 'standard', 3, 'Urgent - départ tardif'),
  ('8925d462-e1c8-4699-bcbe-cb16e5d707c1', '202', 'clean', 2, 'suite', 1, 'Suite présidentielle');

-- 4. Créer des assignations pour Anas
INSERT INTO public.assignments (hotel_id, room_id, housekeeper_id, housekeeper_name, status, assigned_at)
SELECT 
  '8925d462-e1c8-4699-bcbe-cb16e5d707c1',
  r.id,
  'ea0e31d7-0306-431b-8391-2128bf587e0a',
  'Anas',
  'assigned',
  now()
FROM public.rooms r
WHERE r.hotel_id = '8925d462-e1c8-4699-bcbe-cb16e5d707c1'
  AND r.status = 'dirty'
  AND r.room_number IN ('101', '102', '103', '201');