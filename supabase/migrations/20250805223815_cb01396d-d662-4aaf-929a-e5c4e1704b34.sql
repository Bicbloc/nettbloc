-- Add RLS policies for the new tables

-- Policies for housekeeper_profiles
CREATE POLICY "Housekeepers can view their own profile" 
ON public.housekeeper_profiles 
FOR SELECT 
USING (auth.uid()::text = email OR EXISTS (
  SELECT 1 FROM auth.users WHERE auth.uid() = id AND email = housekeeper_profiles.email
));

CREATE POLICY "Housekeepers can update their own profile" 
ON public.housekeeper_profiles 
FOR UPDATE 
USING (auth.uid()::text = email OR EXISTS (
  SELECT 1 FROM auth.users WHERE auth.uid() = id AND email = housekeeper_profiles.email
));

CREATE POLICY "Housekeepers can insert their own profile" 
ON public.housekeeper_profiles 
FOR INSERT 
WITH CHECK (auth.uid()::text = email OR EXISTS (
  SELECT 1 FROM auth.users WHERE auth.uid() = id AND email = housekeeper_profiles.email
));

CREATE POLICY "Hotel admins can view housekeepers who worked for them" 
ON public.housekeeper_profiles 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.housekeeper_hotel_history hhh
  JOIN public.hotels h ON h.id = hhh.hotel_id
  WHERE h.user_id = auth.uid() AND hhh.housekeeper_profile_id = housekeeper_profiles.id
));

-- Policies for housekeeper_hotel_history
CREATE POLICY "Housekeepers can view their own history" 
ON public.housekeeper_hotel_history 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.housekeeper_profiles hp 
  WHERE hp.id = housekeeper_hotel_history.housekeeper_profile_id 
  AND (hp.email = auth.uid()::text OR EXISTS (
    SELECT 1 FROM auth.users WHERE auth.uid() = id AND email = hp.email
  ))
));

CREATE POLICY "Hotel admins can view their hotel history" 
ON public.housekeeper_hotel_history 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.hotels h 
  WHERE h.id = housekeeper_hotel_history.hotel_id AND h.user_id = auth.uid()
));

-- Policies for hotel_access_sessions
CREATE POLICY "Housekeepers can view their own sessions" 
ON public.hotel_access_sessions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.housekeeper_profiles hp 
  WHERE hp.id = hotel_access_sessions.housekeeper_profile_id 
  AND (hp.email = auth.uid()::text OR EXISTS (
    SELECT 1 FROM auth.users WHERE auth.uid() = id AND email = hp.email
  ))
));

CREATE POLICY "Hotel admins can manage sessions for their hotels" 
ON public.hotel_access_sessions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.hotels h 
  WHERE h.id = hotel_access_sessions.hotel_id AND h.user_id = auth.uid()
));

-- Add triggers for updated_at columns
CREATE TRIGGER update_housekeeper_profiles_updated_at
BEFORE UPDATE ON public.housekeeper_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_housekeeper_hotel_history_updated_at
BEFORE UPDATE ON public.housekeeper_hotel_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hotel_access_sessions_updated_at
BEFORE UPDATE ON public.hotel_access_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate temporary access codes
CREATE OR REPLACE FUNCTION public.generate_temporary_hotel_access_code(
  p_housekeeper_profile_id UUID,
  p_hotel_id UUID,
  p_duration_hours INTEGER DEFAULT 48
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  hotel_code TEXT;
  housekeeper_name TEXT;
  generated_access_code TEXT;
  session_token TEXT;
  random_suffix TEXT;
  name_part TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Get hotel code
  SELECT h.hotel_code INTO hotel_code 
  FROM public.hotels h 
  WHERE h.id = p_hotel_id;
  
  IF hotel_code IS NULL THEN
    RAISE EXCEPTION 'Hôtel introuvable ou code manquant';
  END IF;
  
  -- Get housekeeper name
  SELECT hp.name INTO housekeeper_name 
  FROM public.housekeeper_profiles hp 
  WHERE hp.id = p_housekeeper_profile_id;
  
  IF housekeeper_name IS NULL THEN
    RAISE EXCEPTION 'Profil femme de chambre introuvable';
  END IF;
  
  -- Create name part (first 3 letters uppercase)
  name_part := UPPER(LEFT(housekeeper_name, 3));
  
  -- Generate unique access code
  LOOP
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    generated_access_code := hotel_code || '-' || name_part || '-' || random_suffix;
    
    -- Check if code already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.hotel_access_sessions 
      WHERE access_code = generated_access_code AND is_active = true
    ) THEN
      EXIT; -- Unique code found
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Impossible de générer un code unique après % tentatives', max_attempts;
    END IF;
  END LOOP;
  
  -- Generate session token
  session_token := encode(gen_random_bytes(32), 'hex');
  
  -- Deactivate any existing active sessions for this housekeeper and hotel
  UPDATE public.hotel_access_sessions 
  SET is_active = false, ended_at = now()
  WHERE housekeeper_profile_id = p_housekeeper_profile_id 
    AND hotel_id = p_hotel_id 
    AND is_active = true;
  
  -- Insert new session
  INSERT INTO public.hotel_access_sessions (
    housekeeper_profile_id,
    hotel_id,
    access_code,
    session_token,
    expires_at
  ) VALUES (
    p_housekeeper_profile_id,
    p_hotel_id,
    generated_access_code,
    session_token,
    now() + (p_duration_hours || ' hours')::interval
  );
  
  RETURN generated_access_code;
END;
$$;