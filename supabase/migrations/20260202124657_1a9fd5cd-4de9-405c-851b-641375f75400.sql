-- Table pour stocker les assignations des gouvernantes par jour
CREATE TABLE public.daily_governess_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  governess_profile_id UUID REFERENCES public.governess_profiles(id) ON DELETE SET NULL,
  governess_name TEXT NOT NULL,
  assignment_type TEXT NOT NULL DEFAULT 'floor' CHECK (assignment_type IN ('floor', 'housekeeper')),
  -- Pour assignation par étage: liste des étages
  assigned_floors INTEGER[] DEFAULT '{}',
  -- Pour assignation par femme de chambre: liste des noms
  assigned_housekeepers TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(hotel_id, assignment_date, governess_name)
);

-- Activer RLS
ALTER TABLE public.daily_governess_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Hotel owners can manage governess assignments"
ON public.daily_governess_assignments
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid())
);

CREATE POLICY "Governesses can view their assignments"
ON public.daily_governess_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.governess_profiles gp
    JOIN auth.users u ON u.email = gp.email
    WHERE gp.id = governess_profile_id AND u.id = auth.uid()
  )
);

-- Table pour stocker les consignes du jour (template info)
CREATE TABLE public.daily_instructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  instruction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  instructions TEXT, -- Consignes du jour
  to_know TEXT, -- À savoir
  todo_list TEXT, -- To-do du jour
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(hotel_id, instruction_date)
);

-- Activer RLS
ALTER TABLE public.daily_instructions ENABLE ROW LEVEL SECURITY;

-- Policies pour daily_instructions
CREATE POLICY "Hotel owners can manage daily instructions"
ON public.daily_instructions
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid())
);

CREATE POLICY "Staff can view daily instructions"
ON public.daily_instructions
FOR SELECT
USING (
  -- Femmes de chambre avec accès approuvé
  EXISTS (
    SELECT 1 FROM public.housekeeper_access_requests har
    JOIN public.housekeeper_profiles hp ON hp.id = har.housekeeper_profile_id
    JOIN auth.users u ON u.email = hp.email
    WHERE har.hotel_id = daily_instructions.hotel_id
    AND har.status = 'approved'
    AND u.id = auth.uid()
  )
  OR
  -- Gouvernantes avec accès approuvé
  EXISTS (
    SELECT 1 FROM public.governess_access_requests gar
    JOIN public.governess_profiles gp ON gp.id = gar.governess_profile_id
    JOIN auth.users u ON u.email = gp.email
    WHERE gar.hotel_id = daily_instructions.hotel_id
    AND gar.status = 'approved'
    AND u.id = auth.uid()
  )
  OR
  -- Techniciens avec accès approuvé
  EXISTS (
    SELECT 1 FROM public.technician_access_requests tar
    JOIN public.technician_profiles tp ON tp.id = tar.technician_profile_id
    JOIN auth.users u ON u.email = tp.email
    WHERE tar.hotel_id = daily_instructions.hotel_id
    AND tar.status = 'approved'
    AND u.id = auth.uid()
  )
);

-- Trigger pour updated_at
CREATE TRIGGER update_daily_instructions_updated_at
BEFORE UPDATE ON public.daily_instructions
FOR EACH ROW
EXECUTE FUNCTION public.update_hotel_rooms_registry_updated_at();

-- Index pour performance
CREATE INDEX idx_daily_governess_assignments_hotel_date ON public.daily_governess_assignments(hotel_id, assignment_date);
CREATE INDEX idx_daily_instructions_hotel_date ON public.daily_instructions(hotel_id, instruction_date);