-- 1) Buildings
CREATE TABLE public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_buildings_hotel ON public.buildings(hotel_id);
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- 2) Common spaces
CREATE TABLE public.common_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  name text NOT NULL,
  space_type text NOT NULL DEFAULT 'other',
  floor integer,
  area_sqm numeric,
  description text,
  photo_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_common_spaces_hotel ON public.common_spaces(hotel_id);
CREATE INDEX idx_common_spaces_building ON public.common_spaces(building_id);
ALTER TABLE public.common_spaces ENABLE ROW LEVEL SECURITY;

-- 3) Room type templates
CREATE TABLE public.room_type_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_characteristics jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_equipments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, name)
);
CREATE INDEX idx_room_type_templates_hotel ON public.room_type_templates(hotel_id);
ALTER TABLE public.room_type_templates ENABLE ROW LEVEL SECURITY;

-- 4) Room characteristics (one per room in registry)
CREATE TABLE public.room_characteristics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_registry_id uuid NOT NULL REFERENCES public.hotel_rooms_registry(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.room_type_templates(id) ON DELETE SET NULL,
  bed_type text,
  bed_dimensions text,
  bed_count integer DEFAULT 1,
  bathroom_type text,
  has_bathtub boolean DEFAULT false,
  has_shower boolean DEFAULT false,
  desk_dimensions text,
  room_area_sqm numeric,
  view_type text,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_registry_id)
);
CREATE INDEX idx_room_characteristics_hotel ON public.room_characteristics(hotel_id);
CREATE INDEX idx_room_characteristics_room ON public.room_characteristics(room_registry_id);
ALTER TABLE public.room_characteristics ENABLE ROW LEVEL SECURITY;

-- 5) Space characteristics
CREATE TABLE public.space_characteristics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  common_space_id uuid NOT NULL REFERENCES public.common_spaces(id) ON DELETE CASCADE,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (common_space_id)
);
CREATE INDEX idx_space_characteristics_hotel ON public.space_characteristics(hotel_id);
ALTER TABLE public.space_characteristics ENABLE ROW LEVEL SECURITY;

-- 6) Equipment categories
CREATE TABLE public.equipment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, name)
);
CREATE INDEX idx_equipment_categories_hotel ON public.equipment_categories(hotel_id);
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;

-- 7) Equipments (linked to a room OR a common space)
CREATE TABLE public.equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_registry_id uuid REFERENCES public.hotel_rooms_registry(id) ON DELETE CASCADE,
  common_space_id uuid REFERENCES public.common_spaces(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.equipment_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  model text,
  reference text,
  serial_number text,
  purchase_date date,
  warranty_end_date date,
  purchase_price numeric,
  supplier text,
  photo_url text,
  condition text NOT NULL DEFAULT 'good',
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_must_have_location CHECK (
    (room_registry_id IS NOT NULL AND common_space_id IS NULL)
    OR (room_registry_id IS NULL AND common_space_id IS NOT NULL)
  ),
  CONSTRAINT equipment_condition_valid CHECK (
    condition IN ('new','good','worn','broken','missing','to_replace')
  )
);
CREATE INDEX idx_equipments_hotel ON public.equipments(hotel_id);
CREATE INDEX idx_equipments_room ON public.equipments(room_registry_id);
CREATE INDEX idx_equipments_space ON public.equipments(common_space_id);
CREATE INDEX idx_equipments_category ON public.equipments(category_id);
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;

-- 8) Equipment issues (link to incidents, persistent until resolved)
CREATE TABLE public.equipment_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES public.equipments(id) ON DELETE CASCADE,
  room_registry_id uuid REFERENCES public.hotel_rooms_registry(id) ON DELETE CASCADE,
  common_space_id uuid REFERENCES public.common_spaces(id) ON DELETE CASCADE,
  incident_id uuid,
  issue_type text NOT NULL DEFAULT 'to_repair',
  title text NOT NULL,
  description text,
  reported_by_name text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_issue_type_valid CHECK (
    issue_type IN ('to_repair','to_replace','missing','damaged','other')
  ),
  CONSTRAINT equipment_issue_status_valid CHECK (
    status IN ('open','in_progress','resolved')
  )
);
CREATE INDEX idx_equipment_issues_hotel ON public.equipment_issues(hotel_id);
CREATE INDEX idx_equipment_issues_equipment ON public.equipment_issues(equipment_id);
CREATE INDEX idx_equipment_issues_room ON public.equipment_issues(room_registry_id);
CREATE INDEX idx_equipment_issues_space ON public.equipment_issues(common_space_id);
CREATE INDEX idx_equipment_issues_status ON public.equipment_issues(status);
ALTER TABLE public.equipment_issues ENABLE ROW LEVEL SECURITY;

-- ============== RLS POLICIES ==============

-- Buildings
CREATE POLICY "buildings_select" ON public.buildings FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "buildings_manage" ON public.buildings FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));

-- Common spaces
CREATE POLICY "common_spaces_select" ON public.common_spaces FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "common_spaces_manage" ON public.common_spaces FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));

-- Room type templates
CREATE POLICY "room_type_templates_select" ON public.room_type_templates FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "room_type_templates_manage" ON public.room_type_templates FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));

-- Room characteristics
CREATE POLICY "room_characteristics_select" ON public.room_characteristics FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "room_characteristics_manage" ON public.room_characteristics FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));

-- Space characteristics
CREATE POLICY "space_characteristics_select" ON public.space_characteristics FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "space_characteristics_manage" ON public.space_characteristics FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));

-- Equipment categories
CREATE POLICY "equipment_categories_select" ON public.equipment_categories FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "equipment_categories_manage" ON public.equipment_categories FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));

-- Equipments
CREATE POLICY "equipments_select" ON public.equipments FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "equipments_manage" ON public.equipments FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));
-- Technicians can update equipment condition
CREATE POLICY "equipments_update_technician" ON public.equipments FOR UPDATE USING (public.is_technician_for_hotel(hotel_id)) WITH CHECK (public.is_technician_for_hotel(hotel_id));

-- Equipment issues: anyone with hotel access can read; admins manage; technicians can insert/update
CREATE POLICY "equipment_issues_select" ON public.equipment_issues FOR SELECT USING (public.can_access_hotel(hotel_id));
CREATE POLICY "equipment_issues_manage" ON public.equipment_issues FOR ALL USING (public.can_manage_hotel_data(hotel_id)) WITH CHECK (public.can_manage_hotel_data(hotel_id));
CREATE POLICY "equipment_issues_insert_tech" ON public.equipment_issues FOR INSERT WITH CHECK (public.is_technician_for_hotel(hotel_id));
CREATE POLICY "equipment_issues_update_tech" ON public.equipment_issues FOR UPDATE USING (public.is_technician_for_hotel(hotel_id)) WITH CHECK (public.is_technician_for_hotel(hotel_id));

-- ============== TRIGGERS updated_at ==============
CREATE TRIGGER trg_buildings_updated_at BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_common_spaces_updated_at BEFORE UPDATE ON public.common_spaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_room_type_templates_updated_at BEFORE UPDATE ON public.room_type_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_room_characteristics_updated_at BEFORE UPDATE ON public.room_characteristics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_space_characteristics_updated_at BEFORE UPDATE ON public.space_characteristics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_equipment_categories_updated_at BEFORE UPDATE ON public.equipment_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_equipments_updated_at BEFORE UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_equipment_issues_updated_at BEFORE UPDATE ON public.equipment_issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();