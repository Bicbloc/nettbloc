

# Renforcement et simplification du systeme d'entrainement

## Problemes actuels

1. **Format unique** : seul le PDF est accepte. Pas de copier-coller texte, pas de CSV/Excel.
2. **Parsers rigides** : 4 parsers specifiques (Mews, Apaleo, Medialog, Opera) + 1 generique faible. Si le rapport ne correspond a aucun, le fallback "raw line split" est quasi inutile.
3. **UX complexe** : 4 etapes + options avancees + drawer. L'etape 2 (ColumnMapping, 877 lignes) est dense et technique.
4. **Generic parser trop faible** : il cherche des numeros de chambre par regex et des mots-cles statut en dur. Un rapport avec des termes non prevus (ex: "CHECK", "VR", "DI") ne sera pas compris.
5. **Pas d'apprentissage interactif** : si 0 chambres detectees, l'utilisateur est bloque. Il ne peut pas "montrer" au systeme ce qu'est une chambre.

## Solution : mode hybride "Smart + Manuel"

### Architecture simplifiee

```text
Etape 1: IMPORTER           Etape 2: CONFIGURER          Etape 3: VALIDER & SAUVER
┌─────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ PDF / Coller texte  │ →  │ Preview tableau      │ →  │ Liste des chambres   │
│ / CSV / Excel       │    │ Mapping colonnes     │    │ Type nettoyage       │
│                     │    │ Mapping statuts      │    │ Sauvegarder          │
│ Auto-detect format  │    │ (pre-rempli si connu)│    │                      │
└─────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

3 etapes au lieu de 4. L'etape "Annotation" et "Sauvegarde" sont fusionnees.

### Modifications detaillees

#### 1. `src/components/training/TrainingStep1Import.tsx` — Support multi-format

- **Ajouter un champ textarea** "Coller le texte du rapport" en alternative au PDF
- **Ajouter un input fichier CSV/TXT** en plus du PDF (accept=".pdf,.csv,.txt,.xls,.xlsx")
- Pour CSV : parser avec `Papa Parse` (deja disponible ou ajoutable)
- Pour texte colle : passer directement au detecteur
- **Supprimer la selection PMS** : le systeme detecte automatiquement. Si aucun format reconnu, aller directement en mode "generique ameliore" sans demander a l'utilisateur quel PMS il utilise
- UI simplifiee : une seule zone de drop/coller avec 3 options (PDF, fichier texte, coller)

#### 2. `src/services/training/ReportFormatDetector.ts` — Parser generique renforce

- **Nouveau mode "table intelligente"** : au lieu de chercher des mots-cles specifiques, detecter la structure tabulaire par analyse de positions X (colonnes alignees). Si le texte a des colonnes regulieres, les identifier automatiquement.
- **Dictionnaire de statuts extensible** : au lieu de patterns regex en dur, utiliser un dictionnaire charge depuis la DB (`hotel_report_config.status_mappings`). A la premiere utilisation, le systeme suggere des mappings, l'utilisateur corrige, et les corrections sont sauvees pour les prochains imports.
- **Ajouter des patterns manquants** au parser generique :
  - Opera : VD, OD, VC, OC, VR, DI
  - Protel : patterns specifiques
  - Patterns multilingues : Clean/Dirty/Inspected (EN), Sauber/Schmutzig (DE), Limpio/Sucio (ES)
- **Supprimer la dependance aux parsers PMS specifiques pour l'entrainement** : tout passe par le detecteur generique renforce. Les parsers Mews/Apaleo restent pour l'import PDF automatique mais l'entrainement utilise un chemin unifie.

#### 3. `src/components/training/TrainingStep1bColumnMapping.tsx` — Simplification

- **Fusionner les tabs "Apercu" et "Statuts"** en une seule vue : tableau avec les donnees et les mappings en ligne
- **Mode "enseigner"** : si aucune chambre detectee, afficher le texte brut ligne par ligne et permettre a l'utilisateur de cliquer sur un numero pour dire "c'est une chambre" et sur un mot pour dire "c'est le statut". Le systeme apprend le pattern.
- **Reduire la complexite** : supprimer la gestion de l'ordre des colonnes par drag (peu utile), garder uniquement le mapping type de colonne + mapping statut → nettoyage
- **Auto-save** : sauvegarder la config automatiquement a chaque modification au lieu du bouton manuel

#### 4. `src/components/training/TrainingWizard.tsx` — 3 etapes

- Passer de 4 a 3 etapes : Import → Configurer → Valider & Sauver
- Fusionner `TrainingStep2Annotate` et `TrainingStep3Result` en un seul composant `TrainingStep3Validate`
- Le nouveau composant affiche la liste des chambres detectees avec possibilite de corriger + bouton "Sauvegarder l'entrainement" en bas

#### 5. Nouveau fichier `src/services/training/UniversalParser.ts`

Parser universel qui remplace la logique fragmentee :
- Detecte automatiquement le separateur (tab, espaces multiples, point-virgule, virgule)
- Identifie la ligne d'en-tete par heuristique (mots-cles connus dans plusieurs langues)
- Extrait les colonnes par position ou delimiteur
- Applique les mappings statut → nettoyage depuis la config hotel (DB) ou les suggestions par defaut
- Fallback : si rien ne marche, mode "ligne par ligne" ou l'utilisateur peut enseigner

### Impact sur les fichiers existants

| Fichier | Action |
|---------|--------|
| `TrainingWizard.tsx` | Modifier : 3 etapes au lieu de 4 |
| `TrainingStep1Import.tsx` | Modifier : ajouter textarea + CSV + supprimer selection PMS |
| `TrainingStep1bColumnMapping.tsx` | Modifier : simplifier, fusionner tabs, ajouter mode "enseigner" |
| `TrainingStep2Annotate.tsx` | Fusionner dans nouveau `TrainingStep3Validate.tsx` |
| `TrainingStep3Result.tsx` | Fusionner dans nouveau `TrainingStep3Validate.tsx` |
| `ReportFormatDetector.ts` | Modifier : renforcer parser generique, dictionnaire extensible |
| `UniversalParser.ts` (nouveau) | Creer : parser unifie avec detection separateur/colonnes |
| `training/index.ts` | Mettre a jour les exports |

### Ce qui ne change pas

- La table `report_training_patterns` en DB (structure OK)
- La table `hotel_report_config` en DB (utilisee pour les mappings)
- L'historique des entrainements (`TrainingHistory.tsx`)
- Les options avancees (`AdvancedSettingsDrawer.tsx`)
- Les parsers PMS specifiques (restent pour l'import automatique hors entrainement)

### Aucune migration SQL requise

Les tables existantes suffisent.

