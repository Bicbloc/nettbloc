-- Drop existing policies on hotel_detection_rules
DROP POLICY IF EXISTS "Users can view detection rules" ON public.hotel_detection_rules;
DROP POLICY IF EXISTS "Users can insert detection rules" ON public.hotel_detection_rules;
DROP POLICY IF EXISTS "Users can update detection rules" ON public.hotel_detection_rules;
DROP POLICY IF EXISTS "Users can delete detection rules" ON public.hotel_detection_rules;

-- Create new policies with super_admin support
CREATE POLICY "Users can view detection rules" 
ON public.hotel_detection_rules 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = hotel_detection_rules.hotel_id AND h.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM hotel_users hu
    WHERE hu.hotel_id = hotel_detection_rules.hotel_id AND hu.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can insert detection rules" 
ON public.hotel_detection_rules 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = hotel_detection_rules.hotel_id AND h.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM hotel_users hu
    WHERE hu.hotel_id = hotel_detection_rules.hotel_id AND hu.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can update detection rules" 
ON public.hotel_detection_rules 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = hotel_detection_rules.hotel_id AND h.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM hotel_users hu
    WHERE hu.hotel_id = hotel_detection_rules.hotel_id AND hu.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can delete detection rules" 
ON public.hotel_detection_rules 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = hotel_detection_rules.hotel_id AND h.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM hotel_users hu
    WHERE hu.hotel_id = hotel_detection_rules.hotel_id AND hu.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);