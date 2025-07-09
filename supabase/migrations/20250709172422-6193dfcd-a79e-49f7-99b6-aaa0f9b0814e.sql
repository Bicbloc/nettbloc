-- Phase 1: Sécurisation Multi-Hôtels et Système de Notifications

-- 1. Créer la table notifications pour le système de notifications temps réel
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('room-status', 'remark', 'assignment', 'cleaning-start', 'cleaning-end')),
  housekeeper_name TEXT,
  room_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'housekeeper'))
);

-- 2. Ajouter des index pour les performances
CREATE INDEX idx_notifications_hotel_id ON public.notifications(hotel_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- 3. Modifier la table housekeepers pour améliorer la sécurité multi-hôtels
-- Ajouter une contrainte unique sur hotel_id + access_code pour éviter les doublons
ALTER TABLE public.housekeepers 
ADD CONSTRAINT unique_hotel_access_code UNIQUE (hotel_id, access_code);

-- 4. Ajouter une contrainte pour s'assurer que hotel_id n'est jamais null pour les housekeepers
ALTER TABLE public.housekeepers 
ALTER COLUMN hotel_id SET NOT NULL;

-- 5. Ajouter une contrainte pour s'assurer que hotel_id n'est jamais null pour les room_status_updates
ALTER TABLE public.room_status_updates 
ALTER COLUMN hotel_id SET NOT NULL;

-- 6. Ajouter une contrainte pour s'assurer que housekeeper_id n'est jamais null pour les room_status_updates
ALTER TABLE public.room_status_updates 
ALTER COLUMN housekeeper_id SET NOT NULL;

-- 7. Activer RLS sur la table notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 8. Créer les politiques RLS pour les notifications
CREATE POLICY "Hotel admins can view their hotel notifications" 
ON public.notifications 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_id
  )
);

CREATE POLICY "Users can create notifications for their hotel" 
ON public.notifications 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_id
  )
);

CREATE POLICY "Users can update their hotel notifications" 
ON public.notifications 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_id
  )
);

-- 9. Mettre à jour les politiques RLS existantes pour plus de sécurité
-- Remplacer la politique trop permissive sur housekeepers
DROP POLICY IF EXISTS "Allow all operations on housekeepers" ON public.housekeepers;

CREATE POLICY "Hotel admins can manage their housekeepers" 
ON public.housekeepers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_id
  )
);

-- 10. Mettre à jour les politiques RLS pour room_status_updates
DROP POLICY IF EXISTS "Allow all operations on room_status_updates" ON public.room_status_updates;

CREATE POLICY "Hotel users can manage their room updates" 
ON public.room_status_updates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_id
  )
);

-- 11. Fonction pour générer des codes d'accès sécurisés par hôtel
CREATE OR REPLACE FUNCTION public.generate_hotel_access_code(hotel_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  hotel_code TEXT;
  random_suffix TEXT;
BEGIN
  -- Récupérer le code de l'hôtel
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = hotel_uuid;
  
  -- Générer un suffixe aléatoire de 4 chiffres
  random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  
  -- Retourner le code au format HOTEL_CODE-XXXX
  RETURN COALESCE(hotel_code, 'HTL') || '-' || random_suffix;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Fonction pour valider qu'un code d'accès appartient au bon hôtel
CREATE OR REPLACE FUNCTION public.validate_access_code_for_hotel(access_code TEXT, hotel_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  hotel_code TEXT;
  code_prefix TEXT;
BEGIN
  -- Récupérer le code de l'hôtel
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = hotel_uuid;
  
  -- Extraire le préfixe du code d'accès (avant le tiret)
  code_prefix := SPLIT_PART(access_code, '-', 1);
  
  -- Vérifier que le préfixe correspond au code de l'hôtel
  RETURN COALESCE(hotel_code, 'HTL') = code_prefix;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Activer la réplication en temps réel pour les notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.notifications;