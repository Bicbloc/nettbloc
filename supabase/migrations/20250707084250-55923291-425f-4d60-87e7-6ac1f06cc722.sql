-- Créer les tables pour le système de ménage hôtelier

-- Table des hôtels
CREATE TABLE public.hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des femmes de chambre
CREATE TABLE public.housekeepers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID,
  name TEXT NOT NULL,
  access_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_housekeepers_hotel FOREIGN KEY (hotel_id) REFERENCES public.hotels(id)
);

-- Table des mises à jour de statut des chambres
CREATE TABLE public.room_status_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID,
  housekeeper_id UUID,
  room_number TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT room_status_updates_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES public.hotels(id),
  CONSTRAINT room_status_updates_housekeeper_id_fkey FOREIGN KEY (housekeeper_id) REFERENCES public.housekeepers(id)
);

-- Activer RLS sur toutes les tables
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeepers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_status_updates ENABLE ROW LEVEL SECURITY;

-- Politiques permissives pour toutes les tables (pour simplifier)
CREATE POLICY "Allow all operations on hotels" ON public.hotels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on housekeepers" ON public.housekeepers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on room_status_updates" ON public.room_status_updates FOR ALL USING (true) WITH CHECK (true);

-- Fonction pour générer des codes d'accès à 4 chiffres
CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_hotels_updated_at
  BEFORE UPDATE ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_housekeepers_updated_at
  BEFORE UPDATE ON public.housekeepers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();