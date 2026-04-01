
-- Create task_comments table for threaded comments on manual tasks
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.manual_tasks(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_type TEXT NOT NULL DEFAULT 'admin',
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Hotel owners can manage comments on their tasks
CREATE POLICY "Hotel owners can manage task comments"
ON public.task_comments FOR ALL
TO authenticated
USING (
  hotel_id IN (SELECT id FROM hotels WHERE user_id = auth.uid())
  OR
  hotel_id IN (SELECT hotel_id FROM sub_accounts WHERE user_id = auth.uid() AND is_active = true)
)
WITH CHECK (
  hotel_id IN (SELECT id FROM hotels WHERE user_id = auth.uid())
  OR
  hotel_id IN (SELECT hotel_id FROM sub_accounts WHERE user_id = auth.uid() AND is_active = true)
);

-- Staff can view and add comments on tasks in their hotel
CREATE POLICY "Staff can view task comments"
ON public.task_comments FOR SELECT
TO authenticated
USING (
  hotel_id IN (
    SELECT hotel_id FROM housekeeper_access_requests
    WHERE housekeeper_profile_id = public.get_housekeeper_profile_id() AND status = 'approved'
  )
  OR hotel_id IN (
    SELECT hotel_id FROM governess_access_requests
    WHERE governess_profile_id = public.get_governess_profile_id() AND status = 'approved'
  )
  OR hotel_id IN (
    SELECT hotel_id FROM technician_access_requests
    WHERE technician_profile_id = public.get_technician_profile_id() AND status = 'approved'
  )
);

CREATE POLICY "Staff can add task comments"
ON public.task_comments FOR INSERT
TO authenticated
WITH CHECK (
  hotel_id IN (
    SELECT hotel_id FROM housekeeper_access_requests
    WHERE housekeeper_profile_id = public.get_housekeeper_profile_id() AND status = 'approved'
  )
  OR hotel_id IN (
    SELECT hotel_id FROM governess_access_requests
    WHERE governess_profile_id = public.get_governess_profile_id() AND status = 'approved'
  )
  OR hotel_id IN (
    SELECT hotel_id FROM technician_access_requests
    WHERE technician_profile_id = public.get_technician_profile_id() AND status = 'approved'
  )
);
