-- Fix RLS policies for authentication and code generation
-- 1. Fix profiles RLS to allow auto-creation
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (
  auth.uid() = id OR 
  auth.role() = 'authenticated'
);

-- 2. Fix hotels RLS to allow setup process  
DROP POLICY IF EXISTS "Users can manage their own hotels" ON public.hotels;
CREATE POLICY "Users can manage their own hotels" ON public.hotels
FOR ALL USING (
  auth.uid() = user_id OR 
  auth.role() = 'authenticated' OR
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 3. Fix hotel_sessions RLS for initial creation
DROP POLICY IF EXISTS "Authenticated users can create sessions" ON public.hotel_sessions;
CREATE POLICY "Authenticated users can create sessions" ON public.hotel_sessions
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_sessions.hotel_id AND h.user_id = auth.uid()) OR
    (user_id IS NULL AND EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_sessions.hotel_id AND h.user_id = auth.uid()))
  )
);

-- 4. Create helper function for hotel management permissions
CREATE OR REPLACE FUNCTION public.can_manage_hotel_data(target_hotel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if current user owns the hotel or is super admin
  RETURN EXISTS (
    SELECT 1 FROM public.hotels 
    WHERE id = target_hotel_id 
    AND user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role);
END;
$$;

-- 5. Fix housekeeper_access_codes RLS for code generation
DROP POLICY IF EXISTS "Users can manage access codes for their hotels" ON public.housekeeper_access_codes;
CREATE POLICY "Users can manage access codes for their hotels" ON public.housekeeper_access_codes
FOR ALL USING (
  public.can_manage_hotel_data(hotel_id)
);

-- 6. Fix housekeepers RLS for code generation
DROP POLICY IF EXISTS "Users can manage housekeepers for their hotels" ON public.housekeepers;
CREATE POLICY "Users can manage housekeepers for their hotels" ON public.housekeepers
FOR ALL USING (
  auth.uid() = user_id OR public.can_manage_hotel_data(hotel_id)
);

-- 7. Add index for better performance on authentication lookups
CREATE INDEX IF NOT EXISTS idx_hotels_user_id_email ON public.hotels(user_id, email);
CREATE INDEX IF NOT EXISTS idx_housekeeper_access_codes_hotel_active ON public.housekeeper_access_codes(hotel_id, is_active) WHERE is_active = true;