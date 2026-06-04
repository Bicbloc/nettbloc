
-- Allow viewing linen types for any hotel the user can access (owner, sub-account, governess, technician, or housekeeper with active session OR approved request)
CREATE POLICY "Users can view linen types for accessible hotels"
ON public.linen_types FOR SELECT
USING (public.can_access_hotel(hotel_id));

-- Allow creating inventory tasks for accessible hotels
CREATE POLICY "Users can create inventory tasks for accessible hotels"
ON public.linen_inventory_tasks FOR INSERT
WITH CHECK (public.can_access_hotel(hotel_id));

-- Allow updating inventory tasks for accessible hotels
CREATE POLICY "Users can update inventory tasks for accessible hotels"
ON public.linen_inventory_tasks FOR UPDATE
USING (public.can_access_hotel(hotel_id))
WITH CHECK (public.can_access_hotel(hotel_id));

-- Allow viewing inventory tasks for accessible hotels (in addition to existing policies)
CREATE POLICY "Users can view inventory tasks for accessible hotels"
ON public.linen_inventory_tasks FOR SELECT
USING (public.can_access_hotel(hotel_id));

-- Allow managing inventory entries for tasks belonging to accessible hotels
CREATE POLICY "Users can create entries for accessible hotels"
ON public.linen_inventory_entries FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.linen_inventory_tasks lit
  WHERE lit.id = linen_inventory_entries.task_id
    AND public.can_access_hotel(lit.hotel_id)
));

CREATE POLICY "Users can view entries for accessible hotels"
ON public.linen_inventory_entries FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.linen_inventory_tasks lit
  WHERE lit.id = linen_inventory_entries.task_id
    AND public.can_access_hotel(lit.hotel_id)
));

CREATE POLICY "Users can update entries for accessible hotels"
ON public.linen_inventory_entries FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.linen_inventory_tasks lit
  WHERE lit.id = linen_inventory_entries.task_id
    AND public.can_access_hotel(lit.hotel_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.linen_inventory_tasks lit
  WHERE lit.id = linen_inventory_entries.task_id
    AND public.can_access_hotel(lit.hotel_id)
));

CREATE POLICY "Users can delete entries for accessible hotels"
ON public.linen_inventory_entries FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.linen_inventory_tasks lit
  WHERE lit.id = linen_inventory_entries.task_id
    AND public.can_access_hotel(lit.hotel_id)
));
