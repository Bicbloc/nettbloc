-- Create table to track active sessions and login times
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('admin', 'housekeeper')),
  user_name text NOT NULL,
  login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  session_token text UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow admins to see all sessions for their hotel
CREATE POLICY "Admins can view hotel sessions" 
ON public.user_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h 
    WHERE h.id = hotel_id 
    AND h.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Allow users to manage their own sessions
CREATE POLICY "Users can manage their own sessions" 
ON public.user_sessions 
FOR ALL
USING (user_id = auth.uid());

-- Create function to update last activity
CREATE OR REPLACE FUNCTION public.update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic activity updates
CREATE TRIGGER update_sessions_activity
BEFORE UPDATE ON public.user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_last_activity();

-- Create function to clean up old inactive sessions
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
  UPDATE public.user_sessions 
  SET is_active = false 
  WHERE last_activity < (now() - interval '24 hours');
END;
$$ LANGUAGE plpgsql;