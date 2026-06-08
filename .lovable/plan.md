# Corriger le spam de notifications « Chambre nettoyée »

## Cause
Deux gestionnaires Realtime affichent un toast dès que le nouveau statut d'une chambre est `clean`, sans comparer avec l'ancien statut. Toute mise à jour d'une chambre déjà propre (re-synchro PMS, note, do_not_disturb, etc.) refait apparaître le toast, d'où la rafale au changement de page.

## Correction

### 1. `src/pages/Index.tsx` (~ligne 514)
Ne déclencher le toast que sur une vraie transition vers `clean` :
- exiger `oldRecord?.status !== 'clean'`
- ne notifier que sur `eventType === 'UPDATE'` (pas sur INSERT/chargement initial)

### 2. `src/hooks/use-dashboard-state.ts` (~ligne 199)
Même correction : ajouter la condition `oldRecord?.status !== 'clean'` et limiter à `UPDATE`.

### 3. Garde-fou supplémentaire (robustesse)
Pour les cas où l'ancien enregistrement serait incomplet, comparer aussi avec l'état local connu de la chambre (la valeur `prev` dans `setRooms`) : ne notifier que si la chambre n'était pas déjà `clean` côté interface. Cela évite tout faux positif même si `oldRecord` venait à manquer.

`src/hooks/use-realtime-rooms.ts` fait déjà la bonne vérification et ne sera pas modifié (au besoin, aligné sur la même logique pour cohérence).

## Résultat attendu
Le toast « ✅ Chambre nettoyée » n'apparaîtra qu'au moment réel où une chambre passe d'un autre statut à « propre », et plus à chaque changement de page ou re-synchronisation PMS.
