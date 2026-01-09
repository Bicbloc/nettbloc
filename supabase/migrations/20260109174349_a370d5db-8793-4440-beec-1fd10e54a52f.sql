-- Créer le bucket pour les images d'objets trouvés
INSERT INTO storage.buckets (id, name, public)
VALUES ('lost-items', 'lost-items', true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket lost-items
CREATE POLICY "Anyone can view lost items images"
ON storage.objects FOR SELECT
USING (bucket_id = 'lost-items');

CREATE POLICY "Hotel staff can upload lost items images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lost-items' AND
  (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.housekeepers hk
      WHERE hk.user_id = auth.uid() AND hk.is_active = true
    )
  )
);

CREATE POLICY "Hotel staff can update lost items images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'lost-items' AND
  (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.housekeepers hk
      WHERE hk.user_id = auth.uid() AND hk.is_active = true
    )
  )
);

CREATE POLICY "Hotel owners can delete lost items images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lost-items' AND
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.user_id = auth.uid()
  )
);