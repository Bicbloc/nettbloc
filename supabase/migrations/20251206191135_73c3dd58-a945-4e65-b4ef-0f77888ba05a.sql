-- Supprimer l'ancienne policy d'insert et la recréer pour permettre les inserts anonymes
DROP POLICY IF EXISTS "Anyone can insert action logs" ON daily_action_logs;

-- Créer une nouvelle policy qui permet vraiment à tous d'insérer (y compris anon)
CREATE POLICY "Allow all inserts to action logs" 
ON daily_action_logs 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);