-- Créer le bucket pour les images d'incidents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-images',
  'incident-images',
  false, -- Privé, accessible uniquement via RLS
  10485760, -- 10MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy pour permettre l'upload
CREATE POLICY "Hotel staff can upload incident images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'incident-images' AND
  auth.uid() IS NOT NULL
);

-- RLS Policy pour permettre la lecture
CREATE POLICY "Hotel staff can view incident images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'incident-images' AND
  auth.uid() IS NOT NULL
);

-- RLS Policy pour permettre la suppression
CREATE POLICY "Hotel staff can delete incident images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'incident-images' AND
  auth.uid() IS NOT NULL
);