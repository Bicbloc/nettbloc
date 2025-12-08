-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Hotel owners can manage their detection rules" ON hotel_detection_rules;

-- Créer une nouvelle politique avec USING et WITH CHECK
CREATE POLICY "Hotel owners can manage their detection rules"
ON hotel_detection_rules
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM hotels h 
    WHERE h.id = hotel_detection_rules.hotel_id 
    AND h.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hotels h 
    WHERE h.id = hotel_detection_rules.hotel_id 
    AND h.user_id = auth.uid()
  )
);