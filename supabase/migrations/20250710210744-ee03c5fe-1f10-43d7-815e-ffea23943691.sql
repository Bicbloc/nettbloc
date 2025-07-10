-- Corriger les politiques RLS pour permettre le mode invité

-- Modifier la politique pour hotel_sessions pour permettre les sessions invités
DROP POLICY IF EXISTS "Users can manage their own hotel sessions" ON public.hotel_sessions;

CREATE POLICY "Users can manage their own hotel sessions" 
ON public.hotel_sessions 
FOR ALL
USING (
  -- Permettre si l'utilisateur est authentifié ET c'est sa session
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Permettre les sessions invités (user_id null)
  (user_id IS NULL)
);

-- Permettre l'insertion pour les sessions invités
CREATE POLICY "Allow guest sessions creation" 
ON public.hotel_sessions 
FOR INSERT 
WITH CHECK (
  -- Permettre si l'utilisateur est authentifié
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Permettre les sessions invités (user_id null)
  (user_id IS NULL)
);