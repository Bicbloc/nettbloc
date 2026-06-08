ALTER TABLE public.daily_governess_assignments
  ADD COLUMN IF NOT EXISTS assigned_rooms text[] NOT NULL DEFAULT '{}';