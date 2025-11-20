-- =============================================
-- SYSTÈME DE GESTION DES INCIDENTS HÔTEL
-- =============================================

-- Table des catégories d'incidents (Chambres, Salle de bain, etc.)
CREATE TABLE IF NOT EXISTS public.incident_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT, -- Emoji ou nom d'icône
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- Les catégories système ne peuvent pas être supprimées
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hotel_id, name)
);

-- Table des items (Lit, Matelas, TV, etc.)
CREATE TABLE IF NOT EXISTS public.incident_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.incident_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

-- Table des types d'incidents (Cassé, Endommagé, etc.)
CREATE TABLE IF NOT EXISTS public.incident_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT, -- Code couleur hex
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hotel_id, name)
);

-- Table des rôles du personnel
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hotel_id, name)
);

-- Table principale des incidents
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  
  -- Incident details
  category_id UUID REFERENCES public.incident_categories(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.incident_items(id) ON DELETE SET NULL,
  type_id UUID REFERENCES public.incident_types(id) ON DELETE SET NULL,
  
  -- Location
  location_type TEXT CHECK (location_type IN ('room', 'common_area', 'technical', 'other')),
  location_reference TEXT, -- Room number ou description
  
  -- Description
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('new', 'assigned', 'in_progress', 'resolved', 'cancelled')) DEFAULT 'new',
  
  -- Assignment
  assigned_to_role_id UUID REFERENCES public.staff_roles(id) ON DELETE SET NULL,
  assigned_to_user_id UUID, -- Optionnel: assigner à un utilisateur spécifique
  assigned_to_other TEXT, -- Si "Autre" est sélectionné
  
  -- Tracking
  reported_by UUID NOT NULL, -- ID de l'utilisateur qui a créé le rapport
  reported_by_name TEXT NOT NULL, -- Nom pour l'affichage
  reported_by_type TEXT NOT NULL, -- 'admin', 'housekeeper', etc.
  
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  due_date TIMESTAMPTZ
);

-- Table des images d'incidents
CREATE TABLE IF NOT EXISTS public.incident_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Table des commentaires d'incidents
CREATE TABLE IF NOT EXISTS public.incident_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_type TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_incidents_hotel ON public.incidents(hotel_id);
CREATE INDEX idx_incidents_status ON public.incidents(hotel_id, status);
CREATE INDEX idx_incidents_priority ON public.incidents(priority);
CREATE INDEX idx_incidents_assigned_role ON public.incidents(assigned_to_role_id);
CREATE INDEX idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX idx_incident_categories_hotel ON public.incident_categories(hotel_id);
CREATE INDEX idx_incident_items_category ON public.incident_items(category_id);
CREATE INDEX idx_incident_types_hotel ON public.incident_types(hotel_id);
CREATE INDEX idx_staff_roles_hotel ON public.staff_roles(hotel_id);
CREATE INDEX idx_incident_images_incident ON public.incident_images(incident_id);
CREATE INDEX idx_incident_comments_incident ON public.incident_comments(incident_id);

-- RLS Policies
ALTER TABLE public.incident_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;

-- Policies pour incident_categories
CREATE POLICY "Hotel owners can manage incident categories"
ON public.incident_categories FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = incident_categories.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Policies pour incident_items
CREATE POLICY "Hotel owners can manage incident items"
ON public.incident_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = incident_items.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Policies pour incident_types
CREATE POLICY "Hotel owners can manage incident types"
ON public.incident_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = incident_types.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Policies pour staff_roles
CREATE POLICY "Hotel owners can manage staff roles"
ON public.staff_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = staff_roles.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Policies pour incidents
CREATE POLICY "Hotel staff can create incidents"
ON public.incidents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = incidents.hotel_id
    AND (h.user_id = auth.uid() OR auth.uid() IS NOT NULL)
  )
);

CREATE POLICY "Hotel owners can view their incidents"
ON public.incidents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = incidents.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Hotel owners can update incidents"
ON public.incidents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = incidents.hotel_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Hotel owners can delete incidents"
ON public.incidents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.hotels h
    WHERE h.id = incidents.hotel_id
    AND h.user_id = auth.uid()
  )
);

-- Policies pour incident_images
CREATE POLICY "Hotel staff can manage incident images"
ON public.incident_images FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.incidents i
    JOIN public.hotels h ON h.id = i.hotel_id
    WHERE i.id = incident_images.incident_id
    AND (h.user_id = auth.uid() OR i.reported_by = auth.uid())
  )
);

-- Policies pour incident_comments
CREATE POLICY "Hotel staff can manage incident comments"
ON public.incident_comments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.incidents i
    JOIN public.hotels h ON h.id = i.hotel_id
    WHERE i.id = incident_comments.incident_id
    AND (h.user_id = auth.uid() OR i.reported_by = auth.uid())
  )
);

-- Triggers pour mettre à jour updated_at
CREATE TRIGGER update_incident_categories_updated_at
BEFORE UPDATE ON public.incident_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incident_items_updated_at
BEFORE UPDATE ON public.incident_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incident_types_updated_at
BEFORE UPDATE ON public.incident_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_roles_updated_at
BEFORE UPDATE ON public.staff_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Commentaires
COMMENT ON TABLE public.incidents IS 'Table principale des incidents signalés dans l''hôtel';
COMMENT ON TABLE public.incident_categories IS 'Catégories d''incidents (Chambres, Salle de bain, etc.)';
COMMENT ON TABLE public.incident_items IS 'Items spécifiques par catégorie (Lit, TV, etc.)';
COMMENT ON TABLE public.incident_types IS 'Types d''incidents (Cassé, Endommagé, etc.)';
COMMENT ON TABLE public.staff_roles IS 'Rôles du personnel pour assignation (Équipier, Technicien, etc.)';