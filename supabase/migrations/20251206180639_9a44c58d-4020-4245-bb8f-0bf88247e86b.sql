-- Politique pour permettre aux housekeepers de créer des tâches d'inventaire
CREATE POLICY "Housekeepers can create inventory tasks for themselves"
ON public.linen_inventory_tasks
FOR INSERT
WITH CHECK (
  -- L'utilisateur authentifié peut créer pour lui-même
  assigned_to::text = auth.uid()::text
  OR
  -- Ou le housekeeper a une session d'accès active
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = linen_inventory_tasks.hotel_id
    AND has.is_active = true
    AND (has.expires_at IS NULL OR has.expires_at > now())
  )
  OR
  -- Ou l'utilisateur est propriétaire de l'hôtel
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_inventory_tasks.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Politique SELECT pour que les housekeepers puissent voir leurs tâches
CREATE POLICY "Housekeepers can view their own inventory tasks"
ON public.linen_inventory_tasks
FOR SELECT
USING (
  assigned_to::text = auth.uid()::text
  OR
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = linen_inventory_tasks.hotel_id
    AND has.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_inventory_tasks.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Politique UPDATE pour les housekeepers
CREATE POLICY "Housekeepers can update their own inventory tasks"
ON public.linen_inventory_tasks
FOR UPDATE
USING (
  assigned_to::text = auth.uid()::text
  OR
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_inventory_tasks.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Politique pour linen_inventory_entries - INSERT
CREATE POLICY "Housekeepers can create inventory entries"
ON public.linen_inventory_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.linen_inventory_tasks lit
    WHERE lit.id = linen_inventory_entries.task_id
    AND (
      lit.assigned_to::text = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.hotels h
        WHERE h.id = lit.hotel_id
        AND h.user_id = auth.uid()
      )
    )
  )
);

-- Politique pour linen_inventory_entries - SELECT
CREATE POLICY "Housekeepers can view their inventory entries"
ON public.linen_inventory_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.linen_inventory_tasks lit
    WHERE lit.id = linen_inventory_entries.task_id
    AND (
      lit.assigned_to::text = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.hotels h
        WHERE h.id = lit.hotel_id
        AND h.user_id = auth.uid()
      )
    )
  )
);

-- Politique pour linen_inventory_entries - DELETE
CREATE POLICY "Housekeepers can delete their inventory entries"
ON public.linen_inventory_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.linen_inventory_tasks lit
    WHERE lit.id = linen_inventory_entries.task_id
    AND (
      lit.assigned_to::text = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.hotels h
        WHERE h.id = lit.hotel_id
        AND h.user_id = auth.uid()
      )
    )
  )
);

-- Politique pour linen_types - SELECT pour les housekeepers
CREATE POLICY "Housekeepers can view linen types for their hotel"
ON public.linen_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = linen_types.hotel_id
    AND has.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = linen_types.hotel_id
    AND h.user_id = auth.uid()
  )
);