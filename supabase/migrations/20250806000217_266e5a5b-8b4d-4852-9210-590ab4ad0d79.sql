-- Créer une table pour les demandes d'accès des femmes de chambre
CREATE TABLE IF NOT EXISTS public.housekeeper_access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  housekeeper_profile_id UUID NOT NULL,
  hotel_id UUID NOT NULL,
  hotel_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.housekeeper_access_requests ENABLE ROW LEVEL SECURITY;

-- Policies pour les demandes d'accès
CREATE POLICY "Housekeepers can insert their own access requests"
ON public.housekeeper_access_requests
FOR INSERT
WITH CHECK (housekeeper_profile_id = get_housekeeper_profile_id());

CREATE POLICY "Housekeepers can view their own access requests"
ON public.housekeeper_access_requests
FOR SELECT
USING (housekeeper_profile_id = get_housekeeper_profile_id());

CREATE POLICY "Hotel admins can manage requests for their hotels"
ON public.housekeeper_access_requests
FOR ALL
USING (EXISTS (
  SELECT 1 FROM hotels h 
  WHERE h.id = housekeeper_access_requests.hotel_id 
  AND h.user_id = auth.uid()
));

-- Trigger pour updated_at
CREATE TRIGGER update_housekeeper_access_requests_updated_at
BEFORE UPDATE ON public.housekeeper_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Modifier hotel_access_sessions pour supporter les demandes approuvées
ALTER TABLE public.hotel_access_sessions 
ADD COLUMN IF NOT EXISTS access_request_id UUID,
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Fonction pour approuver une demande d'accès
CREATE OR REPLACE FUNCTION approve_housekeeper_access_request(
  request_id UUID,
  admin_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record housekeeper_access_requests%ROWTYPE;
  new_session_id UUID;
  new_access_code TEXT;
BEGIN
  -- Vérifier que l'admin a les droits sur l'hôtel
  SELECT * INTO request_record
  FROM housekeeper_access_requests har
  JOIN hotels h ON h.id = har.hotel_id
  WHERE har.id = request_id 
  AND h.user_id = admin_user_id
  AND har.status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande non trouvée ou pas d''autorisation';
  END IF;
  
  -- Générer un code d'accès unique
  new_access_code := request_record.hotel_code || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
  
  -- Créer une session d'accès
  INSERT INTO hotel_access_sessions (
    housekeeper_profile_id,
    hotel_id,
    access_code,
    session_token,
    access_request_id,
    approved_by,
    approved_at,
    expires_at
  ) VALUES (
    request_record.housekeeper_profile_id,
    request_record.hotel_id,
    new_access_code,
    UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)),
    request_id,
    admin_user_id,
    NOW(),
    NOW() + INTERVAL '24 hours'
  ) RETURNING id INTO new_session_id;
  
  -- Marquer la demande comme approuvée
  UPDATE housekeeper_access_requests
  SET status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = admin_user_id,
      updated_at = NOW()
  WHERE id = request_id;
  
  -- Créer une notification pour la femme de chambre
  INSERT INTO notifications (
    user_id, 
    hotel_id,
    title,
    description,
    type,
    user_type
  ) VALUES (
    admin_user_id,
    request_record.hotel_id,
    'Demande d''accès approuvée',
    'Votre demande d''accès à l''hôtel a été approuvée. Code: ' || new_access_code,
    'access_approved',
    'housekeeper'
  );
  
  RETURN new_session_id;
END;
$$;