CREATE TABLE public.pms_occupancy_forecast (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL,
  forecast_date date NOT NULL,
  total_rooms integer NOT NULL DEFAULT 0,
  occupied_rooms integer NOT NULL DEFAULT 0,
  arrivals integer NOT NULL DEFAULT 0,
  departures integer NOT NULL DEFAULT 0,
  stayovers integer NOT NULL DEFAULT 0,
  occupancy_rate numeric NOT NULL DEFAULT 0,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, forecast_date)
);

GRANT SELECT ON public.pms_occupancy_forecast TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pms_occupancy_forecast TO authenticated;
GRANT ALL ON public.pms_occupancy_forecast TO service_role;

ALTER TABLE public.pms_occupancy_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view occupancy forecast"
ON public.pms_occupancy_forecast
FOR SELECT
TO authenticated
USING (can_access_hotel(hotel_id));

CREATE POLICY "Anonymous can view forecast with valid session"
ON public.pms_occupancy_forecast
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM hotel_access_sessions has
  WHERE has.hotel_id = pms_occupancy_forecast.hotel_id
    AND has.is_active = true
    AND has.expires_at > now()
));

CREATE INDEX idx_pms_occupancy_forecast_hotel_date
ON public.pms_occupancy_forecast (hotel_id, forecast_date);

CREATE TRIGGER update_pms_occupancy_forecast_updated_at
BEFORE UPDATE ON public.pms_occupancy_forecast
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();