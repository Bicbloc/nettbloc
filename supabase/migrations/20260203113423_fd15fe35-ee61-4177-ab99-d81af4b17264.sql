-- Add validation columns to staff_timesheets
ALTER TABLE public.staff_timesheets
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated_by UUID,
ADD COLUMN IF NOT EXISTS validated_by_name TEXT,
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS modified_by UUID,
ADD COLUMN IF NOT EXISTS modified_by_name TEXT,
ADD COLUMN IF NOT EXISTS original_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS original_end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS housekeeper_profile_id UUID REFERENCES public.housekeeper_profiles(id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_timesheets_status ON public.staff_timesheets(status);
CREATE INDEX IF NOT EXISTS idx_staff_timesheets_work_date ON public.staff_timesheets(work_date);

-- Update RLS policies to allow housekeepers to insert their own timesheets
DROP POLICY IF EXISTS "Housekeepers can insert own timesheets" ON public.staff_timesheets;
CREATE POLICY "Housekeepers can insert own timesheets"
ON public.staff_timesheets
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Housekeepers can update own timesheets" ON public.staff_timesheets;
CREATE POLICY "Housekeepers can update own timesheets"
ON public.staff_timesheets
FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "All authenticated can read timesheets" ON public.staff_timesheets;
CREATE POLICY "All authenticated can read timesheets"
ON public.staff_timesheets
FOR SELECT
TO authenticated
USING (true);