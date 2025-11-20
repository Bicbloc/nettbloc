-- Table pour stocker les chambres extraites des rapports PDF de manière permanente
CREATE TABLE IF NOT EXISTS public.hotel_rooms_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER,
  room_type TEXT,
  building TEXT,
  zone TEXT,
  capacity INTEGER,
  source TEXT DEFAULT 'pdf_import',
  imported_from TEXT,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(hotel_id, room_number)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_registry_hotel_id ON public.hotel_rooms_registry(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_registry_room_number ON public.hotel_rooms_registry(hotel_id, room_number);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_registry_active ON public.hotel_rooms_registry(hotel_id, is_active);

-- RLS policies
ALTER TABLE public.hotel_rooms_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel owners can view their room registry"
  ON public.hotel_rooms_registry
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = hotel_rooms_registry.hotel_id
      AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Hotel owners can manage their room registry"
  ON public.hotel_rooms_registry
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = hotel_rooms_registry.hotel_id
      AND h.user_id = auth.uid()
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_hotel_rooms_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hotel_rooms_registry_updated_at
  BEFORE UPDATE ON public.hotel_rooms_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_hotel_rooms_registry_updated_at();

-- Fonction pour fusionner/mettre à jour les chambres depuis un import PDF
CREATE OR REPLACE FUNCTION public.upsert_rooms_from_pdf(
  p_hotel_id UUID,
  p_rooms JSONB,
  p_source TEXT DEFAULT 'pdf_import'
)
RETURNS TABLE(
  inserted INTEGER,
  updated INTEGER,
  total INTEGER
) AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_room JSONB;
BEGIN
  -- Parcourir chaque chambre du JSON
  FOR v_room IN SELECT * FROM jsonb_array_elements(p_rooms)
  LOOP
    -- Insérer ou mettre à jour
    INSERT INTO public.hotel_rooms_registry (
      hotel_id,
      room_number,
      floor,
      room_type,
      building,
      zone,
      source,
      imported_from,
      last_seen_at,
      metadata
    ) VALUES (
      p_hotel_id,
      v_room->>'room_number',
      (v_room->>'floor')::INTEGER,
      v_room->>'room_type',
      v_room->>'building',
      v_room->>'zone',
      p_source,
      v_room->>'source',
      now(),
      COALESCE(v_room->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (hotel_id, room_number) DO UPDATE SET
      floor = COALESCE(EXCLUDED.floor, hotel_rooms_registry.floor),
      room_type = COALESCE(EXCLUDED.room_type, hotel_rooms_registry.room_type),
      building = COALESCE(EXCLUDED.building, hotel_rooms_registry.building),
      zone = COALESCE(EXCLUDED.zone, hotel_rooms_registry.zone),
      last_seen_at = now(),
      metadata = hotel_rooms_registry.metadata || EXCLUDED.metadata,
      is_active = true;
    
    -- Compter les insertions vs updates
    IF FOUND THEN
      v_updated := v_updated + 1;
    ELSE
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_inserted, v_updated, v_inserted + v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;