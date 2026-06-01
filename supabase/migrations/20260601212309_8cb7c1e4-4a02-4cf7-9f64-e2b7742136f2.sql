-- Align lost_and_found policies with the unified can_access_hotel() helper

DROP POLICY IF EXISTS "Hotel owners can manage their lost items" ON public.lost_and_found;
DROP POLICY IF EXISTS "Hotel staff can insert lost items" ON public.lost_and_found;
DROP POLICY IF EXISTS "Hotel staff can view and create lost items" ON public.lost_and_found;

CREATE POLICY "Hotel access can view lost items"
ON public.lost_and_found FOR SELECT TO authenticated
USING (public.can_access_hotel(hotel_id));

CREATE POLICY "Hotel access can insert lost items"
ON public.lost_and_found FOR INSERT TO authenticated
WITH CHECK (public.can_access_hotel(hotel_id));

CREATE POLICY "Hotel access can update lost items"
ON public.lost_and_found FOR UPDATE TO authenticated
USING (public.can_access_hotel(hotel_id))
WITH CHECK (public.can_access_hotel(hotel_id));

CREATE POLICY "Hotel access can delete lost items"
ON public.lost_and_found FOR DELETE TO authenticated
USING (public.can_access_hotel(hotel_id));

-- History table alignment (if present)
DROP POLICY IF EXISTS "Hotel owners can manage lost item history" ON public.lost_and_found_history;
DROP POLICY IF EXISTS "Hotel staff can insert lost item history" ON public.lost_and_found_history;
DROP POLICY IF EXISTS "Hotel staff can view lost item history" ON public.lost_and_found_history;

CREATE POLICY "Hotel access can view lost item history"
ON public.lost_and_found_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.lost_and_found lf
  WHERE lf.id = lost_and_found_history.lost_item_id
  AND public.can_access_hotel(lf.hotel_id)
));

CREATE POLICY "Hotel access can insert lost item history"
ON public.lost_and_found_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.lost_and_found lf
  WHERE lf.id = lost_and_found_history.lost_item_id
  AND public.can_access_hotel(lf.hotel_id)
));