
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table de configuration PMS API
CREATE TABLE public.hotel_pms_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  pms_type TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_url TEXT,
  property_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sync_frequency INTEGER NOT NULL DEFAULT 30,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'pending',
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, pms_type)
);

-- Table de logs de synchronisation
CREATE TABLE public.pms_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  pms_type TEXT NOT NULL,
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  rooms_synced INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.hotel_pms_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Only hotel owner can manage PMS configs
CREATE POLICY "Hotel owner can view PMS configs"
  ON public.hotel_pms_configs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.user_id = auth.uid()));

CREATE POLICY "Hotel owner can insert PMS configs"
  ON public.hotel_pms_configs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.user_id = auth.uid()));

CREATE POLICY "Hotel owner can update PMS configs"
  ON public.hotel_pms_configs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.user_id = auth.uid()));

CREATE POLICY "Hotel owner can delete PMS configs"
  ON public.hotel_pms_configs FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.user_id = auth.uid()));

-- RLS for sync logs
CREATE POLICY "Hotel owner can view sync logs"
  ON public.pms_sync_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.user_id = auth.uid()));

-- Service role insert for edge function
CREATE POLICY "Service role can insert sync logs"
  ON public.pms_sync_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update sync logs"
  ON public.pms_sync_logs FOR UPDATE
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_hotel_pms_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hotel_pms_configs_updated_at
  BEFORE UPDATE ON public.hotel_pms_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_hotel_pms_configs_updated_at();
