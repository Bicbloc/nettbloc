-- Create storage bucket for linen scan photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'linen-scans',
  'linen-scans',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to linen-scans bucket
CREATE POLICY "Authenticated users can upload linen scans"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'linen-scans');

-- Allow public read access to linen scans
CREATE POLICY "Public read access to linen scans"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'linen-scans');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own linen scans"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'linen-scans');