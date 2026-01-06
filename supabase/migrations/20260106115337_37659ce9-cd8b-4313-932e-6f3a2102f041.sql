-- Create storage bucket for daily reports PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('daily-reports', 'daily-reports', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY "Hotel owners can upload their reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'daily-reports' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Hotel owners can view their reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'daily-reports'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM hotels WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Hotel owners can delete their reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'daily-reports'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM hotels WHERE user_id = auth.uid()
  )
);

-- Add pdf_url column to daily_reports table if not exists
ALTER TABLE public.daily_reports 
ADD COLUMN IF NOT EXISTS pdf_url TEXT;