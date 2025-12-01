-- 1. Politique DELETE pour assignments (nettoyage admin/système)
CREATE POLICY "Anyone can delete assignments with hotel access" ON assignments
FOR DELETE USING (true);

-- 2. Modifier la politique notifications pour permettre à tous d'insérer
DROP POLICY IF EXISTS "Users can create notifications for others" ON notifications;
CREATE POLICY "Anyone can create notifications" ON notifications
FOR INSERT WITH CHECK (true);

-- 3. Politique INSERT pour incident_images
CREATE POLICY "Anyone can upload incident images" ON incident_images
FOR INSERT WITH CHECK (true);

-- 4. Politique DELETE pour linen_inventory_entries
CREATE POLICY "Anyone can delete inventory entries" ON linen_inventory_entries
FOR DELETE USING (true);

-- 5. Nettoyage des doublons d'assignations (garder la plus ancienne par chambre aujourd'hui)
DELETE FROM assignments a
WHERE a.id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY assigned_at ASC) as rn
    FROM assignments
    WHERE DATE(assigned_at) = CURRENT_DATE
  ) sub
  WHERE rn > 1
);