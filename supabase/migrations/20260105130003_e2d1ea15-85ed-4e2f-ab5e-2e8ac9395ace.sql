-- Supprimer l'ancienne contrainte de check
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- Ajouter une nouvelle contrainte avec tous les plans
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check 
  CHECK (plan = ANY (ARRAY['free', 'freemium', 'basic', 'basic_plus', 'premium', 'platinum']));

-- Mettre à jour le compte aminekhellas2@gmail.com en platinum
UPDATE profiles 
SET subscription_type = 'platinum', plan = 'platinum' 
WHERE email = 'aminekhellas2@gmail.com';