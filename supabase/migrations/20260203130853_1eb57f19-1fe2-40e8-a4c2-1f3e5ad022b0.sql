-- Drop existing policies on instruction_templates
DROP POLICY IF EXISTS "Hotel owners can manage instruction templates" ON public.instruction_templates;
DROP POLICY IF EXISTS "Users can view templates for their hotels" ON public.instruction_templates;
DROP POLICY IF EXISTS "Users can create templates for their hotels" ON public.instruction_templates;
DROP POLICY IF EXISTS "Users can update templates for their hotels" ON public.instruction_templates;
DROP POLICY IF EXISTS "Users can delete templates for their hotels" ON public.instruction_templates;

-- Create simple RLS policies that check hotel ownership directly
CREATE POLICY "Users can view instruction templates for their hotels"
ON public.instruction_templates
FOR SELECT
USING (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create instruction templates for their hotels"
ON public.instruction_templates
FOR INSERT
WITH CHECK (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update instruction templates for their hotels"
ON public.instruction_templates
FOR UPDATE
USING (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete instruction templates for their hotels"
ON public.instruction_templates
FOR DELETE
USING (
  hotel_id IN (
    SELECT id FROM public.hotels WHERE user_id = auth.uid()
  )
);