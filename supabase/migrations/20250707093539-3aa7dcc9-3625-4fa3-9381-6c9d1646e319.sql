-- Add hotel_code column to hotels table
ALTER TABLE public.hotels 
ADD COLUMN hotel_code TEXT UNIQUE;

-- Create index for better performance on hotel_code lookups
CREATE INDEX idx_hotels_hotel_code ON public.hotels(hotel_code);

-- Update existing hotels with default codes (if any exist)
UPDATE public.hotels 
SET hotel_code = UPPER(SUBSTRING(replace(name, ' ', ''), 1, 8)) || '_' || EXTRACT(year from created_at)::text
WHERE hotel_code IS NULL;