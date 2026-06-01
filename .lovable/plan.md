# Synchro automatique du matin (6h) + fonctionnement de la clôture

## Ce qui existe déjà

**La clôture fonctionne** (fonction `auto-close-day`, cron toutes les 15 min) :
- Chaque hôtel a ses réglages : `auto_close_enabled`, `auto_close_time`, `auto_close_days`, `auto_close_timezone`.
- Quand l'heure configurée est atteinte (dans le fuseau de l'hôtel), la journée se clôture : archivage du rapport quotidien + logs, puis **suppression des chambres, des affectations et des inventaires linge du jour**, et désactivation des sessions.
- Conséquence importante : après la clôture, la table des chambres est **vide** jusqu'à la prochaine synchro/import.

**Ce qui manque :** il n'y a **aucune synchro PMS automatique le matin**. Aujourd'hui il faut relancer manuellement « Tester la connexion » puis « Enregistrer les chambres » chaque jour. Le réglage « fréquence de synchro » est stocké mais n'est branché sur aucune tâche planifiée.

## Objectif
Chaque matin à 6h (heure locale de l'hôtel), synchroniser automatiquement Apaleo/Mews pour recréer les chambres du jour avec leur type (À blanc / Recouche / Arrivée / Hors service), prêtes pour l'affectation.

## Plan

### 1. Réglages de synchro auto (base de données)
Ajouter sur `hotel_pms_configs` :
- `auto_sync_enabled` (booléen, défaut `true`)
- `auto_sync_time` (heure, défaut `06:00`)
- `last_auto_sync_date` (date, pour éviter de synchroniser deux fois le même jour)

Le fuseau horaire réutilise celui de la clôture (`hotels.auto_close_timezone`, défaut `Europe/Paris`).

### 2. Action planifiée dans `pms-sync`
Ajouter une action `scheduled` à la fonction `pms-sync`, protégée par un secret (`CRON_SECRET`) au lieu de l'authentification utilisateur :
- Parcourt toutes les configs `is_active = true` et `auto_sync_enabled = true`.
- Pour chaque hôtel, calcule l'heure locale ; si l'heure de synchro est atteinte et que la synchro du jour n'a pas encore eu lieu, lance l'extraction des chambres (logique Apaleo/Mews déjà en place) et fait l'upsert dans `rooms`.
- Met à jour `last_auto_sync_date`, `last_sync_at`, `last_sync_status` et écrit un `pms_sync_logs`.

### 3. Tâche planifiée (cron)
Créer un cron Supabase qui appelle `pms-sync` (action `scheduled`) **toutes les 15 minutes** avec le `CRON_SECRET`. Le déclenchement réel au bon moment est géré dans la fonction selon le fuseau de chaque hôtel (même principe que `auto-close-day`).

### 4. Interface (PmsApiConfigPanel)
- Ajouter un interrupteur « Synchro automatique chaque matin » + un champ heure (défaut 06:00).
- Afficher la date/heure de dernière synchro auto.

## Points techniques
- Le secret `CRON_SECRET` sera ajouté via l'outil de secrets avant de brancher le cron.
- La synchro du matin a lieu après la clôture de la veille (chambres vides) → recréation propre, sans écraser le travail en cours.
- Repli : si un hôtel n'a pas de fuseau défini, on utilise `Europe/Paris`.

## Question
Veux-tu que l'heure de 6h soit **configurable par hôtel** (recommandé, comme la clôture) ou **fixe à 6h** pour tout le monde ?