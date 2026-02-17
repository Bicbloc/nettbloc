
-- Drop and recreate the function with a comprehensive hotel incident catalog
CREATE OR REPLACE FUNCTION public.create_hotel_incident_defaults(p_hotel_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plomberie_id uuid;
  v_electricite_id uuid;
  v_mobilier_id uuid;
  v_menage_id uuid;
  v_climatisation_id uuid;
  v_serrurerie_id uuid;
  v_salle_de_bain_id uuid;
  v_literie_id uuid;
  v_electromenager_id uuid;
  v_revetements_id uuid;
  v_menuiserie_id uuid;
  v_securite_id uuid;
  v_exterieur_id uuid;
  v_multimedia_id uuid;
  v_equipements_id uuid;
BEGIN
  -- Staff roles
  INSERT INTO public.staff_roles (hotel_id, name, description, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Femme de chambre', 'Personnel d''entretien des chambres', false, true),
    (p_hotel_id, 'Technicien', 'Personnel technique et maintenance', false, true),
    (p_hotel_id, 'Équipier', 'Membre d''équipe polyvalent', false, true)
  ON CONFLICT DO NOTHING;

  -- ===================== CATEGORIES =====================
  INSERT INTO public.incident_categories (hotel_id, name, icon, display_order, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Plomberie', '🚰', 1, false, true),
    (p_hotel_id, 'Électricité', '⚡', 2, false, true),
    (p_hotel_id, 'Mobilier', '🪑', 3, false, true),
    (p_hotel_id, 'Ménage', '🧹', 4, false, true),
    (p_hotel_id, 'Climatisation / Chauffage', '❄️', 5, false, true),
    (p_hotel_id, 'Serrurerie / Accès', '🔑', 6, false, true),
    (p_hotel_id, 'Salle de bain', '🚿', 7, false, true),
    (p_hotel_id, 'Literie', '🛏️', 8, false, true),
    (p_hotel_id, 'Électroménager / Minibar', '🍽️', 9, false, true),
    (p_hotel_id, 'Revêtements / Murs / Sols', '🧱', 10, false, true),
    (p_hotel_id, 'Menuiserie / Fenêtres', '🪟', 11, false, true),
    (p_hotel_id, 'Sécurité', '🛡️', 12, false, true),
    (p_hotel_id, 'Extérieur / Espaces communs', '🏨', 13, false, true),
    (p_hotel_id, 'Multimédia / TV / Téléphonie', '📺', 14, false, true),
    (p_hotel_id, 'Équipements chambre', '🧴', 15, false, true)
  ON CONFLICT DO NOTHING;

  -- Fetch category IDs
  SELECT id INTO v_plomberie_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Plomberie' LIMIT 1;
  SELECT id INTO v_electricite_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Électricité' LIMIT 1;
  SELECT id INTO v_mobilier_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Mobilier' LIMIT 1;
  SELECT id INTO v_menage_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Ménage' LIMIT 1;
  SELECT id INTO v_climatisation_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Climatisation / Chauffage' LIMIT 1;
  SELECT id INTO v_serrurerie_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Serrurerie / Accès' LIMIT 1;
  SELECT id INTO v_salle_de_bain_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Salle de bain' LIMIT 1;
  SELECT id INTO v_literie_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Literie' LIMIT 1;
  SELECT id INTO v_electromenager_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Électroménager / Minibar' LIMIT 1;
  SELECT id INTO v_revetements_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Revêtements / Murs / Sols' LIMIT 1;
  SELECT id INTO v_menuiserie_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Menuiserie / Fenêtres' LIMIT 1;
  SELECT id INTO v_securite_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Sécurité' LIMIT 1;
  SELECT id INTO v_exterieur_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Extérieur / Espaces communs' LIMIT 1;
  SELECT id INTO v_multimedia_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Multimédia / TV / Téléphonie' LIMIT 1;
  SELECT id INTO v_equipements_id FROM public.incident_categories WHERE hotel_id = p_hotel_id AND name = 'Équipements chambre' LIMIT 1;

  -- ===================== ITEMS PER CATEGORY =====================

  -- PLOMBERIE
  IF v_plomberie_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_plomberie_id, 'WC', 1, false, true),
      (p_hotel_id, v_plomberie_id, 'Lavabo', 2, false, true),
      (p_hotel_id, v_plomberie_id, 'Douche', 3, false, true),
      (p_hotel_id, v_plomberie_id, 'Baignoire', 4, false, true),
      (p_hotel_id, v_plomberie_id, 'Robinetterie', 5, false, true),
      (p_hotel_id, v_plomberie_id, 'Siphon', 6, false, true),
      (p_hotel_id, v_plomberie_id, 'Chasse d''eau', 7, false, true),
      (p_hotel_id, v_plomberie_id, 'Tuyauterie', 8, false, true),
      (p_hotel_id, v_plomberie_id, 'Mitigeur', 9, false, true),
      (p_hotel_id, v_plomberie_id, 'Flexible de douche', 10, false, true),
      (p_hotel_id, v_plomberie_id, 'Pommeau de douche', 11, false, true),
      (p_hotel_id, v_plomberie_id, 'Bonde', 12, false, true),
      (p_hotel_id, v_plomberie_id, 'Joint', 13, false, true),
      (p_hotel_id, v_plomberie_id, 'Bidet', 14, false, true),
      (p_hotel_id, v_plomberie_id, 'Abattant WC', 15, false, true),
      (p_hotel_id, v_plomberie_id, 'Autre (Plomberie)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ELECTRICITE
  IF v_electricite_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_electricite_id, 'Prise électrique', 1, false, true),
      (p_hotel_id, v_electricite_id, 'Interrupteur', 2, false, true),
      (p_hotel_id, v_electricite_id, 'Éclairage plafonnier', 3, false, true),
      (p_hotel_id, v_electricite_id, 'Lampe de chevet', 4, false, true),
      (p_hotel_id, v_electricite_id, 'Lampe de bureau', 5, false, true),
      (p_hotel_id, v_electricite_id, 'Applique murale', 6, false, true),
      (p_hotel_id, v_electricite_id, 'Spot encastré', 7, false, true),
      (p_hotel_id, v_electricite_id, 'Ampoule', 8, false, true),
      (p_hotel_id, v_electricite_id, 'Variateur de lumière', 9, false, true),
      (p_hotel_id, v_electricite_id, 'Prise USB', 10, false, true),
      (p_hotel_id, v_electricite_id, 'Multiprise', 11, false, true),
      (p_hotel_id, v_electricite_id, 'Disjoncteur / Fusible', 12, false, true),
      (p_hotel_id, v_electricite_id, 'Détecteur de mouvement', 13, false, true),
      (p_hotel_id, v_electricite_id, 'Veilleuse', 14, false, true),
      (p_hotel_id, v_electricite_id, 'Autre (Électricité)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- MOBILIER
  IF v_mobilier_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_mobilier_id, 'Lit', 1, false, true),
      (p_hotel_id, v_mobilier_id, 'Armoire / Penderie', 2, false, true),
      (p_hotel_id, v_mobilier_id, 'Bureau', 3, false, true),
      (p_hotel_id, v_mobilier_id, 'Chaise', 4, false, true),
      (p_hotel_id, v_mobilier_id, 'Fauteuil', 5, false, true),
      (p_hotel_id, v_mobilier_id, 'Canapé', 6, false, true),
      (p_hotel_id, v_mobilier_id, 'Table de nuit', 7, false, true),
      (p_hotel_id, v_mobilier_id, 'Table basse', 8, false, true),
      (p_hotel_id, v_mobilier_id, 'Commode / Tiroirs', 9, false, true),
      (p_hotel_id, v_mobilier_id, 'Étagère', 10, false, true),
      (p_hotel_id, v_mobilier_id, 'Porte-bagages', 11, false, true),
      (p_hotel_id, v_mobilier_id, 'Miroir', 12, false, true),
      (p_hotel_id, v_mobilier_id, 'Cadre / Tableau', 13, false, true),
      (p_hotel_id, v_mobilier_id, 'Patère / Crochet', 14, false, true),
      (p_hotel_id, v_mobilier_id, 'Cintre', 15, false, true),
      (p_hotel_id, v_mobilier_id, 'Poubelle', 16, false, true),
      (p_hotel_id, v_mobilier_id, 'Porte-serviettes', 17, false, true),
      (p_hotel_id, v_mobilier_id, 'Autre (Mobilier)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- MENAGE
  IF v_menage_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_menage_id, 'Draps', 1, false, true),
      (p_hotel_id, v_menage_id, 'Serviettes', 2, false, true),
      (p_hotel_id, v_menage_id, 'Produits d''accueil', 3, false, true),
      (p_hotel_id, v_menage_id, 'Papier toilette', 4, false, true),
      (p_hotel_id, v_menage_id, 'Mouchoirs', 5, false, true),
      (p_hotel_id, v_menage_id, 'Sac poubelle', 6, false, true),
      (p_hotel_id, v_menage_id, 'Tache sur moquette', 7, false, true),
      (p_hotel_id, v_menage_id, 'Tache sur mur', 8, false, true),
      (p_hotel_id, v_menage_id, 'Mauvaise odeur', 9, false, true),
      (p_hotel_id, v_menage_id, 'Insecte / Nuisible', 10, false, true),
      (p_hotel_id, v_menage_id, 'Moisissure', 11, false, true),
      (p_hotel_id, v_menage_id, 'Peignoir', 12, false, true),
      (p_hotel_id, v_menage_id, 'Chaussons', 13, false, true),
      (p_hotel_id, v_menage_id, 'Couverture supplémentaire', 14, false, true),
      (p_hotel_id, v_menage_id, 'Oreiller supplémentaire', 15, false, true),
      (p_hotel_id, v_menage_id, 'Autre (Ménage)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- CLIMATISATION / CHAUFFAGE
  IF v_climatisation_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_climatisation_id, 'Climatisation', 1, false, true),
      (p_hotel_id, v_climatisation_id, 'Chauffage', 2, false, true),
      (p_hotel_id, v_climatisation_id, 'Ventilation / VMC', 3, false, true),
      (p_hotel_id, v_climatisation_id, 'Thermostat', 4, false, true),
      (p_hotel_id, v_climatisation_id, 'Radiateur', 5, false, true),
      (p_hotel_id, v_climatisation_id, 'Ventilateur', 6, false, true),
      (p_hotel_id, v_climatisation_id, 'Filtre climatisation', 7, false, true),
      (p_hotel_id, v_climatisation_id, 'Télécommande clim', 8, false, true),
      (p_hotel_id, v_climatisation_id, 'Sèche-serviettes', 9, false, true),
      (p_hotel_id, v_climatisation_id, 'Autre (Clim/Chauffage)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- SERRURERIE / ACCES
  IF v_serrurerie_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_serrurerie_id, 'Serrure de porte', 1, false, true),
      (p_hotel_id, v_serrurerie_id, 'Lecteur de carte', 2, false, true),
      (p_hotel_id, v_serrurerie_id, 'Poignée de porte', 3, false, true),
      (p_hotel_id, v_serrurerie_id, 'Verrou / Loquet', 4, false, true),
      (p_hotel_id, v_serrurerie_id, 'Clé', 5, false, true),
      (p_hotel_id, v_serrurerie_id, 'Badge / Carte magnétique', 6, false, true),
      (p_hotel_id, v_serrurerie_id, 'Judas', 7, false, true),
      (p_hotel_id, v_serrurerie_id, 'Chaîne de sécurité', 8, false, true),
      (p_hotel_id, v_serrurerie_id, 'Coffre-fort', 9, false, true),
      (p_hotel_id, v_serrurerie_id, 'Autre (Serrurerie)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- SALLE DE BAIN
  IF v_salle_de_bain_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_salle_de_bain_id, 'Miroir salle de bain', 1, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Paroi de douche', 2, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Rideau de douche', 3, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Carrelage', 4, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Joint de silicone', 5, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Distributeur de savon', 6, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Sèche-cheveux', 7, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Balance', 8, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Tablette / Étagère SDB', 9, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Tapis de bain', 10, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Patère SDB', 11, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Dérouleur papier WC', 12, false, true),
      (p_hotel_id, v_salle_de_bain_id, 'Autre (Salle de bain)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- LITERIE
  IF v_literie_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_literie_id, 'Matelas', 1, false, true),
      (p_hotel_id, v_literie_id, 'Sommier', 2, false, true),
      (p_hotel_id, v_literie_id, 'Oreiller', 3, false, true),
      (p_hotel_id, v_literie_id, 'Couette', 4, false, true),
      (p_hotel_id, v_literie_id, 'Drap housse', 5, false, true),
      (p_hotel_id, v_literie_id, 'Protège-matelas', 6, false, true),
      (p_hotel_id, v_literie_id, 'Tête de lit', 7, false, true),
      (p_hotel_id, v_literie_id, 'Lit bébé / Lit d''appoint', 8, false, true),
      (p_hotel_id, v_literie_id, 'Traversin', 9, false, true),
      (p_hotel_id, v_literie_id, 'Autre (Literie)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ELECTROMENAGER / MINIBAR
  IF v_electromenager_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_electromenager_id, 'Minibar / Réfrigérateur', 1, false, true),
      (p_hotel_id, v_electromenager_id, 'Bouilloire', 2, false, true),
      (p_hotel_id, v_electromenager_id, 'Machine à café / Nespresso', 3, false, true),
      (p_hotel_id, v_electromenager_id, 'Plateau de courtoisie', 4, false, true),
      (p_hotel_id, v_electromenager_id, 'Fer à repasser', 5, false, true),
      (p_hotel_id, v_electromenager_id, 'Table à repasser', 6, false, true),
      (p_hotel_id, v_electromenager_id, 'Micro-ondes', 7, false, true),
      (p_hotel_id, v_electromenager_id, 'Grille-pain', 8, false, true),
      (p_hotel_id, v_electromenager_id, 'Aspirateur', 9, false, true),
      (p_hotel_id, v_electromenager_id, 'Autre (Électroménager)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- REVETEMENTS / MURS / SOLS
  IF v_revetements_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_revetements_id, 'Moquette', 1, false, true),
      (p_hotel_id, v_revetements_id, 'Parquet', 2, false, true),
      (p_hotel_id, v_revetements_id, 'Carrelage sol', 3, false, true),
      (p_hotel_id, v_revetements_id, 'Lino / Vinyle', 4, false, true),
      (p_hotel_id, v_revetements_id, 'Peinture murale', 5, false, true),
      (p_hotel_id, v_revetements_id, 'Papier peint', 6, false, true),
      (p_hotel_id, v_revetements_id, 'Plafond', 7, false, true),
      (p_hotel_id, v_revetements_id, 'Plinthe', 8, false, true),
      (p_hotel_id, v_revetements_id, 'Faux plafond', 9, false, true),
      (p_hotel_id, v_revetements_id, 'Autre (Revêtements)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- MENUISERIE / FENETRES
  IF v_menuiserie_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_menuiserie_id, 'Fenêtre', 1, false, true),
      (p_hotel_id, v_menuiserie_id, 'Volet roulant', 2, false, true),
      (p_hotel_id, v_menuiserie_id, 'Store / Rideau', 3, false, true),
      (p_hotel_id, v_menuiserie_id, 'Porte intérieure', 4, false, true),
      (p_hotel_id, v_menuiserie_id, 'Porte de salle de bain', 5, false, true),
      (p_hotel_id, v_menuiserie_id, 'Porte coulissante', 6, false, true),
      (p_hotel_id, v_menuiserie_id, 'Porte de placard', 7, false, true),
      (p_hotel_id, v_menuiserie_id, 'Balcon / Garde-corps', 8, false, true),
      (p_hotel_id, v_menuiserie_id, 'Moustiquaire', 9, false, true),
      (p_hotel_id, v_menuiserie_id, 'Charnière / Gond', 10, false, true),
      (p_hotel_id, v_menuiserie_id, 'Autre (Menuiserie)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- SECURITE
  IF v_securite_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_securite_id, 'Détecteur de fumée', 1, false, true),
      (p_hotel_id, v_securite_id, 'Extincteur', 2, false, true),
      (p_hotel_id, v_securite_id, 'Éclairage de secours', 3, false, true),
      (p_hotel_id, v_securite_id, 'Plan d''évacuation', 4, false, true),
      (p_hotel_id, v_securite_id, 'Caméra de surveillance', 5, false, true),
      (p_hotel_id, v_securite_id, 'Alarme incendie', 6, false, true),
      (p_hotel_id, v_securite_id, 'Issue de secours', 7, false, true),
      (p_hotel_id, v_securite_id, 'Autre (Sécurité)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- EXTERIEUR / ESPACES COMMUNS
  IF v_exterieur_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_exterieur_id, 'Ascenseur', 1, false, true),
      (p_hotel_id, v_exterieur_id, 'Escalier', 2, false, true),
      (p_hotel_id, v_exterieur_id, 'Couloir', 3, false, true),
      (p_hotel_id, v_exterieur_id, 'Parking', 4, false, true),
      (p_hotel_id, v_exterieur_id, 'Piscine', 5, false, true),
      (p_hotel_id, v_exterieur_id, 'Spa / Sauna', 6, false, true),
      (p_hotel_id, v_exterieur_id, 'Salle de sport', 7, false, true),
      (p_hotel_id, v_exterieur_id, 'Terrasse', 8, false, true),
      (p_hotel_id, v_exterieur_id, 'Jardin', 9, false, true),
      (p_hotel_id, v_exterieur_id, 'Hall / Réception', 10, false, true),
      (p_hotel_id, v_exterieur_id, 'Salle de réunion', 11, false, true),
      (p_hotel_id, v_exterieur_id, 'Restaurant / Bar', 12, false, true),
      (p_hotel_id, v_exterieur_id, 'Buanderie', 13, false, true),
      (p_hotel_id, v_exterieur_id, 'Autre (Espaces communs)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- MULTIMEDIA / TV / TELEPHONIE
  IF v_multimedia_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_multimedia_id, 'Téléviseur', 1, false, true),
      (p_hotel_id, v_multimedia_id, 'Télécommande TV', 2, false, true),
      (p_hotel_id, v_multimedia_id, 'Téléphone fixe', 3, false, true),
      (p_hotel_id, v_multimedia_id, 'Wi-Fi / Internet', 4, false, true),
      (p_hotel_id, v_multimedia_id, 'Câble HDMI', 5, false, true),
      (p_hotel_id, v_multimedia_id, 'Enceinte Bluetooth', 6, false, true),
      (p_hotel_id, v_multimedia_id, 'Radio / Réveil', 7, false, true),
      (p_hotel_id, v_multimedia_id, 'Chargeur sans fil', 8, false, true),
      (p_hotel_id, v_multimedia_id, 'Tablette interactive', 9, false, true),
      (p_hotel_id, v_multimedia_id, 'Autre (Multimédia)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- EQUIPEMENTS CHAMBRE
  IF v_equipements_id IS NOT NULL THEN
    INSERT INTO public.incident_items (hotel_id, category_id, name, display_order, is_system, is_active) VALUES
      (p_hotel_id, v_equipements_id, 'Rideaux occultants', 1, false, true),
      (p_hotel_id, v_equipements_id, 'Voilage', 2, false, true),
      (p_hotel_id, v_equipements_id, 'Tringle à rideau', 3, false, true),
      (p_hotel_id, v_equipements_id, 'Store vénitien', 4, false, true),
      (p_hotel_id, v_equipements_id, 'Coussin', 5, false, true),
      (p_hotel_id, v_equipements_id, 'Plaid / Couverture', 6, false, true),
      (p_hotel_id, v_equipements_id, 'Tapis', 7, false, true),
      (p_hotel_id, v_equipements_id, 'Corbeille à fruits', 8, false, true),
      (p_hotel_id, v_equipements_id, 'Kit couture', 9, false, true),
      (p_hotel_id, v_equipements_id, 'Kit cirage', 10, false, true),
      (p_hotel_id, v_equipements_id, 'Papeterie / Bloc-notes', 11, false, true),
      (p_hotel_id, v_equipements_id, 'Parapluie', 12, false, true),
      (p_hotel_id, v_equipements_id, 'Adaptateur prise', 13, false, true),
      (p_hotel_id, v_equipements_id, 'Autre (Équipements)', 99, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ===================== INCIDENT TYPES =====================
  INSERT INTO public.incident_types (hotel_id, name, color, severity, is_system, is_active)
  VALUES 
    (p_hotel_id, 'Cassé / En panne', '#ef4444', 'high', false, true),
    (p_hotel_id, 'Manquant', '#f97316', 'medium', false, true),
    (p_hotel_id, 'Sale / À nettoyer', '#eab308', 'low', false, true),
    (p_hotel_id, 'Usé / À remplacer', '#3b82f6', 'medium', false, true),
    (p_hotel_id, 'Fuite', '#06b6d4', 'high', false, true),
    (p_hotel_id, 'Bruyant', '#8b5cf6', 'medium', false, true),
    (p_hotel_id, 'Bloqué / Coincé', '#ec4899', 'medium', false, true),
    (p_hotel_id, 'Dégât des eaux', '#dc2626', 'urgent', false, true),
    (p_hotel_id, 'Autre', '#6b7280', 'low', false, true)
  ON CONFLICT DO NOTHING;
END;
$function$;
