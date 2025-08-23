-- Fix hotel_sessions table schema issues
ALTER TABLE public.hotel_sessions 
ADD COLUMN IF NOT EXISTS housekeeper_assignments jsonb DEFAULT '{}';

-- Fix user_sessions table by adding missing columns 
ALTER TABLE public.user_sessions 
ADD COLUMN IF NOT EXISTS housekeeper_id text;

-- Update RLS policies for user_sessions to fix permission issues
DROP POLICY IF EXISTS "Admins can view hotel sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Super admins can view all sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Super admins can update all sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;

-- Create new, simpler RLS policies for user_sessions
CREATE POLICY "Users can manage their own sessions" 
ON public.user_sessions 
FOR ALL 
USING (user_id = auth.uid());

CREATE POLICY "Hotel owners can view sessions for their hotels" 
ON public.user_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = user_sessions.hotel_id 
    AND h.user_id = auth.uid()
  )
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_hotel_id ON public.user_sessions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON public.user_sessions(is_active);

-- Enable realtime for critical tables to fix synchronization
ALTER publication supabase_realtime ADD TABLE public.user_sessions;
ALTER publication supabase_realtime ADD TABLE public.hotel_sessions;
ALTER publication supabase_realtime ADD TABLE public.room_status_updates;
ALTER publication supabase_realtime ADD TABLE public.assignments;

-- Set replica identity for real-time updates
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.hotel_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.room_status_updates REPLICA IDENTITY FULL;
ALTER TABLE public.assignments REPLICA IDENTITY FULL;