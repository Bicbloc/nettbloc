-- Create the incident-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-images', 
  'incident-images', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to incident images
CREATE POLICY "Incident images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'incident-images');

-- Allow authenticated users to upload incident images
CREATE POLICY "Authenticated users can upload incident images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'incident-images');

-- Allow authenticated users to update their own incident images
CREATE POLICY "Users can update incident images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'incident-images');

-- Allow authenticated users to delete incident images
CREATE POLICY "Users can delete incident images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'incident-images');