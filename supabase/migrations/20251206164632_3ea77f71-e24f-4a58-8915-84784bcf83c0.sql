-- Drop existing restrictive policies for incident_comments
DROP POLICY IF EXISTS "Hotel owners can manage incident comments" ON public.incident_comments;
DROP POLICY IF EXISTS "Anyone authenticated can add incident comments" ON public.incident_comments;
DROP POLICY IF EXISTS "Hotel staff can manage incident comments" ON public.incident_comments;

-- Create policy to allow anyone to view comments (incident must exist)
CREATE POLICY "Anyone can view incident comments"
ON public.incident_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.incidents i WHERE i.id = incident_id
  )
);

-- Create policy to allow anyone to insert comments (no auth required, just valid incident)
CREATE POLICY "Anyone can add incident comments"
ON public.incident_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.incidents i WHERE i.id = incident_id
  )
);