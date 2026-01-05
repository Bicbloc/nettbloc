-- Add inspection fields to rooms table
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS inspected_by TEXT;

-- Add index for faster queries on inspected rooms
CREATE INDEX IF NOT EXISTS idx_rooms_inspected_at ON public.rooms(inspected_at) WHERE inspected_at IS NOT NULL;