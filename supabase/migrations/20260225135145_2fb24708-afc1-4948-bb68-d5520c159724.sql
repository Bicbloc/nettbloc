ALTER TABLE public.hotel_rooms_registry 
ADD COLUMN IF NOT EXISTS space_category text DEFAULT 'room';

COMMENT ON COLUMN public.hotel_rooms_registry.space_category IS 
'room = chambre, common = espace commun, technical = espace technique';