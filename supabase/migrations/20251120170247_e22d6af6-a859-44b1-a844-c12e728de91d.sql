-- Insérer les postes de staff préconfigurés
INSERT INTO public.staff_roles (name, description, is_system, is_active, hotel_id) 
SELECT 
  name, 
  description, 
  true as is_system, 
  true as is_active,
  NULL as hotel_id
FROM (VALUES
  ('Technicien de Maintenance', 'Réparations générales et maintenance'),
  ('Plombier', 'Problèmes de plomberie et sanitaires'),
  ('Électricien', 'Problèmes électriques et éclairage'),
  ('Menuisier', 'Réparations de meubles et menuiseries'),
  ('Agent d''Entretien', 'Nettoyage et entretien général'),
  ('Responsable Technique', 'Supervision et coordination technique')
) AS roles(name, description)
ON CONFLICT DO NOTHING;