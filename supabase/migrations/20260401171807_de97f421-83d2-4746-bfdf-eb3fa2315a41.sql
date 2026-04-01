
-- Update the notification type CHECK constraint to include task types
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'room-status'::text, 'remark'::text, 'assignment'::text, 
    'cleaning-start'::text, 'cleaning-end'::text, 'room_completed'::text, 
    'assignment_completed'::text, 'room_urgent'::text, 'housekeeper_request'::text, 
    'housekeeper_connected'::text, 'room_assigned'::text, 'housekeeper_access_request'::text, 
    'access_approved'::text, 'task_assigned'::text, 'task_reminder'::text
  ])
);

-- Update the user_type CHECK constraint to include technician and governess
ALTER TABLE public.notifications DROP CONSTRAINT notifications_user_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_type_check CHECK (
  user_type = ANY (ARRAY['admin'::text, 'housekeeper'::text, 'technician'::text, 'governess'::text])
);
