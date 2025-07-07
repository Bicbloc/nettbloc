-- Create housekeepers table
CREATE TABLE public.housekeepers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  hotel_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create hotels table
CREATE TABLE public.hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room_status_updates table for real-time notifications
CREATE TABLE public.room_status_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number TEXT NOT NULL,
  status TEXT NOT NULL,
  housekeeper_id UUID REFERENCES public.housekeepers(id),
  hotel_id UUID REFERENCES public.hotels(id),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key relationship
ALTER TABLE public.housekeepers 
ADD CONSTRAINT fk_housekeepers_hotel 
FOREIGN KEY (hotel_id) REFERENCES public.hotels(id);

-- Enable Row Level Security
ALTER TABLE public.housekeepers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_status_updates ENABLE ROW LEVEL SECURITY;

-- Create policies (permissive for now, can be tightened later)
CREATE POLICY "Allow all operations on housekeepers" 
ON public.housekeepers 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on hotels" 
ON public.hotels 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on room_status_updates" 
ON public.room_status_updates 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_housekeepers_updated_at
  BEFORE UPDATE ON public.housekeepers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hotels_updated_at
  BEFORE UPDATE ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for room_status_updates
ALTER TABLE public.room_status_updates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_status_updates;