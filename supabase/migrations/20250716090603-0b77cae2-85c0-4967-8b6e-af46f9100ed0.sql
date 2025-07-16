-- Modifier la politique RLS pour les femmes de chambre 
-- pour permettre l'accès aux femmes de chambre de l'hôtel de l'utilisateur connecté
DROP POLICY IF EXISTS "Users can manage their own housekeepers" ON public.housekeepers;

-- Créer une nouvelle politique qui permet l'accès aux femmes de chambre
-- soit par user_id (pour les admins) soit par hotel_id (pour les utilisateurs de cet hôtel)
CREATE POLICY "Users can manage housekeepers for their hotels" 
ON public.housekeepers 
FOR ALL 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = housekeepers.hotel_id 
    AND h.user_id = auth.uid()
  )
);