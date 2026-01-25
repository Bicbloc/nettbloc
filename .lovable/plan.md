
# Plan : Corriger l'Application des Règles de Combinaison

## Contexte du Problème
Le système d'apprentissage sauvegarde correctement les règles de combinaison dans `hotel_combination_rules`, mais ces règles ne sont pas appliquées quand un format Mews/Apaleo/Medialog est détecté avec confiance ≥50%. Le `ReportFormatDetector` utilise une logique codée en dur au lieu des règles personnalisées de l'hôtel.

## Solution Proposée

### Étape 1 : Modifier pdfService.ts pour appliquer les règles après ReportFormatDetector
Après l'extraction par `ReportFormatDetector`, appeler `UnifiedParserService.loadHotelPatterns()` et réappliquer les règles de combinaison sur les résultats.

```text
Flux actuel :
PDF → ReportFormatDetector → Rooms (sans règles perso)

Flux corrigé :
PDF → ReportFormatDetector → Charger règles hotel → Appliquer combinaisons → Rooms finaux
```

### Étape 2 : Créer une fonction de réanalyse des chambres
Dans `pdfService.ts`, ajouter une fonction `applyHotelCombinationRules()` qui :
1. Charge les règles de combinaison de l'hôtel via `supabase`
2. Pour chaque chambre parsée, vérifie si une règle de combinaison s'applique
3. Remplace le `cleaningType` par celui de la règle si elle matche

### Étape 3 : Modifier ReportFormatDetector pour exposer le contexte
Ajouter dans `ParsedRow` les informations de contexte nécessaires :
- `hasArrivalDate`, `hasDepartureDate`
- `hasArrivalTime`, `hasDepartureTime` 
- `hasNightInfo`
- `rawLine` (déjà présent)

### Étape 4 : Intégrer dans le flux d'import

Modifier `processPdf()` :
```text
// Après la détection Mews/Apaleo/Medialog
if (hotelId && formatDetection.confidence >= 50) {
  // Charger les règles de combinaison de l'hôtel
  const combinationRules = await loadHotelCombinationRules(hotelId);
  
  // Appliquer les règles aux chambres parsées
  if (combinationRules.length > 0) {
    rooms = applyHotelCombinationRules(rooms, combinationRules, parsedRows);
  }
}
```

---

## Détails Techniques

### Fichiers à Modifier

1. **src/services/pdfService.ts**
   - Ajouter import de supabase
   - Créer fonction `loadHotelCombinationRules(hotelId)`
   - Créer fonction `applyHotelCombinationRules(rooms, rules, parsedRows)`
   - Modifier le bloc Phase 0 pour appliquer les règles après extraction

2. **src/services/training/ReportFormatDetector.ts** (optionnel)
   - S'assurer que `rawLine` et les flags de contexte sont bien exposés dans `ParsedRow`

### Structure des règles de combinaison
```text
{
  status_keywords: ['SAL', 'DIR'],
  arrival_date: 'present' | 'absent' | 'any',
  departure_date: 'present' | 'absent' | 'any',
  arrival_time: 'present' | 'absent' | 'any',
  departure_time: 'present' | 'absent' | 'any',
  night_info: 'present' | 'absent' | 'any',
  result_cleaning_type: 'full' | 'quick' | 'none'
}
```

### Logique de matching
Pour chaque chambre :
1. Extraire le contexte de la ligne (dates, heures, mots-clés présents)
2. Parcourir les règles par priorité
3. Si tous les critères matchent → appliquer le `result_cleaning_type`
4. Sinon → garder le type détecté par ReportFormatDetector

---

## Résultat Attendu
- Les règles de combinaison créées dans le Training Wizard seront appliquées à **tous** les imports PDF
- Que le rapport soit Mews, Apaleo, Medialog ou autre format
- Le client pourra définir : "SAL + 2 dates = À blanc" et cela sera respecté partout
