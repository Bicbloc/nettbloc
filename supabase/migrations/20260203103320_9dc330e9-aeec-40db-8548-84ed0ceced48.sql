-- Create task templates table for recurring tasks by day of week
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location_type TEXT NOT NULL DEFAULT 'other',
  location_reference TEXT,
  assigned_to_type TEXT NOT NULL DEFAULT 'housekeeper',
  priority TEXT NOT NULL DEFAULT 'normal',
  days_of_week INTEGER[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_one_time BOOLEAN NOT NULL DEFAULT false,
  one_time_date DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comments for clarity
COMMENT ON COLUMN public.task_templates.days_of_week IS 'Array of weekday numbers: 0=Sunday, 1=Monday, 2=Tuesday, etc.';
COMMENT ON COLUMN public.task_templates.is_one_time IS 'If true, this is a one-time task for one_time_date only';
COMMENT ON COLUMN public.task_templates.assigned_to_type IS 'Type of staff: housekeeper, governess, technician';

-- Enable Row Level Security
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their hotel task templates"
ON public.task_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE hotels.id = task_templates.hotel_id 
    AND hotels.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create task templates for their hotel"
ON public.task_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE hotels.id = task_templates.hotel_id 
    AND hotels.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their hotel task templates"
ON public.task_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE hotels.id = task_templates.hotel_id 
    AND hotels.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their hotel task templates"
ON public.task_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE hotels.id = task_templates.hotel_id 
    AND hotels.user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_task_templates_updated_at
BEFORE UPDATE ON public.task_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();