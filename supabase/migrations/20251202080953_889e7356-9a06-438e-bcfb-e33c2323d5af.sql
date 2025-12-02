-- Supprimer l'ancienne politique trop restrictive
DROP POLICY IF EXISTS "Housekeepers can create their own inventory tasks" ON public.linen_inventory_tasks;

-- Créer une politique plus flexible pour les tâches d'inventaire
CREATE POLICY "Housekeepers can create inventory tasks"
ON public.linen_inventory_tasks
FOR INSERT
TO public
WITH CHECK (
  -- L'utilisateur est authentifié
  auth.uid() IS NOT NULL
  AND
  (
    -- Condition 1: Le profil housekeeper correspond à l'utilisateur authentifié
    assigned_to IN (
      SELECT hp.id FROM housekeeper_profiles hp
      JOIN auth.users u ON u.email = hp.email
      WHERE u.id = auth.uid()
    )
    OR
    -- Condition 2: L'utilisateur est un admin/propriétaire de l'hôtel
    EXISTS (
      SELECT 1 FROM hotels h
      WHERE h.id = linen_inventory_tasks.hotel_id
        AND h.user_id = auth.uid()
    )
    OR
    -- Condition 3: L'utilisateur a une session d'accès active pour cet hôtel
    EXISTS (
      SELECT 1 FROM hotel_access_sessions has
      WHERE has.hotel_id = linen_inventory_tasks.hotel_id
        AND has.is_active = true
        AND has.expires_at > now()
    )
  )
);

-- Politique de stockage pour les images de linge
CREATE POLICY "Authenticated users can upload linen images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'linen-images');

-- Politique pour lire les images de linge
CREATE POLICY "Anyone can view linen images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'linen-images');