

# Correction du parsing universel et de l'entrainement

## Probleme

Deux bugs lies:

1. **Le rapport MisterBooking est mal classifie comme "medialog"** : les mots-cles RECOUCHE, BLANC, DEPART presents dans le rapport MisterBooking donnent un score de 10 au format `medialog_etat`. Mais le parser Medialog attend un format specifique (`110 PARTI S SGL 15/05`) qui ne correspond pas du tout a la structure MisterBooking. Resultat: 0 chambres detectees.

2. **L'entrainement affiche 0 chambres** : le wizard d'entrainement (`TrainingStep1bColumnMapping.tsx`) appelle `detectReportFormat()` qui tombe aussi dans le piege medialog → 0 lignes parsees → rien a afficher.

## Cause racine

Le systeme de scoring dans `FORMAT_SIGNATURES` donne des points a `medialog_etat` pour des mots-cles generiques (PARTI, RECOUCHE, DEPART, DRAPS) qui existent dans BEAUCOUP de rapports francophones, pas seulement Medialog. Quand un rapport non-Medialog contient ces mots, il est mal classifie.

## Solution

### Etape 1 -- Rendre les signatures Medialog plus specifiques

Dans `ReportFormatDetector.ts`, modifier les signatures `medialog_etat` pour exiger le format EXACT de Medialog (ex: `L'état des chambres` ou `Medialog` comme presence obligatoire) au lieu de matcher sur des mots-cles generiques:

- Reduire le poids des mots-cles generiques (PARTI, RECOUCHE, etc.) de 10 a 3
- Augmenter le seuil minimum pour les formats specifiques: seul un format avec score >= 15 sera considere comme "reconnu" (au lieu de 8)
- Ajouter une validation croisee: si le parser specifique retourne 0 lignes, fallback automatique vers `generic_table`

### Etape 2 -- Fallback automatique quand un parser specifique echoue

Dans `parseReportByFormat()` et `processPdf()`, ajouter une securite:
- Si le parser specifique (Mews/Apaleo/Medialog) retourne 0 lignes, re-parser avec `parseGenericReport()`
- Logger un warning pour signaler le mismatch
- Cela garantit qu'aucun rapport ne reste avec 0 chambres si du texte exploitable existe

### Etape 3 -- Ameliorer le parser generique pour les tableaux MisterBooking

Dans `parseGenericReport()`, ajouter:
- Support des lignes avec tabulations (format table PDF)
- Detection de numeros de chambre en colonne (pas seulement en debut de ligne)
- Accepter les numeros 2-3 chiffres suivis de suffixes comme `/` (ex: `104 / 105`)

### Etape 4 -- Corriger le wizard d'entrainement

Dans `TrainingStep1bColumnMapping.tsx`:
- Apres l'appel a `detectReportFormat()`, si `parsedData.rows.length === 0`, re-parser avec le format `generic_table` automatiquement
- Afficher un message explicatif si aucune chambre n'est detectee, avec un bouton pour forcer le parsing generique

## Details techniques

### Fichiers modifies

1. **`src/services/training/ReportFormatDetector.ts`**
   - `FORMAT_SIGNATURES.medialog_etat`: reduire le poids des keywords generiques (PARTI/RECOUCHE/DEPART/DRAPS) de 10 a 3
   - `detectFormat()`: augmenter le seuil de 8 a 15 pour les formats specifiques
   - `parseReportByFormat()`: si le parser retourne 0 rows, fallback vers `parseGenericReport()`
   - `parseGenericReport()`: supporter les lignes tab-separees et les patterns type `104 / 105`

2. **`src/services/pdfService.ts`**
   - Dans la section Phase 0b: si `formatDetection.parsedData.rows.length === 0` malgre un format detecte, re-detecter en forcant `generic_table`

3. **`src/components/training/TrainingStep1bColumnMapping.tsx`**
   - Apres `detectReportFormat()`, si 0 rows: re-parser avec `generic_table` en fallback

### Logique du fallback

```text
detectReportFormat(text):
  1. Calculer les scores de chaque format
  2. Si bestScore >= 15 → utiliser le parser specifique
  3. SI parser specifique retourne 0 rows → fallback parseGenericReport()
  4. Si bestScore < 15 → utiliser parseGenericReport()
```

### Impact

- Les rapports MisterBooking ne seront plus mal classifies comme Medialog
- Le parser generique detectera correctement les chambres 101-501 du rapport
- L'entrainement affichera les chambres au lieu d'un ecran vide
- Les vrais rapports Medialog continueront de fonctionner (score > 15 grace aux signatures specifiques comme "Medialog" ou "L'etat des chambres")
