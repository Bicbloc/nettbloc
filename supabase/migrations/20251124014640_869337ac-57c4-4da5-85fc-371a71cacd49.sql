-- Update notifications type constraint to include all notification types used in the system
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'room-status'::text,
  'remark'::text,
  'assignment'::text,
  'cleaning-start'::text,
  'cleaning-end'::text,
  'room_completed'::text,
  'assignment_completed'::text,
  'room_urgent'::text,
  'housekeeper_request'::text,
  'housekeeper_connected'::text,
  'room_assigned'::text,
  'housekeeper_access_request'::text,
  'access_approved'::text
]));