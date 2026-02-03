-- Add columns for specific user assignment in task templates
ALTER TABLE public.task_templates
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID,
ADD COLUMN IF NOT EXISTS assigned_to_all BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS assigned_user_name TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.task_templates.assigned_to_user_id IS 'Specific user ID if assigned to one person';
COMMENT ON COLUMN public.task_templates.assigned_to_all IS 'If true, task is for all staff of the type; if false, only for assigned_to_user_id';
COMMENT ON COLUMN public.task_templates.assigned_user_name IS 'Cached name of the assigned user for display';