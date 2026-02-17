

# Amelioration de la precision du parsing PDF a 99%

## Analyse de l'architecture actuelle

Le systeme de parsing est deja tres sophistique avec une architecture multi-couches :

```text
Phase 0: ReportFormatDetector (Apaleo/Mews/Medialog)
    |
    +-- Supplementation par patterns entraines (UnifiedParserService)
    |
Phase 1: RoomLineParser (fallback)
    |
Phase 2: UnifiedParserService + AI fallback (learn-pattern)
    |
Post-traitement: Regles de combinaison + Mappings personnalises
```

## Points forts actuels
- Detection multi-PMS (Mews, Apaleo, Opera, Medialog, Protel, Fidelio)
- Systeme d'apprentissage (patterns valides, regles permanentes, patterns contextuels)
- Fallback IA automatique quand la confiance est faible
- Regles de combinaison configurables par hotel
- Fusion intelligente entre parsing local et IA
- Validation post-extraction avec scoring de confiance

## Faiblesses identifiees

### 1. Formats PDF non-standards
Quand le texte extrait par pdf.js est mal structure (colonnes fusionnees, espaces irreguliers), les regex echouent. Le seuil Y de 3.5px pour le regroupement de lignes est fixe et ne s'adapte pas aux differents PDFs.

### 2. Cleaning type par defaut = "recouche"
Dans `analyzeLineContext()` (ligne 1156), le defaut est `recouche` avec `status: 'unknown'`. Si aucun mot-cle n'est detecte, la chambre est classee en recouche par defaut, ce qui peut etre incorrect.

### 3. Pas de validation croisee
Le systeme ne compare pas les resultats du Phase 0 (ReportFormatDetector) avec ceux de l'UnifiedParserService pour detecter les incoherences.

### 4. Le fallback IA est limite a 6000 caracteres
Le texte envoye a l'edge function `learn-pattern` est tronque a 6000 chars, ce qui fait manquer des chambres sur les gros rapports.

### 5. Pas de feedback loop
Quand l'utilisateur corrige manuellement une chambre dans l'etape de mapping, cette correction n'est pas reinjectee dans le systeme d'apprentissage pour ameliorer les futurs parsings.

## Plan d'amelioration

### Etape 1 - Extraction PDF amelioree
Ameliorer `extractPdfText()` dans `pdfService.ts` :
- Adapter dynamiquement le seuil Y de regroupement (3.5px) en fonction de la taille de police detectee
- Ajouter un mode "table-aware" qui detecte les colonnes par clustering des positions X
- Cela ameliorera la precision pour tous les formats de PMS

### Etape 2 - Validation croisee Phase 0 vs UnifiedParser
Dans `processPdf()`, comparer les resultats de Phase 0 et de l'UnifiedParserService :
- Si une chambre est detectee par les deux avec des cleaningTypes differents, prendre celui avec la plus haute confiance
- Si une chambre n'est detectee que par un seul, verifier qu'elle existe bien dans le texte brut
- Logger les divergences pour diagnostic

### Etape 3 - Feedback loop depuis le mapping
Dans l'etape "mapping" du PdfWorkflowDialog :
- Quand l'utilisateur change le cleaningType d'un mot-cle (ex: "DIR" de recouche vers a_blanc), sauvegarder automatiquement cette correction dans `hotel_cleaning_rules`
- Cela cree un apprentissage continu sans passer par le wizard d'entrainement complet

### Etape 4 - Augmenter la couverture IA
- Augmenter la limite de texte envoye au fallback IA (6000 -> 15000 chars) ou envoyer par pages
- Ajouter un mode "chunk" qui decoupe le texte en sections et les envoie sequentiellement
- Chaque chunk est parse independamment puis les resultats sont fusionnes

### Etape 5 - Scoring de confiance renforce
Modifier `RoomValidator.ts` pour :
- Ajouter une regle "coherence etage" : si 80% des chambres du meme etage sont en recouche, une chambre isolee en a_blanc devrait avoir un flag de verification
- Ajouter une regle "coherence historique" : comparer avec les patterns des jours precedents
- Exposer le score de confiance par chambre dans l'UI de preview

### Etape 6 - Default cleaning type intelligent
Remplacer le defaut `recouche` par une logique basee sur :
- Le ratio a_blanc/recouche des chambres deja detectees dans le meme rapport
- L'historique de l'hotel (si 70% des chambres sont habituellement en recouche, utiliser recouche comme defaut)
- Stocker ce ratio dans `hotel_pms_configs` ou un champ dedie

## Details techniques

### Fichiers concernes
- `src/services/pdfService.ts` : extraction PDF + validation croisee + feedback loop
- `src/services/pms/UnifiedParserService.ts` : default intelligent + augmentation IA
- `src/services/pms/RoomValidator.ts` : nouvelles regles de coherence
- `src/services/training/ReportFormatDetector.ts` : extraction table-aware
- `src/components/PdfWorkflowDialog.tsx` : sauvegarde des corrections de mapping

### Impact sur les performances
- Le parsing restera rapide car les ameliorations sont principalement algorithmiques
- Le fallback IA sera appele moins souvent grace a la meilleure precision locale
- Le feedback loop est asynchrone (sauvegarde en arriere-plan)

### Mesure de la precision
Ajouter un compteur dans `CoverageMetadata` :
- `confidenceBreakdown` : nombre de chambres par tranche de confiance (90%+, 70-90%, <70%)
- `crossValidationMatches` : nombre de chambres validees par les deux parsers
- Afficher ces stats dans le `TrainingCoverageReport`

