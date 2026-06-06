
-- ============ Cafetiere profiles ============
CREATE TABLE public.cafetiere_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_hotels_worked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafetiere_profiles TO authenticated;
GRANT ALL ON public.cafetiere_profiles TO service_role;

ALTER TABLE public.cafetiere_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cafetieres can view their own profile"
ON public.cafetiere_profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Cafetieres can insert their own profile"
ON public.cafetiere_profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Cafetieres can update their own profile"
ON public.cafetiere_profiles FOR UPDATE USING (id = auth.uid());

-- ============ Cafetiere access requests ============
CREATE TABLE public.cafetiere_access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cafetiere_profile_id UUID NOT NULL REFERENCES public.cafetiere_profiles(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  hotel_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafetiere_access_requests TO authenticated;
GRANT ALL ON public.cafetiere_access_requests TO service_role;

ALTER TABLE public.cafetiere_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cafetieres can create access requests"
ON public.cafetiere_access_requests FOR INSERT
WITH CHECK (cafetiere_profile_id = auth.uid());

CREATE POLICY "Cafetieres can view their own requests"
ON public.cafetiere_access_requests FOR SELECT
USING (cafetiere_profile_id = auth.uid());

CREATE POLICY "Hotel owners can manage cafetiere requests"
ON public.cafetiere_access_requests FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM hotels h
    WHERE h.id = cafetiere_access_requests.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE INDEX idx_cafetiere_profiles_email ON public.cafetiere_profiles(email);
CREATE INDEX idx_cafetiere_access_requests_hotel ON public.cafetiere_access_requests(hotel_id);
CREATE INDEX idx_cafetiere_access_requests_cafetiere ON public.cafetiere_access_requests(cafetiere_profile_id);

-- ============ Auto-create profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_cafetiere_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'cafetiere' THEN
    INSERT INTO public.cafetiere_profiles (id, email, name, phone, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Cafetière'),
      NEW.raw_user_meta_data->>'phone',
      true
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cafetiere_signup ON auth.users;
CREATE TRIGGER on_cafetiere_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_cafetiere_signup();

-- ============ Approved hotels RPC ============
CREATE OR REPLACE FUNCTION public.get_approved_hotels_for_cafetiere(p_cafetiere_profile_id UUID)
RETURNS TABLE (
  hotel_id UUID,
  hotel_name TEXT,
  hotel_code TEXT,
  approved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id AS hotel_id,
    h.name AS hotel_name,
    h.hotel_code,
    car.reviewed_at AS approved_at
  FROM cafetiere_access_requests car
  JOIN hotels h ON h.id = car.hotel_id
  WHERE car.cafetiere_profile_id = p_cafetiere_profile_id
    AND car.status = 'approved'
  ORDER BY car.reviewed_at DESC;
END;
$$;

-- ============ Add cafetiere to cross-role email check ============
CREATE OR REPLACE FUNCTION public.check_email_exists_for_role(p_email TEXT)
RETURNS TABLE(found_in TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'establishment'::TEXT
  FROM hotels h
  INNER JOIN auth.users u ON u.id = h.user_id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  RETURN QUERY
  SELECT 'establishment'::TEXT
  FROM sub_accounts sa
  INNER JOIN auth.users u ON u.id = sa.user_id
  WHERE lower(u.email) = lower(p_email) AND sa.is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT 'housekeeper'::TEXT FROM housekeeper_profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'governess'::TEXT FROM governess_profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'technician'::TEXT FROM technician_profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  RETURN QUERY
  SELECT 'cafetiere'::TEXT FROM cafetiere_profiles WHERE lower(email) = lower(p_email) LIMIT 1;
END;
$$;

-- ============ Breakfast logs access for approved cafetiere ============
CREATE POLICY "Cafetiere can view breakfast logs"
ON public.breakfast_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM cafetiere_access_requests car
    WHERE car.hotel_id = breakfast_logs.hotel_id
      AND car.cafetiere_profile_id = auth.uid()
      AND car.status = 'approved'
  )
);

CREATE POLICY "Cafetiere can insert breakfast logs"
ON public.breakfast_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cafetiere_access_requests car
    WHERE car.hotel_id = breakfast_logs.hotel_id
      AND car.cafetiere_profile_id = auth.uid()
      AND car.status = 'approved'
  )
);

CREATE POLICY "Cafetiere can update breakfast logs"
ON public.breakfast_logs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM cafetiere_access_requests car
    WHERE car.hotel_id = breakfast_logs.hotel_id
      AND car.cafetiere_profile_id = auth.uid()
      AND car.status = 'approved'
  )
);

-- ============ Incident reporting/viewing for approved cafetiere ============
CREATE POLICY "Cafetiere can view incidents"
ON public.incidents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM cafetiere_access_requests car
    WHERE car.hotel_id = incidents.hotel_id
      AND car.cafetiere_profile_id = auth.uid()
      AND car.status = 'approved'
  )
);

CREATE POLICY "Cafetiere can report incidents"
ON public.incidents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cafetiere_access_requests car
    WHERE car.hotel_id = incidents.hotel_id
      AND car.cafetiere_profile_id = auth.uid()
      AND car.status = 'approved'
  )
);
