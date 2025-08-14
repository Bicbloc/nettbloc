-- Create password reset logs table for tracking
CREATE TABLE IF NOT EXISTS public.password_reset_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  request_ip INET,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  completed_at TIMESTAMP WITH TIME ZONE,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Super admins can view all password reset logs" 
ON public.password_reset_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view their own password reset logs" 
ON public.password_reset_logs 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert password reset logs" 
ON public.password_reset_logs 
FOR INSERT 
WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_email ON public.password_reset_logs(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_requested_at ON public.password_reset_logs(requested_at);

-- Create function to log password reset requests
CREATE OR REPLACE FUNCTION public.log_password_reset_request(
  p_email TEXT,
  p_request_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
BEGIN
  -- Try to find user by email
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = p_email;
  
  -- Insert log entry
  INSERT INTO public.password_reset_logs (
    user_id, 
    email, 
    request_ip, 
    user_agent
  ) VALUES (
    v_user_id, 
    p_email, 
    p_request_ip, 
    p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;