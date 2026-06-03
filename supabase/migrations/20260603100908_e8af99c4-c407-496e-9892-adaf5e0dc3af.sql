CREATE TABLE public.pms_sync_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL,
  room_number TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  state TEXT NOT NULL DEFAULT 'pending',
  next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pms_sync_queue_pending
  ON public.pms_sync_queue (state, next_attempt_at)
  WHERE state = 'pending';

CREATE INDEX idx_pms_sync_queue_hotel ON public.pms_sync_queue (hotel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pms_sync_queue TO authenticated;
GRANT ALL ON public.pms_sync_queue TO service_role;

ALTER TABLE public.pms_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can view their hotel sync queue"
ON public.pms_sync_queue
FOR SELECT
TO authenticated
USING (public.can_manage_hotel_data(hotel_id));

CREATE POLICY "Establishments can enqueue for their hotel"
ON public.pms_sync_queue
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_hotel_data(hotel_id));

CREATE TRIGGER update_pms_sync_queue_updated_at
BEFORE UPDATE ON public.pms_sync_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();