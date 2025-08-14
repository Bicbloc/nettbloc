-- Fix security vulnerability: Restrict access to hotel_sessions table
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow guest sessions creation" ON public.hotel_sessions;
DROP POLICY IF EXISTS "Users can manage their own hotel sessions" ON public.hotel_sessions;

-- Create secure RLS policies for hotel_sessions table

-- 1. Hotel owners can view and manage sessions for their hotels
CREATE POLICY "Hotel owners can manage their hotel sessions" 
ON public.hotel_sessions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_sessions.hotel_id 
    AND h.user_id = auth.uid()
  )
);

-- 2. Authenticated users can manage only their own sessions
CREATE POLICY "Users can manage their own sessions" 
ON public.hotel_sessions 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- 3. Allow authenticated users to create guest sessions (for hotel workflow)
CREATE POLICY "Authenticated users can create guest sessions" 
ON public.hotel_sessions 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    (auth.uid() = user_id) OR 
    (user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.hotels h 
      WHERE h.id = hotel_sessions.hotel_id 
      AND h.user_id = auth.uid()
    ))
  )
);

-- 4. Allow session updates for authorized users only
CREATE POLICY "Authorized users can update sessions" 
ON public.hotel_sessions 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND (
    (auth.uid() = user_id) OR 
    EXISTS (
      SELECT 1 FROM public.hotels h 
      WHERE h.id = hotel_sessions.hotel_id 
      AND h.user_id = auth.uid()
    )
  )
);