-- Supprimer les anciennes policies problématiques
DROP POLICY IF EXISTS "Allow hotel lookup during setup" ON public.hotels;
DROP POLICY IF EXISTS "Users can manage their own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Restricted hotel code validation" ON public.hotels;

-- Recréer les policies sans référence à auth.users
CREATE POLICY "Users can view their own hotels" 
ON public.hotels 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can update their own hotels" 
ON public.hotels 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hotels" 
ON public.hotels 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hotels" 
ON public.hotels 
FOR DELETE 
USING (auth.uid() = user_id);