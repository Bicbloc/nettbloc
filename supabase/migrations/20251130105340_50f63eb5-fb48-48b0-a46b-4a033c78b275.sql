-- Améliorer la politique RLS pour les assignations housekeepers
-- Supprimer l'ancienne politique qui dépend des sessions expirables
DROP POLICY IF EXISTS "Housekeepers can view their own assignments" ON public.assignments;

-- Créer une nouvelle politique plus robuste
-- Les housekeepers authentifiés peuvent voir leurs assignations via:
-- 1. Match direct avec leur profile ID
-- 2. Match avec leur nom (fallback pour anciennes données)
CREATE POLICY "Housekeepers can view their own assignments" ON public.assignments
FOR SELECT TO authenticated
USING (
  -- Match avec l'ID du profil housekeeper
  housekeeper_id = (get_housekeeper_profile_id())::text
  OR
  -- Match avec le nom pour les anciennes assignations
  housekeeper_name = (
    SELECT name 
    FROM public.housekeeper_profiles 
    WHERE id = get_housekeeper_profile_id()
  )
  OR
  -- Match avec l'ID dans la table housekeepers (pour les assignations liées)
  housekeeper_id IN (
    SELECT id::text 
    FROM public.housekeepers 
    WHERE user_id = auth.uid()
  )
);