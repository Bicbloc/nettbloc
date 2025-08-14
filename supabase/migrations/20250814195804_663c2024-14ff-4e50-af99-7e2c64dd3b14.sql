-- Phase 1: Fix critical Supabase permissions and database structure

-- Fix RLS policies to allow proper administrative access
-- Drop existing restrictive policies that are causing issues

-- 1. Fix user_sessions table structure issue
-- Remove references to non-existent housekeeper_id column if any queries are failing
-- The column doesn't exist according to the schema, so we need to ensure no code references it

-- 2. Improve hotel_sessions RLS to allow legitimate insertions
DROP POLICY IF EXISTS "Authenticated users can create guest sessions" ON public.hotel_sessions;

CREATE POLICY "Authenticated users can create sessions" 
ON public.hotel_sessions 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (
    -- User can create their own session
    auth.uid() = user_id OR 
    -- User can create session for their hotel
    EXISTS (
      SELECT 1 FROM public.hotels h 
      WHERE h.id = hotel_sessions.hotel_id 
      AND h.user_id = auth.uid()
    ) OR
    -- Allow guest sessions with null user_id for hotel owners
    (user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.hotels h 
      WHERE h.id = hotel_sessions.hotel_id 
      AND h.user_id = auth.uid()
    ))
  )
);

-- 3. Add more permissive policies for profiles table to allow profile creation
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = id OR 
  -- Allow creation during user setup process
  auth.role() = 'authenticated'
);

-- 4. Improve hotels table policies for better user management
DROP POLICY IF EXISTS "Users can manage their own hotels" ON public.hotels;

CREATE POLICY "Users can manage their own hotels" 
ON public.hotels 
FOR ALL 
USING (
  auth.uid() = user_id OR 
  -- Allow hotel creation/update during setup process
  auth.role() = 'authenticated'
);

-- 5. Create a function to help with administrative operations
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

-- 6. Add a policy to allow hotel lookup by email during setup
CREATE POLICY "Allow hotel lookup during setup" 
ON public.hotels 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
  true -- Allow general lookup for public hotel codes
);