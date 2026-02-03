-- Create table to track task completions
CREATE TABLE public.task_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  completed_by_id TEXT NOT NULL,
  completed_by_name TEXT NOT NULL,
  completed_by_type TEXT,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_task_completions_hotel_date ON public.task_completions(hotel_id, completion_date);
CREATE INDEX idx_task_completions_template ON public.task_completions(task_template_id, completion_date);

-- Enable Row Level Security
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view task completions for their hotels"
  ON public.task_completions
  FOR SELECT
  TO authenticated
  USING (
    hotel_id IN (
      SELECT id FROM public.hotels WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.hotel_users WHERE hotel_id = task_completions.hotel_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.housekeeper_access_requests 
      WHERE hotel_id = task_completions.hotel_id 
      AND housekeeper_profile_id IN (SELECT id FROM public.housekeeper_profiles WHERE email = auth.email())
      AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.governess_access_requests 
      WHERE hotel_id = task_completions.hotel_id 
      AND governess_profile_id IN (SELECT id FROM public.governess_profiles WHERE email = auth.email())
      AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.technician_access_requests 
      WHERE hotel_id = task_completions.hotel_id 
      AND technician_profile_id IN (SELECT id FROM public.technician_profiles WHERE email = auth.email())
      AND status = 'approved'
    )
  );

CREATE POLICY "Staff can create task completions"
  ON public.task_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    hotel_id IN (
      SELECT id FROM public.hotels WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.hotel_users WHERE hotel_id = task_completions.hotel_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.housekeeper_access_requests 
      WHERE hotel_id = task_completions.hotel_id 
      AND housekeeper_profile_id IN (SELECT id FROM public.housekeeper_profiles WHERE email = auth.email())
      AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.governess_access_requests 
      WHERE hotel_id = task_completions.hotel_id 
      AND governess_profile_id IN (SELECT id FROM public.governess_profiles WHERE email = auth.email())
      AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.technician_access_requests 
      WHERE hotel_id = task_completions.hotel_id 
      AND technician_profile_id IN (SELECT id FROM public.technician_profiles WHERE email = auth.email())
      AND status = 'approved'
    )
  );

CREATE POLICY "Staff can delete their own task completions"
  ON public.task_completions
  FOR DELETE
  TO authenticated
  USING (
    hotel_id IN (
      SELECT id FROM public.hotels WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.hotel_users WHERE hotel_id = task_completions.hotel_id AND user_id = auth.uid()
    )
    OR completed_by_id IN (
      SELECT id::text FROM public.housekeeper_profiles WHERE email = auth.email()
    )
    OR completed_by_id IN (
      SELECT id::text FROM public.governess_profiles WHERE email = auth.email()
    )
    OR completed_by_id IN (
      SELECT id::text FROM public.technician_profiles WHERE email = auth.email()
    )
  );