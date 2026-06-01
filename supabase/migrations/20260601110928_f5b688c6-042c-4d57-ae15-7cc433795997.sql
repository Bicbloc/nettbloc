CREATE OR REPLACE FUNCTION public.get_invitation_by_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation public.sub_account_invitations%ROWTYPE;
  v_sub        public.sub_accounts%ROWTYPE;
  v_hotel      public.hotels%ROWTYPE;
BEGIN
  IF p_code IS NULL OR length(p_code) < 4 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invitation
  FROM public.sub_account_invitations
  WHERE invitation_code = p_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_sub
  FROM public.sub_accounts
  WHERE id = v_invitation.sub_account_id
  LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_hotel
    FROM public.hotels
    WHERE id = v_sub.hotel_id
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'invitation', to_jsonb(v_invitation),
    'sub_account', CASE WHEN v_sub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_sub.id,
      'first_name', v_sub.first_name,
      'last_name', v_sub.last_name,
      'email', v_sub.email,
      'role', v_sub.role_name,
      'hotel_id', v_sub.hotel_id,
      'parent_user_id', v_sub.parent_user_id,
      'is_active', v_sub.is_active
    ) END,
    'hotel', CASE WHEN v_hotel.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_hotel.id,
      'name', v_hotel.name,
      'hotel_code', v_hotel.hotel_code
    ) END
  );
END;
$function$;