-- Drop and recreate INSERT policy to ensure created_by matches auth.uid()
DROP POLICY IF EXISTS "Users can insert detection rules" ON public.hotel_detection_rules;

CREATE POLICY "Users can insert detection rules" 
ON public.hotel_detection_rules 
FOR INSERT 
WITH CHECK (
  -- created_by must be the current user
  created_by = auth.uid()
  AND
  (
    -- And user must have access to the hotel
    EXISTS (
      SELECT 1 FROM public.hotels h 
      WHERE h.id = hotel_detection_rules.hotel_id 
      AND h.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.hotel_users hu 
      WHERE hu.hotel_id = hotel_detection_rules.hotel_id 
      AND hu.user_id = auth.uid()
    )
  )
);