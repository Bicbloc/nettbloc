-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view training patterns" ON public.report_training_patterns;
DROP POLICY IF EXISTS "Admins can insert training patterns" ON public.report_training_patterns;
DROP POLICY IF EXISTS "Admins can update training patterns" ON public.report_training_patterns;
DROP POLICY IF EXISTS "Admins can delete training patterns" ON public.report_training_patterns;

-- Create new policies that include super admin access
CREATE POLICY "Users can view training patterns" 
ON public.report_training_patterns 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = report_training_patterns.hotel_id AND h.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can insert training patterns" 
ON public.report_training_patterns 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = report_training_patterns.hotel_id AND h.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can update training patterns" 
ON public.report_training_patterns 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = report_training_patterns.hotel_id AND h.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can delete training patterns" 
ON public.report_training_patterns 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = report_training_patterns.hotel_id AND h.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role)
);