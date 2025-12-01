-- Permettre aux femmes de chambre de créer des tâches d'inventaire pour elles-mêmes
CREATE POLICY "Housekeepers can create their own inventory tasks"
ON public.linen_inventory_tasks
FOR INSERT
TO public
WITH CHECK (
  -- L'utilisateur crée une tâche pour lui-même
  (
    assigned_to::text = get_housekeeper_profile_id()::text
  )
  OR
  -- Ou l'utilisateur a une session d'accès active pour cet hôtel
  EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = linen_inventory_tasks.hotel_id
      AND has.housekeeper_profile_id::text = linen_inventory_tasks.assigned_to::text
      AND has.is_active = true
      AND has.expires_at > now()
  )
  OR
  -- Ou l'utilisateur est une femme de chambre locale de l'hôtel
  EXISTS (
    SELECT 1 FROM housekeepers h
    WHERE h.hotel_id = linen_inventory_tasks.hotel_id
      AND h.id::text = linen_inventory_tasks.assigned_to::text
      AND h.is_active = true
  )
);