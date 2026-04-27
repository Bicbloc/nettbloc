ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_status_check
  CHECK (status = ANY (ARRAY['new'::text, 'assigned'::text, 'in_progress'::text, 'pending_validation'::text, 'postponed'::text, 'parts_ordered'::text, 'resolved'::text, 'cancelled'::text]));