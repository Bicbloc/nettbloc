-- Bucket pour stocker les bons de livraison
INSERT INTO storage.buckets (id, name, public)
VALUES ('linen-deliveries', 'linen-deliveries', false)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket
CREATE POLICY "Users can upload delivery documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'linen-deliveries' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view their delivery documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'linen-deliveries'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their delivery documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'linen-deliveries'
  AND auth.uid() IS NOT NULL
);

-- Ajouter colonne pour stocker l'URL du document
ALTER TABLE public.linen_deliveries
ADD COLUMN IF NOT EXISTS document_url TEXT;