ALTER TABLE public.hotel_pms_configs
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_sync_time time NOT NULL DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS last_auto_sync_date date;