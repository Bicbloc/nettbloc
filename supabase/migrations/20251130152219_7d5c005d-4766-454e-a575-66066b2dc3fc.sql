-- Phase 1: Lien direct Compte → Hôtel
-- Ajouter colonne current_hotel_id au profil pour lien direct

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_current_hotel_id ON public.profiles(current_hotel_id);

-- Mettre à jour les profils existants avec leur hôtel (premier hôtel trouvé)
UPDATE public.profiles p
SET current_hotel_id = (
  SELECT h.id 
  FROM public.hotels h 
  WHERE h.user_id = p.id 
  LIMIT 1
)
WHERE p.current_hotel_id IS NULL;

-- Fonction pour mettre à jour automatiquement current_hotel_id lors de la création d'hôtel
CREATE OR REPLACE FUNCTION public.update_profile_hotel_on_hotel_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mettre à jour le profil avec le nouvel hôtel si c'est le premier
  UPDATE public.profiles
  SET current_hotel_id = NEW.id
  WHERE id = NEW.user_id 
    AND current_hotel_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Trigger pour appeler la fonction
DROP TRIGGER IF EXISTS trigger_update_profile_hotel ON public.hotels;
CREATE TRIGGER trigger_update_profile_hotel
  AFTER INSERT ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_hotel_on_hotel_insert();