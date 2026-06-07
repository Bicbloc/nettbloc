ALTER TABLE public.breakfast_logs
  ADD COLUMN IF NOT EXISTS sent_items jsonb NOT NULL DEFAULT '[]'::jsonb;