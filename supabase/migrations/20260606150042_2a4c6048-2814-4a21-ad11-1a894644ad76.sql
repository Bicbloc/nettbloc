ALTER TABLE public.hotel_breakfast_configs
  ADD COLUMN IF NOT EXISTS pms_service_id text,
  ADD COLUMN IF NOT EXISTS pms_tax_code text;