-- Add is_twin column to rooms table for sync between admin and housekeepers
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_twin BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.rooms.is_twin IS 'Indicates if this is a twin/connected room that requires special handling';