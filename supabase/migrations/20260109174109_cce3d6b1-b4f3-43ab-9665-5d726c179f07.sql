-- Table pour les objets trouvés
CREATE TABLE public.lost_and_found (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  
  -- Informations sur l'objet
  object_description TEXT NOT NULL,
  object_category TEXT DEFAULT 'other',
  image_url TEXT,
  
  -- Lieu de découverte
  location_type TEXT NOT NULL CHECK (location_type IN ('room', 'corridor', 'lobby', 'restaurant', 'pool', 'gym', 'parking', 'other')),
  room_number TEXT,
  location_details TEXT,
  
  -- Informations client (si trouvé en chambre)
  guest_name TEXT,
  guest_first_name TEXT,
  guest_check_in DATE,
  guest_check_out DATE,
  guest_email TEXT,
  guest_phone TEXT,
  
  -- Signalement
  reported_by TEXT NOT NULL,
  reported_by_type TEXT NOT NULL CHECK (reported_by_type IN ('housekeeper', 'governess', 'staff', 'admin')),
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Suivi
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',           -- En attente
    'in_progress',       -- En cours de traitement
    'guest_contacted',   -- Client contacté
    'guest_responded',   -- Client a répondu
    'not_found',         -- Personne non trouvée
    'recovered_postal_our_charge',    -- Récupéré - envoi postal à notre charge
    'recovered_postal_client_charge', -- Récupéré - envoi postal à la charge du client
    'recovered_in_person',            -- Récupéré en personne
    'closed'             -- Clôturé
  )),
  
  -- Notes et suivi
  admin_notes TEXT,
  tracking_number TEXT,
  shipping_address TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Historique des actions sur les objets trouvés
CREATE TABLE public.lost_and_found_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lost_item_id UUID NOT NULL REFERENCES public.lost_and_found(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  performed_by TEXT NOT NULL,
  performed_by_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lost_and_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_and_found_history ENABLE ROW LEVEL SECURITY;

-- Policies pour lost_and_found
CREATE POLICY "Hotel owners can manage their lost items"
ON public.lost_and_found
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = lost_and_found.hotel_id
    AND hotels.user_id = auth.uid()
  )
);

CREATE POLICY "Hotel staff can view and create lost items"
ON public.lost_and_found
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.housekeepers
    WHERE housekeepers.hotel_id = lost_and_found.hotel_id
    AND housekeepers.user_id = auth.uid()
  )
);

CREATE POLICY "Hotel staff can insert lost items"
ON public.lost_and_found
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.housekeepers
    WHERE housekeepers.hotel_id = lost_and_found.hotel_id
    AND housekeepers.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = lost_and_found.hotel_id
    AND hotels.user_id = auth.uid()
  )
);

-- Policies pour lost_and_found_history
CREATE POLICY "Hotel owners can view history"
ON public.lost_and_found_history
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.lost_and_found lf
    JOIN public.hotels h ON h.id = lf.hotel_id
    WHERE lf.id = lost_and_found_history.lost_item_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view and insert history"
ON public.lost_and_found_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lost_and_found lf
    JOIN public.housekeepers hk ON hk.hotel_id = lf.hotel_id
    WHERE lf.id = lost_and_found_history.lost_item_id
    AND hk.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert history"
ON public.lost_and_found_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lost_and_found lf
    JOIN public.housekeepers hk ON hk.hotel_id = lf.hotel_id
    WHERE lf.id = lost_and_found_history.lost_item_id
    AND hk.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.lost_and_found lf
    JOIN public.hotels h ON h.id = lf.hotel_id
    WHERE lf.id = lost_and_found_history.lost_item_id
    AND h.user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX idx_lost_and_found_hotel_id ON public.lost_and_found(hotel_id);
CREATE INDEX idx_lost_and_found_status ON public.lost_and_found(status);
CREATE INDEX idx_lost_and_found_reported_at ON public.lost_and_found(reported_at DESC);
CREATE INDEX idx_lost_and_found_history_item ON public.lost_and_found_history(lost_item_id);

-- Trigger pour updated_at
CREATE TRIGGER update_lost_and_found_updated_at
BEFORE UPDATE ON public.lost_and_found
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_and_found;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_and_found_history;