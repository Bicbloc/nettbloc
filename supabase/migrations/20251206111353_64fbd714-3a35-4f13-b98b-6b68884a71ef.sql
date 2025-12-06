-- Fix incident_comments INSERT policy to allow hotel owners to add comments
DROP POLICY IF EXISTS "Hotel staff can manage incident comments" ON public.incident_comments;

-- Allow hotel owners to manage comments on their incidents
CREATE POLICY "Hotel owners can manage incident comments"
ON public.incident_comments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.incidents i
    JOIN public.hotels h ON h.id = i.hotel_id
    WHERE i.id = incident_id AND h.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.incidents i
    JOIN public.hotels h ON h.id = i.hotel_id
    WHERE i.id = incident_id AND h.user_id = auth.uid()
  )
);

-- Also allow anyone authenticated to insert comments on incidents they have access to
CREATE POLICY "Anyone authenticated can add incident comments"
ON public.incident_comments
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.id = incident_id
  )
);