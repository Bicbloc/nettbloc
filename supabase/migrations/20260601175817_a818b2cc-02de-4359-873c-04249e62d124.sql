CREATE TABLE public.pms_pending_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER,
  room_type TEXT,
  pms_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, room_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pms_pending_rooms TO authenticated;
GRANT SELECT ON public.pms_pending_rooms TO anon;
GRANT ALL ON public.pms_pending_rooms TO service_role;

ALTER TABLE public.pms_pending_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pending rooms"
ON public.pms_pending_rooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update pending rooms"
ON public.pms_pending_rooms FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete pending rooms"
ON public.pms_pending_rooms FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can insert pending rooms"
ON public.pms_pending_rooms FOR INSERT TO authenticated WITH CHECK (true);

CREATE TRIGGER update_pms_pending_rooms_updated_at
BEFORE UPDATE ON public.pms_pending_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pms_pending_rooms_hotel ON public.pms_pending_rooms(hotel_id, status);