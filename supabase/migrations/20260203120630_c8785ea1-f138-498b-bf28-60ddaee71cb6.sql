-- Add phone and supplier_email columns to hotels table for ordering functionality
ALTER TABLE public.hotels 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS supplier_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.hotels.phone IS 'Hotel contact phone number';
COMMENT ON COLUMN public.hotels.supplier_email IS 'Default supplier email for staff orders';