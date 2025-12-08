-- Drop existing policy and recreate with better access
DROP POLICY IF EXISTS "Hotel owners can manage their detection rules" ON public.hotel_detection_rules;

-- Create separate policies for SELECT, INSERT, UPDATE, DELETE
-- SELECT: owners and hotel_users can view
CREATE POLICY "Users can view detection rules" 
ON public.hotel_detection_rules 
FOR SELECT 
USING (
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
);

-- INSERT: owners and hotel_users can insert
CREATE POLICY "Users can insert detection rules" 
ON public.hotel_detection_rules 
FOR INSERT 
WITH CHECK (
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
);

-- UPDATE: owners and hotel_users can update
CREATE POLICY "Users can update detection rules" 
ON public.hotel_detection_rules 
FOR UPDATE 
USING (
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
);

-- DELETE: owners and hotel_users can delete
CREATE POLICY "Users can delete detection rules" 
ON public.hotel_detection_rules 
FOR DELETE 
USING (
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
);