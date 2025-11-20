-- Ajouter un champ role_id à la table housekeepers
ALTER TABLE public.housekeepers
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.staff_roles(id) ON DELETE SET NULL;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_housekeepers_role_id ON public.housekeepers(role_id);

-- Fonction pour créer les données de base pour un hôtel
CREATE OR REPLACE FUNCTION public.create_hotel_incident_defaults(p_hotel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plomberie_id uuid;
  v_electricite_id uuid;
  v_mobilier_id uuid;
  v_menage_id uuid;
  v_climatisation_id uuid;
BEGIN
  -- Créer les rôles de base s'ils n'existent pas
  INSERT INTO public.staff_roles (hotel_id, name, description, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Femme de chambre', 'Personnel d''entretien des chambres', false, true),
    (p_hotel_id, 'Technicien', 'Personnel technique et maintenance', false, true),
    (p_hotel_id, 'Équipier', 'Membre d''équipe polyvalent', false, true)
  ON CONFLICT DO NOTHING;

  -- Créer les catégories de base
  INSERT INTO public.incident_categories (hotel_id, name, icon, display_order, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Plomberie', '🚰', 1, false, true),
    (p_hotel_id, 'Électricité', '⚡', 2, false, true),
    (p_hotel_id, 'Mobilier', '🛏️', 3, false, true),
    (p_hotel_id, 'Ménage', '🧹', 4, false, true),
    (p_hotel_id, 'Climatisation', '❄️', 5, false, true)
  ON CONFLICT DO NOTHING;

  -- Récupérer les IDs des catégories
  SELECT id INTO v_plomberie_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Plomberie' LIMIT 1;
  SELECT id INTO v_electricite_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Électricité' LIMIT 1;
  SELECT id INTO v_mobilier_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Mobilier' LIMIT 1;
  SELECT id INTO v_menage_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Ménage' LIMIT 1;
  SELECT id INTO v_climatisation_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Climatisation' LIMIT 1;

  -- Créer les items pour chaque catégorie
  IF v_plomberie_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_plomberie_id, 'WC', 1, false, true),
      (p_hotel_id, v_plomberie_id, 'Lavabo', 2, false, true),
      (p_hotel_id, v_plomberie_id, 'Douche', 3, false, true),
      (p_hotel_id, v_plomberie_id, 'Robinetterie', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_electricite_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_electricite_id, 'Prise électrique', 1, false, true),
      (p_hotel_id, v_electricite_id, 'Interrupteur', 2, false, true),
      (p_hotel_id, v_electricite_id, 'Éclairage', 3, false, true),
      (p_hotel_id, v_electricite_id, 'Téléphone', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mobilier_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_mobilier_id, 'Lit', 1, false, true),
      (p_hotel_id, v_mobilier_id, 'Armoire', 2, false, true),
      (p_hotel_id, v_mobilier_id, 'Bureau', 3, false, true),
      (p_hotel_id, v_mobilier_id, 'Chaise', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_menage_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_menage_id, 'Draps', 1, false, true),
      (p_hotel_id, v_menage_id, 'Serviettes', 2, false, true),
      (p_hotel_id, v_menage_id, 'Produits d''accueil', 3, false, true),
      (p_hotel_id, v_menage_id, 'Poubelle', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_climatisation_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active)
    VALUES 
      (p_hotel_id, v_climatisation_id, 'Climatisation', 1, false, true),
      (p_hotel_id, v_climatisation_id, 'Chauffage', 2, false, true),
      (p_hotel_id, v_climatisation_id, 'Ventilation', 3, false, true),
      (p_hotel_id, v_climatisation_id, 'Thermostat', 4, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Créer les types de problèmes de base
  INSERT INTO public.incident_types (hotel_id, name, color, severity, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Cassé / En panne', '#ef4444', 'high', false, true),
    (p_hotel_id, 'Manquant', '#f97316', 'medium', false, true),
    (p_hotel_id, 'Sale / À nettoyer', '#eab308', 'low', false, true),
    (p_hotel_id, 'Usé / À remplacer', '#3b82f6', 'medium', false, true),
    (p_hotel_id, 'Autre', '#6b7280', 'low', false, true)
  ON CONFLICT DO NOTHING;
END;
$$;