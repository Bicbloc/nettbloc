-- Create staff role permissions table
CREATE TABLE IF NOT EXISTS public.staff_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.staff_roles(id) ON DELETE CASCADE,
  incident_type_id UUID NOT NULL REFERENCES public.incident_types(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_resolve BOOLEAN NOT NULL DEFAULT false,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role_id, incident_type_id)
);

-- Enable RLS
ALTER TABLE public.staff_role_permissions ENABLE ROW LEVEL SECURITY;

-- Hotel owners can manage permissions
CREATE POLICY "Hotel owners can manage role permissions"
ON public.staff_role_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = staff_role_permissions.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_staff_role_permissions_updated_at
BEFORE UPDATE ON public.staff_role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_staff_role_permissions_role ON public.staff_role_permissions(role_id);
CREATE INDEX idx_staff_role_permissions_type ON public.staff_role_permissions(incident_type_id);
CREATE INDEX idx_staff_role_permissions_hotel ON public.staff_role_permissions(hotel_id);