-- Supprimer les politiques anciennes qui bloquent encore
DROP POLICY IF EXISTS "Anyone authenticated can add incident comments" ON public.incident_comments;
DROP POLICY IF EXISTS "Hotel owners can manage incident comments" ON public.incident_comments;