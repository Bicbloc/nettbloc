-- Créer le bucket linen-images s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('linen-images', 'linen-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Allow authenticated uploads linen" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads linen" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view linen images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload linen images" ON storage.objects;

-- Policy: Permettre l'upload aux utilisateurs authentifiés
CREATE POLICY "Authenticated users can upload linen images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'linen-images' 
  AND auth.role() = 'authenticated'
);

-- Policy: Permettre la lecture publique (images sont publiques)
CREATE POLICY "Anyone can view linen images"
ON storage.objects FOR SELECT
USING (bucket_id = 'linen-images');