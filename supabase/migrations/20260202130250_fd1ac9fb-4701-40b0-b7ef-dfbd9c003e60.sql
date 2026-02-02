-- Table pour les tâches manuelles assignables
CREATE TABLE public.manual_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location_type TEXT NOT NULL DEFAULT 'other', -- 'room', 'corridor', 'lobby', 'other'
  location_reference TEXT, -- numéro de chambre, nom du couloir, etc.
  assigned_to_type TEXT NOT NULL DEFAULT 'housekeeper', -- 'housekeeper', 'governess', 'technician'
  assigned_to_name TEXT, -- nom de la personne assignée
  assigned_to_id UUID, -- ID du profil si disponible
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'validated'
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by_name TEXT,
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID,
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour les timesheets (pointages)
CREATE TABLE public.staff_timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  staff_type TEXT NOT NULL, -- 'housekeeper', 'governess', 'technician'
  staff_name TEXT NOT NULL,
  staff_id UUID, -- ID du profil si disponible
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  break_minutes INTEGER DEFAULT 0,
  rooms_cleaned INTEGER DEFAULT 0,
  rooms_recouche INTEGER DEFAULT 0,
  rooms_depart INTEGER DEFAULT 0,
  rooms_inspected INTEGER DEFAULT 0,
  incidents_reported INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, staff_type, staff_name, work_date)
);

-- Table pour les templates d'instructions (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS public.instruction_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'instructions', 'to_know', 'todo'
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_manual_tasks_hotel_date ON public.manual_tasks(hotel_id, task_date);
CREATE INDEX idx_manual_tasks_assigned ON public.manual_tasks(hotel_id, assigned_to_type, assigned_to_name);
CREATE INDEX idx_staff_timesheets_hotel_date ON public.staff_timesheets(hotel_id, work_date);
CREATE INDEX idx_staff_timesheets_staff ON public.staff_timesheets(hotel_id, staff_type, staff_name);
CREATE INDEX idx_instruction_templates_hotel ON public.instruction_templates(hotel_id, template_type);

-- Enable RLS
ALTER TABLE public.manual_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruction_templates ENABLE ROW LEVEL SECURITY;

-- Policies pour manual_tasks
CREATE POLICY "Hotel owners can manage manual tasks"
  ON public.manual_tasks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid()));

CREATE POLICY "Staff can view their assigned tasks"
  ON public.manual_tasks FOR SELECT
  USING (
    hotel_id IN (
      SELECT hotel_id FROM public.housekeeper_access_requests WHERE housekeeper_profile_id = public.get_housekeeper_profile_id() AND status = 'approved'
    )
    OR hotel_id IN (
      SELECT hotel_id FROM public.governess_access_requests WHERE governess_profile_id IN (
        SELECT id FROM public.governess_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      ) AND status = 'approved'
    )
    OR hotel_id IN (
      SELECT hotel_id FROM public.technician_access_requests WHERE technician_profile_id IN (
        SELECT id FROM public.technician_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      ) AND status = 'approved'
    )
  );

CREATE POLICY "Staff can update their assigned tasks status"
  ON public.manual_tasks FOR UPDATE
  USING (
    hotel_id IN (
      SELECT hotel_id FROM public.housekeeper_access_requests WHERE housekeeper_profile_id = public.get_housekeeper_profile_id() AND status = 'approved'
    )
    OR hotel_id IN (
      SELECT hotel_id FROM public.governess_access_requests WHERE governess_profile_id IN (
        SELECT id FROM public.governess_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      ) AND status = 'approved'
    )
  );

-- Policies pour staff_timesheets
CREATE POLICY "Hotel owners can manage timesheets"
  ON public.staff_timesheets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid()));

CREATE POLICY "Staff can view and update their own timesheets"
  ON public.staff_timesheets FOR SELECT
  USING (
    hotel_id IN (
      SELECT hotel_id FROM public.housekeeper_access_requests WHERE housekeeper_profile_id = public.get_housekeeper_profile_id() AND status = 'approved'
    )
    OR hotel_id IN (
      SELECT hotel_id FROM public.governess_access_requests WHERE governess_profile_id IN (
        SELECT id FROM public.governess_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      ) AND status = 'approved'
    )
    OR hotel_id IN (
      SELECT hotel_id FROM public.technician_access_requests WHERE technician_profile_id IN (
        SELECT id FROM public.technician_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      ) AND status = 'approved'
    )
  );

-- Policies pour instruction_templates
CREATE POLICY "Hotel owners can manage instruction templates"
  ON public.instruction_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels WHERE id = hotel_id AND user_id = auth.uid()));

CREATE POLICY "Staff can view instruction templates"
  ON public.instruction_templates FOR SELECT
  USING (
    hotel_id IN (
      SELECT hotel_id FROM public.housekeeper_access_requests WHERE housekeeper_profile_id = public.get_housekeeper_profile_id() AND status = 'approved'
    )
    OR hotel_id IN (
      SELECT hotel_id FROM public.governess_access_requests WHERE governess_profile_id IN (
        SELECT id FROM public.governess_profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      ) AND status = 'approved'
    )
  );

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_manual_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_manual_tasks_updated_at
  BEFORE UPDATE ON public.manual_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_manual_tasks_updated_at();

CREATE TRIGGER update_staff_timesheets_updated_at
  BEFORE UPDATE ON public.staff_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.update_manual_tasks_updated_at();

CREATE TRIGGER update_instruction_templates_updated_at
  BEFORE UPDATE ON public.instruction_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_manual_tasks_updated_at();