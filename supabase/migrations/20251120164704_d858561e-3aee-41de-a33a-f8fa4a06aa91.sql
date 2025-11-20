-- Supprimer les anciennes données système si elles existent
DELETE FROM public.incident_items WHERE is_system = true;
DELETE FROM public.incident_categories WHERE is_system = true;

-- 1. CHAMBRES
INSERT INTO public.incident_categories (name, icon, is_system, is_active, display_order) VALUES
('Mobilier Chambre', '🛏️', true, true, 1),
('Éclairage Chambre', '💡', true, true, 2),
('Équipements Chambre', '📺', true, true, 3),
('Revêtements Chambre', '🎨', true, true, 4),
('Linge Chambre', '🧺', true, true, 5);

-- 2. SALLE DE BAIN
INSERT INTO public.incident_categories (name, icon, is_system, is_active, display_order) VALUES
('Sanitaires', '🚽', true, true, 6),
('Douche/Baignoire', '🚿', true, true, 7),
('Lavabo', '🚰', true, true, 8),
('Équipements Salle de Bain', '🧴', true, true, 9),
('Revêtements Salle de Bain', '🔲', true, true, 10);

-- 3. ESPACES COMMUNS
INSERT INTO public.incident_categories (name, icon, is_system, is_active, display_order) VALUES
('Couloirs/Hall', '🚪', true, true, 11),
('Signalétique', '🔖', true, true, 12),
('Office/Lingerie', '🧹', true, true, 13),
('Locaux Techniques', '🔧', true, true, 14),
('Parking', '🚗', true, true, 15);

-- 4. RESTAURANT & BAR
INSERT INTO public.incident_categories (name, icon, is_system, is_active, display_order) VALUES
('Restaurant/Bar', '🍽️', true, true, 16),
('Cuisine', '👨‍🍳', true, true, 17);

-- 5. SÉCURITÉ
INSERT INTO public.incident_categories (name, icon, is_system, is_active, display_order) VALUES
('Sécurité Incendie', '🧯', true, true, 18),
('Sécurité Générale', '🔒', true, true, 19);

-- 6. STOCKS
INSERT INTO public.incident_categories (name, icon, is_system, is_active, display_order) VALUES
('Stocks/Placards', '📦', true, true, 20);

-- Obtenir les IDs des catégories pour l'insertion des items
DO $$
DECLARE
  cat_mobilier_chambre UUID;
  cat_eclairage_chambre UUID;
  cat_equipements_chambre UUID;
  cat_revetements_chambre UUID;
  cat_linge_chambre UUID;
  cat_sanitaires UUID;
  cat_douche UUID;
  cat_lavabo UUID;
  cat_equipements_sdb UUID;
  cat_revetements_sdb UUID;
  cat_couloirs UUID;
  cat_signaletique UUID;
  cat_office UUID;
  cat_techniques UUID;
  cat_parking UUID;
  cat_restaurant UUID;
  cat_cuisine UUID;
  cat_incendie UUID;
  cat_securite UUID;
  cat_stocks UUID;
BEGIN
  -- Récupérer les IDs
  SELECT id INTO cat_mobilier_chambre FROM incident_categories WHERE name = 'Mobilier Chambre' AND is_system = true;
  SELECT id INTO cat_eclairage_chambre FROM incident_categories WHERE name = 'Éclairage Chambre' AND is_system = true;
  SELECT id INTO cat_equipements_chambre FROM incident_categories WHERE name = 'Équipements Chambre' AND is_system = true;
  SELECT id INTO cat_revetements_chambre FROM incident_categories WHERE name = 'Revêtements Chambre' AND is_system = true;
  SELECT id INTO cat_linge_chambre FROM incident_categories WHERE name = 'Linge Chambre' AND is_system = true;
  SELECT id INTO cat_sanitaires FROM incident_categories WHERE name = 'Sanitaires' AND is_system = true;
  SELECT id INTO cat_douche FROM incident_categories WHERE name = 'Douche/Baignoire' AND is_system = true;
  SELECT id INTO cat_lavabo FROM incident_categories WHERE name = 'Lavabo' AND is_system = true;
  SELECT id INTO cat_equipements_sdb FROM incident_categories WHERE name = 'Équipements Salle de Bain' AND is_system = true;
  SELECT id INTO cat_revetements_sdb FROM incident_categories WHERE name = 'Revêtements Salle de Bain' AND is_system = true;
  SELECT id INTO cat_couloirs FROM incident_categories WHERE name = 'Couloirs/Hall' AND is_system = true;
  SELECT id INTO cat_signaletique FROM incident_categories WHERE name = 'Signalétique' AND is_system = true;
  SELECT id INTO cat_office FROM incident_categories WHERE name = 'Office/Lingerie' AND is_system = true;
  SELECT id INTO cat_techniques FROM incident_categories WHERE name = 'Locaux Techniques' AND is_system = true;
  SELECT id INTO cat_parking FROM incident_categories WHERE name = 'Parking' AND is_system = true;
  SELECT id INTO cat_restaurant FROM incident_categories WHERE name = 'Restaurant/Bar' AND is_system = true;
  SELECT id INTO cat_cuisine FROM incident_categories WHERE name = 'Cuisine' AND is_system = true;
  SELECT id INTO cat_incendie FROM incident_categories WHERE name = 'Sécurité Incendie' AND is_system = true;
  SELECT id INTO cat_securite FROM incident_categories WHERE name = 'Sécurité Générale' AND is_system = true;
  SELECT id INTO cat_stocks FROM incident_categories WHERE name = 'Stocks/Placards' AND is_system = true;

  -- MOBILIER CHAMBRE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_mobilier_chambre, 'Lit', true, true, 1),
  (cat_mobilier_chambre, 'Matelas', true, true, 2),
  (cat_mobilier_chambre, 'Oreillers', true, true, 3),
  (cat_mobilier_chambre, 'Table de chevet', true, true, 4),
  (cat_mobilier_chambre, 'Bureau', true, true, 5),
  (cat_mobilier_chambre, 'Chaise/Fauteuil', true, true, 6),
  (cat_mobilier_chambre, 'Canapé', true, true, 7),
  (cat_mobilier_chambre, 'Placard/Dressing', true, true, 8),
  (cat_mobilier_chambre, 'Coffre-fort', true, true, 9),
  (cat_mobilier_chambre, 'Miroir', true, true, 10),
  (cat_mobilier_chambre, 'Cintres', true, true, 11);

  -- ÉCLAIRAGE CHAMBRE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_eclairage_chambre, 'Liseuse', true, true, 1),
  (cat_eclairage_chambre, 'Lampe de chevet', true, true, 2),
  (cat_eclairage_chambre, 'Lampadaire', true, true, 3),
  (cat_eclairage_chambre, 'Applique murale', true, true, 4),
  (cat_eclairage_chambre, 'Spots plafond', true, true, 5),
  (cat_eclairage_chambre, 'Interrupteur/Variateur', true, true, 6);

  -- ÉQUIPEMENTS CHAMBRE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_equipements_chambre, 'TV', true, true, 1),
  (cat_equipements_chambre, 'Télécommande', true, true, 2),
  (cat_equipements_chambre, 'Mini-bar/Frigo', true, true, 3),
  (cat_equipements_chambre, 'Machine à café', true, true, 4),
  (cat_equipements_chambre, 'Bouilloire', true, true, 5),
  (cat_equipements_chambre, 'Climatisation', true, true, 6),
  (cat_equipements_chambre, 'Chauffage', true, true, 7),
  (cat_equipements_chambre, 'Téléphone', true, true, 8),
  (cat_equipements_chambre, 'Rideaux', true, true, 9),
  (cat_equipements_chambre, 'Stores/Volets', true, true, 10),
  (cat_equipements_chambre, 'Serrure/Digicode', true, true, 11),
  (cat_equipements_chambre, 'Détecteur fumée', true, true, 12),
  (cat_equipements_chambre, 'Fenêtres', true, true, 13);

  -- REVÊTEMENTS CHAMBRE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_revetements_chambre, 'Moquette', true, true, 1),
  (cat_revetements_chambre, 'Parquet', true, true, 2),
  (cat_revetements_chambre, 'Papier peint', true, true, 3),
  (cat_revetements_chambre, 'Peinture murs', true, true, 4),
  (cat_revetements_chambre, 'Plafond', true, true, 5),
  (cat_revetements_chambre, 'Plinthes', true, true, 6);

  -- LINGE CHAMBRE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_linge_chambre, 'Draps', true, true, 1),
  (cat_linge_chambre, 'Taies', true, true, 2),
  (cat_linge_chambre, 'Couette', true, true, 3),
  (cat_linge_chambre, 'Serviettes', true, true, 4),
  (cat_linge_chambre, 'Tapis de bain', true, true, 5);

  -- SANITAIRES
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_sanitaires, 'WC', true, true, 1),
  (cat_sanitaires, 'Chasse d''eau', true, true, 2),
  (cat_sanitaires, 'Abattant', true, true, 3),
  (cat_sanitaires, 'Bidet', true, true, 4);

  -- DOUCHE/BAIGNOIRE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_douche, 'Receveur', true, true, 1),
  (cat_douche, 'Paroi/Rideau', true, true, 2),
  (cat_douche, 'Joints silicone', true, true, 3),
  (cat_douche, 'Pommeau de douche', true, true, 4),
  (cat_douche, 'Mitigeur', true, true, 5),
  (cat_douche, 'Bonde/Siphon', true, true, 6),
  (cat_douche, 'Baignoire', true, true, 7);

  -- LAVABO
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_lavabo, 'Vasque', true, true, 1),
  (cat_lavabo, 'Robinet', true, true, 2),
  (cat_lavabo, 'Meuble sous vasque', true, true, 3),
  (cat_lavabo, 'Miroir', true, true, 4);

  -- ÉQUIPEMENTS SALLE DE BAIN
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_equipements_sdb, 'Sèche-cheveux', true, true, 1),
  (cat_equipements_sdb, 'Distributeur savon', true, true, 2),
  (cat_equipements_sdb, 'Porte-serviette', true, true, 3),
  (cat_equipements_sdb, 'Porte-rouleau', true, true, 4),
  (cat_equipements_sdb, 'Poubelle', true, true, 5),
  (cat_equipements_sdb, 'Ventilation/VMC', true, true, 6),
  (cat_equipements_sdb, 'Radiateur sèche-serviette', true, true, 7);

  -- REVÊTEMENTS SALLE DE BAIN
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_revetements_sdb, 'Carrelage sol', true, true, 1),
  (cat_revetements_sdb, 'Carrelage mur', true, true, 2),
  (cat_revetements_sdb, 'Joints', true, true, 3),
  (cat_revetements_sdb, 'Faux plafond', true, true, 4);

  -- COULOIRS/HALL
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_couloirs, 'Canapés/Fauteuils', true, true, 1),
  (cat_couloirs, 'Tables', true, true, 2),
  (cat_couloirs, 'Tapis', true, true, 3),
  (cat_couloirs, 'Plantes', true, true, 4),
  (cat_couloirs, 'Œuvres murales', true, true, 5),
  (cat_couloirs, 'Ascenseur', true, true, 6),
  (cat_couloirs, 'Escaliers', true, true, 7),
  (cat_couloirs, 'Portes', true, true, 8),
  (cat_couloirs, 'Éclairage', true, true, 9);

  -- SIGNALÉTIQUE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_signaletique, 'Numéro de chambre', true, true, 1),
  (cat_signaletique, 'Panneau directionnel', true, true, 2),
  (cat_signaletique, 'Plan d''évacuation', true, true, 3),
  (cat_signaletique, 'Panneaux sécurité', true, true, 4);

  -- OFFICE/LINGERIE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_office, 'Chariot housekeeping', true, true, 1),
  (cat_office, 'Aspirateur', true, true, 2),
  (cat_office, 'Lave-linge', true, true, 3),
  (cat_office, 'Sèche-linge', true, true, 4),
  (cat_office, 'Table à repasser', true, true, 5),
  (cat_office, 'Fer à repasser', true, true, 6),
  (cat_office, 'Armoires/Rayonnages', true, true, 7),
  (cat_office, 'Stock linge', true, true, 8);

  -- LOCAUX TECHNIQUES
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_techniques, 'Tableau électrique', true, true, 1),
  (cat_techniques, 'Pompes', true, true, 2),
  (cat_techniques, 'Climatisation centrale', true, true, 3),
  (cat_techniques, 'Chaudière', true, true, 4),
  (cat_techniques, 'Groupe électrogène', true, true, 5),
  (cat_techniques, 'Tuyauterie', true, true, 6),
  (cat_techniques, 'Réseau internet', true, true, 7),
  (cat_techniques, 'Caméras/DVR', true, true, 8);

  -- PARKING
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_parking, 'Sol/Marquage', true, true, 1),
  (cat_parking, 'Barrières', true, true, 2),
  (cat_parking, 'Caméra', true, true, 3),
  (cat_parking, 'Éclairage', true, true, 4),
  (cat_parking, 'Ventilation', true, true, 5),
  (cat_parking, 'Borne électrique', true, true, 6),
  (cat_parking, 'Ascenseur', true, true, 7);

  -- RESTAURANT/BAR
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_restaurant, 'Tables', true, true, 1),
  (cat_restaurant, 'Chaises', true, true, 2),
  (cat_restaurant, 'Éclairage', true, true, 3),
  (cat_restaurant, 'Machine POS', true, true, 4),
  (cat_restaurant, 'Machine expresso', true, true, 5),
  (cat_restaurant, 'Réfrigérateur', true, true, 6);

  -- CUISINE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_cuisine, 'Lave-vaisselle', true, true, 1),
  (cat_cuisine, 'Four', true, true, 2),
  (cat_cuisine, 'Plaques', true, true, 3),
  (cat_cuisine, 'Hotte', true, true, 4),
  (cat_cuisine, 'Armoire froide', true, true, 5),
  (cat_cuisine, 'Plan de travail', true, true, 6),
  (cat_cuisine, 'Robinetterie', true, true, 7);

  -- SÉCURITÉ INCENDIE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_incendie, 'Extincteur', true, true, 1),
  (cat_incendie, 'RIA', true, true, 2),
  (cat_incendie, 'Alarme incendie', true, true, 3),
  (cat_incendie, 'Détecteur fumée', true, true, 4),
  (cat_incendie, 'Porte coupe-feu', true, true, 5),
  (cat_incendie, 'BAES', true, true, 6);

  -- SÉCURITÉ GÉNÉRALE
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_securite, 'Caméra de sécurité', true, true, 1),
  (cat_securite, 'Serrure', true, true, 2),
  (cat_securite, 'Digicode', true, true, 3),
  (cat_securite, 'Alarme', true, true, 4);

  -- STOCKS/PLACARDS
  INSERT INTO incident_items (category_id, name, is_system, is_active, display_order) VALUES
  (cat_stocks, 'Étagères', true, true, 1),
  (cat_stocks, 'Armoires', true, true, 2),
  (cat_stocks, 'Serrures', true, true, 3),
  (cat_stocks, 'Éclairage', true, true, 4);
END $$;

-- Mettre à jour les types d'incidents système avec des couleurs plus appropriées
DELETE FROM public.incident_types WHERE is_system = true;

INSERT INTO public.incident_types (name, severity, color, is_system, is_active) VALUES
('Cassé', 'high', '#ef4444', true, true),
('Endommagé', 'medium', '#f59e0b', true, true),
('Ne fonctionne pas', 'high', '#dc2626', true, true),
('À remplacer', 'medium', '#fb923c', true, true),
('À réparer', 'medium', '#fbbf24', true, true),
('Sale/Taché', 'low', '#94a3b8', true, true),
('Moisissure', 'high', '#7c3aed', true, true),
('Manquant', 'medium', '#6b7280', true, true),
('Fuite d''eau', 'high', '#0ea5e9', true, true),
('Odeur', 'low', '#84cc16', true, true),
('Problème électrique', 'high', '#eab308', true, true),
('Problème serrure', 'high', '#f97316', true, true),
('Risque chute/danger', 'high', '#dc2626', true, true);