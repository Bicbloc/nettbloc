-- Table to store floor plan grid layouts per hotel
CREATE TABLE public.floor_plan_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  floor_key text NOT NULL,
  grid_cols integer NOT NULL DEFAULT 10,
  cells jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (hotel_id, floor_key)
);

ALTER TABLE public.floor_plan_layouts ENABLE ROW LEVEL SECURITY;

-- Owner + sub-accounts + technicians can view
CREATE POLICY "Authorized users can view floor plans"
ON public.floor_plan_layouts FOR SELECT
TO authenticated
USING (public.can_access_hotel(hotel_id));

-- Owner + sub-accounts can modify
CREATE POLICY "Authorized users can insert floor plans"
ON public.floor_plan_layouts FOR INSERT
TO authenticated
WITH CHECK (public.can_access_hotel(hotel_id));

CREATE POLICY "Authorized users can update floor plans"
ON public.floor_plan_layouts FOR UPDATE
TO authenticated
USING (public.can_access_hotel(hotel_id));

CREATE POLICY "Authorized users can delete floor plans"
ON public.floor_plan_layouts FOR DELETE
TO authenticated
USING (public.can_access_hotel(hotel_id));

-- Allow housekeepers with active sessions to view
CREATE POLICY "Housekeepers can view floor plans"
ON public.floor_plan_layouts FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hotel_access_sessions has
    WHERE has.hotel_id = floor_plan_layouts.hotel_id
    AND has.is_active = true
    AND has.expires_at > now()
  )
);