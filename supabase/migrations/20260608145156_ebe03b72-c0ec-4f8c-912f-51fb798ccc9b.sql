DROP POLICY IF EXISTS "Governesses can view their assignments" ON public.daily_governess_assignments;

CREATE POLICY "Governesses can view their assignments"
ON public.daily_governess_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.governess_profiles gp
    WHERE gp.id = daily_governess_assignments.governess_profile_id
      AND lower(gp.email) = lower(auth.email())
  )
);