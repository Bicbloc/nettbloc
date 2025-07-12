-- Nettoyer les données dupliquées pour l'utilisateur support@bicbloc.eu
-- Garder seulement le plus récent hôtel et supprimer les doublons
DELETE FROM public.hotels 
WHERE email = 'support@bicbloc.eu' 
AND id NOT IN (
  SELECT id 
  FROM public.hotels 
  WHERE email = 'support@bicbloc.eu' 
  ORDER BY created_at DESC 
  LIMIT 1
);