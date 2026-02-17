

# Parser universel configurable par l'etablissement

## Probleme actuel

Le systeme contient des parsers specifiques codes en dur pour Mews, Apaleo, Medialog et Opera dans `ReportFormatDetector.ts`. Pour tout rapport non reconnu (comme MisterBooking), le parser generique detecte des faux positifs (chambres "1", "2", "3", "4" qui sont en realite des colonnes "Nb pers" ou des compteurs).

L'approche actuelle ne peut pas fonctionner a grande echelle car chaque hotel utilise un PMS different avec un format de rapport unique.

## Vision cible

Un parser **universel** qui fonctionne pour n'importe quel rapport, ou chaque etablissement configure/entraine le systeme a comprendre SON format de rapport specifique.

## Plan de correction

### Etape 1 — Supprimer la dependance aux parsers PMS hard-codes

Dans `pdfService.ts` (`processPdf()`), modifier la logique pour :
- **Ne plus privilegier** les parsers Mews/Apaleo/Medialog automatiquement
- **Toujours verifier d'abord** si l'hotel a un modele entraine (patterns sauvegardes via le TrainingWizard)
- Si un modele entraine existe : l'utiliser en priorite absolue
- Si aucun modele entraine : utiliser le parser generique + afficher la suggestion d'entrainement dans la preview

Concretement dans `processPdf()` :

```text
AVANT:
  1. Detecter format (Mews/Apaleo/Medialog/generic)
  2. Si format connu -> parser dedie
  3. Sinon -> fallback generique

APRES:
  1. Charger les patterns entraines de l'hotel (si hotelId)
  2. Si patterns entraines existent -> les utiliser en priorite
  3. Sinon -> detecter format et parser (generique ou dedie)
  4. Dans tous les cas -> appliquer les filtres post-extraction
```

### Etape 2 — Renforcer le parser generique contre les faux positifs

Dans `ReportFormatDetector.ts`, renforcer `parseGenericReport()` :
- Rejeter les numeros a 1 chiffre (1-9) qui sont presque toujours des faux positifs
- Exiger un minimum de contexte (mot-cle de statut, date, type de chambre) a cote du numero
- Ne pas accepter les lignes avec moins de 3 "colonnes" de donnees

### Etape 3 — Ameliorer la preview avec exclusion plus visible

Dans `PdfWorkflowDialog.tsx`, ameliorer l'interface de preview :
- Ajouter un bouton "Tout exclure" / "Tout inclure" pour faciliter la selection
- Afficher un avertissement clair si des chambres suspectes sont detectees (numeros courts, confiance basse)
- Mettre en evidence les chambres avec confiance < 50% pour attirer l'attention de l'utilisateur
- Rendre le bouton "Entrainer" plus visible et toujours present (pas seulement quand confiance < 70%)

### Etape 4 — Afficher les chambres suspectes en premier

Trier les chambres dans la preview par confiance croissante, pour que les faux positifs potentiels soient en haut et facilement exclus par l'utilisateur.

## Details techniques

### Fichiers modifies

1. **`src/services/pdfService.ts`** — Reorganiser `processPdf()` pour prioriser les patterns entraines
2. **`src/services/training/ReportFormatDetector.ts`** — Renforcer `parseGenericReport()` (rejeter les numeros courts sans contexte)
3. **`src/components/PdfWorkflowDialog.tsx`** — Ameliorer la preview : tri par confiance, boutons bulk exclusion, avertissements visuels, bouton "Entrainer" toujours visible

### Logique de priorite du parsing

```text
processPdf(file, hotelId):
  1. Extraire texte brut du PDF
  2. SI hotelId:
     a. Charger patterns entraines (hotel_trained_patterns)
     b. SI patterns existent ET nombre > 0:
        -> Parser avec le modele entraine (unifiedParserService)
        -> Marquer formatDetected = 'trained_model'
        -> Continuer vers filtrage
  3. Detecter format (Mews/Apaleo/etc. OU generique)
  4. Parser selon le format detecte
  5. Appliquer filtres post-extraction (rejeter faux positifs)
  6. Appliquer regles de combinaison hotel
  7. Retourner les chambres
```

### Impact

- Les parsers Mews/Apaleo/Medialog restent disponibles comme fallback mais ne sont plus prioritaires
- Chaque hotel qui entraine son systeme aura un parsing precise adapte a SON rapport
- Les faux positifs (1, 2, 3, 4, 01, 14) seront soit rejetes automatiquement soit facilement exclus manuellement
- Le bouton "Entrainer" est toujours visible pour encourager la configuration

