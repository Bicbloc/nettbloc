# Plan : Corriger l'Application des Règles de Combinaison ✅ IMPLÉMENTÉ

## Statut: TERMINÉ

Les règles de combinaison créées dans le Training Wizard sont maintenant appliquées à **tous** les imports PDF, y compris les formats Mews, Apaleo et Medialog.

## Modifications apportées

### `src/services/pdfService.ts`
1. ✅ Import de supabase pour accéder à la base de données
2. ✅ Création de `loadHotelCombinationRules(hotelId)` - charge les règles actives par priorité
3. ✅ Création de `extractRoomContext(row)` - extrait le contexte (dates, heures, statuts) d'une ligne
4. ✅ Création de `matchesCombinationRule(rule, context)` - vérifie si une règle correspond
5. ✅ Création de `applyHotelCombinationRules(rooms, rules, parsedRows)` - applique les règles et modifie les types de nettoyage
6. ✅ Intégration dans le flux PDF Phase 0 (après ReportFormatDetector)

## Flux corrigé
```
PDF → ReportFormatDetector (Mews/Apaleo/Medialog) 
    → Charger hotel_combination_rules depuis Supabase
    → Appliquer les règles par priorité décroissante
    → Rooms finaux avec types de nettoyage personnalisés
```

## Exemple d'utilisation
Le client peut maintenant définir : **"SAL + 2 dates = À blanc"** et cela sera respecté lors de chaque import PDF.
