-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert detection rules" ON hotel_detection_rules;

-- Create a more permissive INSERT policy that allows hotel owners to insert
CREATE POLICY "Users can insert detection rules" ON hotel_detection_rules
FOR INSERT WITH CHECK (
  created_by = auth.uid() 
  AND (
    EXISTS (
      SELECT 1 FROM hotels h 
      WHERE h.id = hotel_detection_rules.hotel_id 
      AND h.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM hotel_users hu 
      WHERE hu.hotel_id = hotel_detection_rules.hotel_id 
      AND hu.user_id = auth.uid()
    )
  )
);