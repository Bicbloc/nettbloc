-- Phase 1: Corriger les politiques RLS pour assignments
-- Permettre aux femmes de chambre de créer une assignation pour elles-mêmes
CREATE POLICY "Housekeepers can self-assign rooms" ON assignments
FOR INSERT TO authenticated
WITH CHECK (
  housekeeper_id = (get_housekeeper_profile_id())::text
  OR housekeeper_id IN (
    SELECT id::text FROM housekeepers WHERE user_id = auth.uid()
  )
);

-- Permettre aux femmes de chambre de mettre à jour leurs assignations
CREATE POLICY "Housekeepers can update their own assignments" ON assignments
FOR UPDATE TO authenticated
USING (
  housekeeper_id = (get_housekeeper_profile_id())::text
  OR housekeeper_name = (SELECT name FROM housekeeper_profiles WHERE id = get_housekeeper_profile_id())
  OR housekeeper_id IN (SELECT id::text FROM housekeepers WHERE user_id = auth.uid())
);

-- Phase 2: Corriger les politiques RLS pour notifications
-- Permettre à n'importe quel utilisateur authentifié de créer une notification
CREATE POLICY "Users can create notifications for others" ON notifications
FOR INSERT TO authenticated
WITH CHECK (true);

-- Phase 3: Nettoyer les assignations en double
-- Garder uniquement une assignation par chambre par jour
DELETE FROM assignments a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (room_id, DATE(assigned_at)) id
  FROM assignments
  ORDER BY room_id, DATE(assigned_at), created_at DESC
);