
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS needs_inspection boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_requested_at timestamptz DEFAULT null,
ADD COLUMN IF NOT EXISTS inspection_requested_by text DEFAULT null;
