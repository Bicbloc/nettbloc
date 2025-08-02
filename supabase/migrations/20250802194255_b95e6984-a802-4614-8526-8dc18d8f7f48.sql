-- Ajouter le champ suspension_reason à la table profiles
ALTER TABLE public.profiles 
ADD COLUMN suspension_reason TEXT;

-- Créer la table de relation utilisateur-établissement pour gérer les utilisateurs multiples par hôtel
CREATE TABLE public.hotel_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(hotel_id, user_id)
);

-- Activer RLS sur la table hotel_users
ALTER TABLE public.hotel_users ENABLE ROW LEVEL SECURITY;

-- Politique pour que les super admins puissent tout voir
CREATE POLICY "Super admins can manage all hotel_users" 
ON public.hotel_users 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Politique pour que les propriétaires d'hôtel puissent gérer leurs utilisateurs
CREATE POLICY "Hotel owners can manage their users" 
ON public.hotel_users 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_users.hotel_id 
    AND h.user_id = auth.uid()
  )
);

-- Fonction pour migrer les données existantes (associer les hôtels existants à leurs propriétaires)
INSERT INTO public.hotel_users (hotel_id, user_id, role, created_by)
SELECT h.id, h.user_id, 'owner', h.user_id
FROM public.hotels h
WHERE h.user_id IS NOT NULL
ON CONFLICT (hotel_id, user_id) DO NOTHING;