

## Plan: Aligner le parsing Mews sur les règles métier réelles

### Probleme identifié

Le code actuel traite **PRO (propre)** comme "aucun nettoyage" systématiquement (ligne 534 de MewsAdapter). Or, selon vos règles métier : **PRO avec un client parti = À blanc** car la chambre a été libérée et doit être nettoyée à fond. Seule une chambre PRO **vide** (sans client associé) est vraiment "propre".

De même, la logique de dates (date départ vs date rapport) n'est pas exploitée.

### Règles métier à implémenter

```text
PRIORITÉ 1: Nombre de noms clients (s'applique à SAL, PRO, DIR)
  - 2+ noms distincts → À blanc (checkout + checkin)
  - 1 nom + date départ == date rapport → À blanc (client part aujourd'hui)
  - 1 nom + date départ > date rapport → Recouche (client reste)
  - 1 nom + Nuit X/Y où X == Y → À blanc (dernière nuit)
  - 1 nom + Nuit X/Y où X < Y → Recouche (séjour en cours)
  - 1 nom sans info date → Recouche (par défaut)

PRIORITÉ 2: 0 noms
  - PRO/INS sans client → Propre (none)
  - SAL/DIR sans client → À blanc (chambre vide sale)
```

### Fichiers à modifier

**1. `src/services/pms/adapters/MewsAdapter.ts`**
- Refactorer `analyzeLineWithDate` : supprimer le court-circuit PRO→none. Appliquer la logique unifiée basée sur les noms + dates pour PRO aussi.
- Dans `extractRooms` (règle prioritaire #1, lignes 286-313) : ajouter la comparaison date départ vs date rapport quand 1 seul nom est détecté. Actuellement 1 nom = recouche toujours, mais si la date de départ == date rapport → à blanc.

**2. `src/services/training/UniversalParser.ts`**
- Modifier la section guest-name (lignes 544-553) : quand 1 nom est détecté, vérifier les dates de départ sur la ligne (extraction regex DD/MM/YYYY). Si date départ <= date rapport → full. Ajouter extraction de la date du rapport depuis le header.
- PRO dans `STATUS_DICTIONARY` : le garder comme 'none' par défaut mais l'overrider quand des noms clients sont présents.

**3. `supabase/functions/parse-report/index.ts`**
- Mettre à jour le prompt IA pour refléter les nouvelles règles : PRO avec client parti = à blanc, logique noms clients, Nuit X/Y.

### Détails techniques

**MewsAdapter - Nouvelle logique unifiée** :
- Extraire `reportDate` et les dates de départ de la ligne
- Pour chaque chambre avec statut PRO/SAL/DIR :
  - 2+ noms → à blanc
  - 1 nom + date départ ≤ reportDate → à blanc  
  - 1 nom + Nuit X/Y où X==Y → à blanc
  - 1 nom + date départ > reportDate → recouche
  - 1 nom + Nuit X/Y où X<Y → recouche
  - 1 nom sans info → recouche (défaut)
  - 0 noms + PRO/INS → none (propre)
  - 0 noms + SAL/DIR → à blanc

**UniversalParser** :
- Ajouter `extractReportDateFromText(text)` qui cherche une date dans le header
- Dans la section guest-name (ligne 547+), appliquer la même logique date départ vs date rapport
- Quand statut=PRO et noms≥1, overrider le type 'none' vers la logique noms/dates

**Edge function parse-report** :
- Ajouter dans le prompt : "PRO avec nom client dont date départ ≤ date rapport → a_blanc"
- Reformuler la règle Nuit X/Y pour inclure X==Y → a_blanc

