# Corriger l'onglet « par étage » (n'affiche que RDC)

## Cause
Dans `src/components/governess/GovernessRedistributionStep.tsx`, la liste des étages est construite avec `Number(r.floor)`. Or `Number(null)` renvoie `0` (pas `NaN`), donc toutes les chambres sans étage renseigné deviennent l'étage `0` = **RDC**. Le filtre `!Number.isNaN` ne les écarte pas. Quand beaucoup de chambres ont `floor` nul, l'onglet ne montre plus que RDC.

## Correction
1. **Filtrer les étages réellement renseignés** avant la conversion numérique dans le `useMemo` des `floors` : ignorer `null`, `undefined` et chaîne vide, et ne garder que les valeurs finies.

   ```text
   rooms
     .filter((r) => r.floor !== null && r.floor !== undefined && `${r.floor}`.trim() !== '')
     .map((r) => Number(r.floor))
     .filter((n) => Number.isFinite(n))
   ```

2. **Repli sur le registre quand l'étage du jour est nul** : si une chambre n'a pas d'étage dans la table opérationnelle `rooms`, récupérer l'étage depuis `hotel_rooms_registry` (jointure par `room_number`) lors du chargement, afin que le maximum de chambres soient rattachées à un étage. Les chambres dont l'étage reste inconnu n'apparaîtront simplement pas dans l'onglet « par étage » (elles restent gérables via les autres onglets).

## Détails techniques
- Fichier concerné : `src/components/governess/GovernessRedistributionStep.tsx` (memo `floors`, et l'étape de fusion registre/quotidien déjà présente dans `load`).
- Aucune migration de base de données nécessaire.
- Vérification : sur un hôtel dont le registre contient plusieurs étages, l'onglet « par étage » doit lister tous les étages réels (1, 2, 3, …) et non uniquement RDC.
