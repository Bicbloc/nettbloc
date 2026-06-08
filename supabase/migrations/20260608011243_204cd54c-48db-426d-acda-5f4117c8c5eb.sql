ALTER TABLE public.daily_governess_assignments
  DROP CONSTRAINT IF EXISTS daily_governess_assignments_assignment_type_check;

ALTER TABLE public.daily_governess_assignments
  ADD CONSTRAINT daily_governess_assignments_assignment_type_check
  CHECK (assignment_type = ANY (ARRAY['floor'::text, 'housekeeper'::text, 'rooms'::text, 'mixed'::text, 'cleaningtype'::text]));