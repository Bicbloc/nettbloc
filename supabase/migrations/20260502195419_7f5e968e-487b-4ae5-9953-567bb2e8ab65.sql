CREATE OR REPLACE FUNCTION public.is_hotel_owner(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = _hotel_id
      AND h.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Hotel owners can view sessions for their hotels" ON public.governess_hotel_sessions;
DROP POLICY IF EXISTS "Hotel owners can manage sessions for their hotels" ON public.governess_hotel_sessions;

CREATE POLICY "Hotel owners can view sessions for their hotels"
ON public.governess_hotel_sessions
FOR SELECT
USING (public.is_hotel_owner(hotel_id));

CREATE POLICY "Hotel owners can manage sessions for their hotels"
ON public.governess_hotel_sessions
FOR ALL
USING (public.is_hotel_owner(hotel_id))
WITH CHECK (public.is_hotel_owner(hotel_id));