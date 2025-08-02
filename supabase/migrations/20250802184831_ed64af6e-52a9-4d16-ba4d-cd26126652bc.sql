-- Ajouter un champ pour la date de fin de période d'essai
ALTER TABLE public.profiles 
ADD COLUMN trial_end_date TIMESTAMPTZ;

-- Ajouter un commentaire pour expliquer le champ
COMMENT ON COLUMN public.profiles.trial_end_date IS 'Date de fin de la période d''essai pour l''utilisateur';

-- Mettre à jour les utilisateurs existants avec une période d'essai par défaut (30 jours à partir de leur création)
UPDATE public.profiles 
SET trial_end_date = created_at + INTERVAL '30 days'
WHERE trial_end_date IS NULL AND subscription_type = 'free';