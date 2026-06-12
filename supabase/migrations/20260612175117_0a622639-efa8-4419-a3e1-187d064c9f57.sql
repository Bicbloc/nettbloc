-- Enqueue room status changes into pms_sync_queue via a server-side trigger,
-- so it works regardless of who updates the room (staff via access code = anon,
-- or établissement authenticated). RLS no longer blocks staff clean statuses.

CREATE OR REPLACE FUNCTION public.enqueue_pms_room_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enqueue when the status actually changed.
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Only enqueue if the hotel has an active supported PMS config.
    IF EXISTS (
      SELECT 1 FROM public.hotel_pms_configs c
      WHERE c.hotel_id = NEW.hotel_id
        AND c.is_active = true
        AND c.pms_type IN ('apaleo', 'mews', 'mister_booking')
    ) THEN
      INSERT INTO public.pms_sync_queue (hotel_id, room_number, status)
      VALUES (NEW.hotel_id, NEW.room_number, NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_pms_room_status ON public.rooms;
CREATE TRIGGER trg_enqueue_pms_room_status
AFTER UPDATE OF status ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_pms_room_status();