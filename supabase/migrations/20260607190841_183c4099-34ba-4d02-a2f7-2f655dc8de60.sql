ALTER TABLE public.hotel_breakfast_configs
  ADD COLUMN IF NOT EXISTS included_rate_plan_ids text[] NOT NULL DEFAULT '{}';