
-- 1. Add RLS policy on hotel_sessions for sub-accounts
CREATE POLICY "Sub-accounts can manage hotel sessions"
ON public.hotel_sessions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sub_accounts sa
    WHERE sa.user_id = auth.uid()
    AND sa.hotel_id = hotel_sessions.hotel_id
    AND sa.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sub_accounts sa
    WHERE sa.user_id = auth.uid()
    AND sa.hotel_id = hotel_sessions.hotel_id
    AND sa.is_active = true
  )
);

-- 2. Update can_manage_hotel_data to include sub-accounts
CREATE OR REPLACE FUNCTION public.can_manage_hotel_data(target_hotel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 
    -- User is the hotel owner
    EXISTS (
      SELECT 1 FROM public.hotels 
      WHERE id = target_hotel_id 
      AND user_id = auth.uid()
    )
    OR
    -- User is an active sub-account for this hotel
    EXISTS (
      SELECT 1 FROM public.sub_accounts
      WHERE hotel_id = target_hotel_id
      AND user_id = auth.uid()
      AND is_active = true
    )
    OR
    -- User is a super admin
    public.has_role(auth.uid(), 'super_admin'::app_role);
END;
$$;

-- 3. Fix mismatched current_hotel_id for sub-accounts
UPDATE public.profiles p
SET current_hotel_id = sa.hotel_id
FROM public.sub_accounts sa
WHERE sa.user_id = p.id
AND sa.is_active = true
AND sa.hotel_id IS NOT NULL
AND (p.current_hotel_id IS NULL OR p.current_hotel_id != sa.hotel_id);
