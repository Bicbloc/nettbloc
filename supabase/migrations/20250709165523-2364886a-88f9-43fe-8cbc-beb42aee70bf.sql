-- Créer une table pour les sessions d'hôtel qui stocke les données PDF et configurations
CREATE TABLE public.hotel_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  ip_address INET,
  room_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  housekeeper_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  housekeeper_assignments JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_distributed BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Créer un index sur session_token pour les requêtes rapides
CREATE INDEX idx_hotel_sessions_token ON public.hotel_sessions(session_token);

-- Créer un index sur hotel_id pour les requêtes par hôtel
CREATE INDEX idx_hotel_sessions_hotel_id ON public.hotel_sessions(hotel_id);

-- Créer un index sur is_active pour filtrer les sessions actives
CREATE INDEX idx_hotel_sessions_active ON public.hotel_sessions(is_active);

-- Activer RLS
ALTER TABLE public.hotel_sessions ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre toutes les opérations (session basée sur token)
CREATE POLICY "Allow all operations on hotel_sessions" 
ON public.hotel_sessions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_hotel_sessions_updated_at
BEFORE UPDATE ON public.hotel_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION public.cleanup_expired_hotel_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.hotel_sessions 
  SET is_active = false 
  WHERE expires_at < now() AND is_active = true;
END;
$$;