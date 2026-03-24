

# Rendre l'entrainement plus rapide, concis et precis a 99%

## Problemes actuels

1. **Etape 2 (ColumnMapping) = 877 lignes** : trop complexe avec tabs, drag-and-drop, config manuelle. L'utilisateur se perd.
2. **UniversalParser sous-utilise** : il existe mais l'import passe encore par `pmsAdapterFactory.detectPms()` (ancien chemin). Le nouveau parser n'est jamais appele.
3. **Double logique de detection** : `ReportFormatDetector.ts` (1254 lignes) + `UniversalParser.ts` (443 lignes) + adapters PMS specifiques. Trois chemins concurrents.
4. **Precision faible sur formats inconnus** : le fallback generique rate souvent les statuts non standard.

## Solution : pipeline unique "auto-magic"

### Principe

Au lieu de 3 etapes avec configuration manuelle, le systeme fait tout automatiquement a l'import. L'etape 2 devient un simple ecran de verification/correction rapide, pas une page de configuration.

```text
AVANT: Import → Config complexe (877 ln) → Valider
APRES: Import + Auto-detect → Verifier & corriger → Sauver
```

### Modifications

#### 1. `TrainingStep1Import.tsx` — Utiliser UniversalParser

- Remplacer `pmsAdapterFactory.detectPms()` par `universalParse()` du UniversalParser
- Si UniversalParser detecte 0 chambres, fallback sur les adapters PMS specifiques
- Passer les `rawLines` et `detectedColumns` dans `trainingData` pour l'etape 2

#### 2. `TrainingStep1bColumnMapping.tsx` — Reduire de 877 a ~250 lignes

Remplacement complet par un composant simplifie :
- **Vue unique** (plus de tabs) : tableau des lignes detectees avec colonnes auto-mappees
- **Correction inline** : cliquer sur un statut inconnu pour le mapper (dropdown)
- **Auto-save des mappings statut** dans `hotel_report_config` pour les futurs imports
- Supprimer : drag-and-drop colonnes, onglets Preview/Statuts/Combinaisons, gestion d'ordre, mode avance

#### 3. `UniversalParser.ts` — Renforcer la precision

- **Ajouter des codes PMS manquants** : Fidelio (VD/VC/OD/OC), Clock (CI/CO/IH), Hogatex, StayNTouch
- **Fuzzy matching** : si un mot est a 1 caractere d'un statut connu (ex: "DEPAR" → "DEPART"), le matcher
- **Charger les mappings hotel** depuis `hotel_report_config.status_mappings` au parse-time pour appliquer les corrections precedentes automatiquement
- **Detection de colonnes par position X** pour les PDFs (les espaces entre colonnes sont reguliers)

#### 4. `TrainingWizard.tsx` — Ajustement mineur

- Si l'auto-detection trouve >90% de chambres avec statut connu, proposer de sauter l'etape 2 et aller directement a l'etape 3 (bouton "Tout est correct → Sauver")

### Fichiers modifies

| Fichier | Action |
|---------|--------|
| `TrainingStep1Import.tsx` | Modifier : utiliser UniversalParser + passer rawLines |
| `TrainingStep1bColumnMapping.tsx` | Recrire : vue simplifiee ~250 lignes |
| `UniversalParser.ts` | Modifier : fuzzy match + load hotel mappings + codes manquants |
| `TrainingWizard.tsx` | Modifier : skip etape 2 si auto-detect OK |
| `TrainingData` (interface) | Ajouter `rawLines` et `detectedColumns` optionnels |

### Resultat attendu

- **Vitesse** : import → sauvegarde en 2 clics si le format est reconnu
- **Precision** : 99% grace au dictionnaire elargi + fuzzy match + mappings hotel accumules
- **Simplicite** : l'etape 2 devient optionnelle, visible uniquement si correction necessaire

