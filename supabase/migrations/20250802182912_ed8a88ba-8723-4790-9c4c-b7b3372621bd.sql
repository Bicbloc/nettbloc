-- Politique RLS pour permettre aux super admins de voir tous les profils
CREATE POLICY "Super admins can view all profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Politique RLS pour permettre aux super admins de modifier tous les profils
CREATE POLICY "Super admins can update all profiles" ON public.profiles
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Politique RLS pour permettre aux super admins de voir toutes les sessions
CREATE POLICY "Super admins can view all sessions" ON public.user_sessions
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Politique RLS pour permettre aux super admins de modifier toutes les sessions
CREATE POLICY "Super admins can update all sessions" ON public.user_sessions
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Politique RLS pour permettre aux super admins de voir tous les codes d'accès
CREATE POLICY "Super admins can view all access codes" ON public.housekeeper_access_codes
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Politique RLS pour permettre aux super admins de voir tous les hôtels
CREATE POLICY "Super admins can view all hotels" ON public.hotels
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Politique RLS pour permettre aux super admins de voir toutes les femmes de chambre
CREATE POLICY "Super admins can view all housekeepers" ON public.housekeepers
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);