-- Créer une table pour archiver les actions quotidiennes
CREATE TABLE IF NOT EXISTS public.daily_action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  action_type TEXT NOT NULL,
  actor_name TEXT,
  actor_type TEXT DEFAULT 'housekeeper',
  room_number TEXT,
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_daily_action_logs_hotel_date ON public.daily_action_logs(hotel_id, log_date);
CREATE INDEX IF NOT EXISTS idx_daily_action_logs_room ON public.daily_action_logs(room_number);
CREATE INDEX IF NOT EXISTS idx_daily_action_logs_actor ON public.daily_action_logs(actor_name);

-- Enable RLS
ALTER TABLE public.daily_action_logs ENABLE ROW LEVEL SECURITY;

-- Policies pour les propriétaires d'hôtel
CREATE POLICY "Hotel owners can view their action logs"
  ON public.daily_action_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = daily_action_logs.hotel_id AND h.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can insert action logs"
  ON public.daily_action_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Hotel owners can delete their action logs"
  ON public.daily_action_logs
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = daily_action_logs.hotel_id AND h.user_id = auth.uid()
  ));

-- Table pour archiver les journaux quotidiens
CREATE TABLE IF NOT EXISTS public.archived_daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  archive_date DATE NOT NULL,
  logs_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les archives
CREATE INDEX IF NOT EXISTS idx_archived_daily_logs_hotel_date ON public.archived_daily_logs(hotel_id, archive_date);

-- Enable RLS
ALTER TABLE public.archived_daily_logs ENABLE ROW LEVEL SECURITY;

-- Policies pour les archives
CREATE POLICY "Hotel owners can view their archived logs"
  ON public.archived_daily_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = archived_daily_logs.hotel_id AND h.user_id = auth.uid()
  ));

CREATE POLICY "Hotel owners can insert archived logs"
  ON public.archived_daily_logs
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = archived_daily_logs.hotel_id AND h.user_id = auth.uid()
  ));