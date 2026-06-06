-- Breakfast billing config (one row per hotel)
CREATE TABLE public.hotel_breakfast_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  pricing_source text NOT NULL DEFAULT 'manual',
  price_per_person numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  breakfast_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_included boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id)
);

GRANT SELECT ON public.hotel_breakfast_configs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_breakfast_configs TO authenticated;
GRANT ALL ON public.hotel_breakfast_configs TO service_role;

ALTER TABLE public.hotel_breakfast_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel managers can manage breakfast config"
  ON public.hotel_breakfast_configs FOR ALL
  USING (can_access_hotel(hotel_id))
  WITH CHECK (can_access_hotel(hotel_id));

CREATE POLICY "Staff can view breakfast config via session"
  ON public.hotel_breakfast_configs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = hotel_breakfast_configs.hotel_id
      AND has.is_active = true AND has.expires_at > now()
  ));

-- Breakfast logs (one declaration per room per day)
CREATE TABLE public.breakfast_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL,
  room_number text NOT NULL,
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  people_count integer NOT NULL DEFAULT 0,
  breakfast_type text,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  included boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  logged_by text,
  pms_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, room_number, log_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.breakfast_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breakfast_logs TO authenticated;
GRANT ALL ON public.breakfast_logs TO service_role;

ALTER TABLE public.breakfast_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotel managers can manage breakfast logs"
  ON public.breakfast_logs FOR ALL
  USING (can_access_hotel(hotel_id))
  WITH CHECK (can_access_hotel(hotel_id));

CREATE POLICY "Staff can view breakfast logs via session"
  ON public.breakfast_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = breakfast_logs.hotel_id
      AND has.is_active = true AND has.expires_at > now()
  ));

CREATE POLICY "Staff can insert breakfast logs via session"
  ON public.breakfast_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = breakfast_logs.hotel_id
      AND has.is_active = true AND has.expires_at > now()
  ));

CREATE POLICY "Staff can update breakfast logs via session"
  ON public.breakfast_logs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = breakfast_logs.hotel_id
      AND has.is_active = true AND has.expires_at > now()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM hotel_access_sessions has
    WHERE has.hotel_id = breakfast_logs.hotel_id
      AND has.is_active = true AND has.expires_at > now()
  ));

-- rooms: breakfast inclusion flag
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS breakfast_included boolean NOT NULL DEFAULT false;

-- updated_at triggers
CREATE TRIGGER update_hotel_breakfast_configs_updated_at
  BEFORE UPDATE ON public.hotel_breakfast_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_breakfast_logs_updated_at
  BEFORE UPDATE ON public.breakfast_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- realtime
ALTER TABLE public.breakfast_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.breakfast_logs;