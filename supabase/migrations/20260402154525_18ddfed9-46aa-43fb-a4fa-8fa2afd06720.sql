
-- Add hotel_id column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

-- Create index for hotel-based queries
CREATE INDEX IF NOT EXISTS idx_invoices_hotel_id ON public.invoices(hotel_id);

-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can download their own invoices
CREATE POLICY "Users can download their own invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policy: service role uploads (edge functions)
CREATE POLICY "Service role can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
);

-- Update RLS on invoices: super_admin can see all invoices
CREATE POLICY "Super admins can view all invoices"
ON public.invoices FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);
