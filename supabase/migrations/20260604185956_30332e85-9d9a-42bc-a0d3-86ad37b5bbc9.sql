-- 1. Supprimer la politique défectueuse qui référence auth.users directement
DROP POLICY IF EXISTS "Staff can view and update their own timesheets" ON public.staff_timesheets;

-- 2. Élargir la lecture des tâches d'inventaire avec can_access_hotel
DROP POLICY IF EXISTS "Housekeepers can view their assigned tasks" ON public.linen_inventory_tasks;

CREATE POLICY "Housekeepers can view their assigned tasks"
ON public.linen_inventory_tasks
FOR SELECT
USING (
  (assigned_to)::text = (get_housekeeper_profile_id())::text
  OR can_access_hotel(hotel_id)
  OR EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = linen_inventory_tasks.hotel_id
      AND has.housekeeper_profile_id = linen_inventory_tasks.assigned_to
      AND has.is_active = true
      AND has.expires_at > now()
  )
);