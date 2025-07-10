-- Fonction pour réinitialiser le mot de passe
CREATE OR REPLACE FUNCTION public.request_password_reset(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier si l'utilisateur existe
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = user_email
  ) THEN
    -- Déclencher la réinitialisation par email
    -- Cette fonction sera appelée depuis le client pour déclencher l'email
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;