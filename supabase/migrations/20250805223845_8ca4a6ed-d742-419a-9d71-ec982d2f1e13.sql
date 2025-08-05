-- Drop the problematic policies first
DROP POLICY IF EXISTS "Housekeepers can view their own profile" ON public.housekeeper_profiles;
DROP POLICY IF EXISTS "Housekeepers can update their own profile" ON public.housekeeper_profiles;
DROP POLICY IF EXISTS "Housekeepers can insert their own profile" ON public.housekeeper_profiles;
DROP POLICY IF EXISTS "Housekeepers can view their own history" ON public.housekeeper_hotel_history;
DROP POLICY IF EXISTS "Housekeepers can view their own sessions" ON public.hotel_access_sessions;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.get_housekeeper_profile_id()
RETURNS UUID AS $$
BEGIN
  -- Try to get the profile ID based on current user's email
  RETURN (
    SELECT hp.id 
    FROM public.housekeeper_profiles hp 
    JOIN auth.users u ON u.email = hp.email 
    WHERE u.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path TO '';

-- Fixed policies for housekeeper_profiles
CREATE POLICY "Housekeepers can view their own profile" 
ON public.housekeeper_profiles 
FOR SELECT 
USING (id = public.get_housekeeper_profile_id());

CREATE POLICY "Housekeepers can update their own profile" 
ON public.housekeeper_profiles 
FOR UPDATE 
USING (id = public.get_housekeeper_profile_id());

CREATE POLICY "Housekeepers can insert their own profile" 
ON public.housekeeper_profiles 
FOR INSERT 
WITH CHECK (id = public.get_housekeeper_profile_id() OR auth.role() = 'authenticated');

-- Fixed policies for housekeeper_hotel_history
CREATE POLICY "Housekeepers can view their own history" 
ON public.housekeeper_hotel_history 
FOR ALL 
USING (housekeeper_profile_id = public.get_housekeeper_profile_id());

-- Fixed policies for hotel_access_sessions
CREATE POLICY "Housekeepers can view their own sessions" 
ON public.hotel_access_sessions 
FOR ALL 
USING (housekeeper_profile_id = public.get_housekeeper_profile_id());