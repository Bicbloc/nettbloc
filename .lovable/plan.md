

# Appliquer la logique Mews (noms clients) + detection chambre 14 + chambres connectees

## Contexte

Le rapport Mews "Statut des espaces" utilise une logique specifique :
- **1 seul nom client** sur la ligne = **Recouche** (client reste)
- **2 noms differents** sur la meme ligne = **A blanc** (checkout + checkin)
- **PRO/INS** = Pas de nettoyage

Actuellement, le code MewsAdapter utilise la position des horaires (gauche/droite) pour determiner le type. Il faut ajouter la detection par nombre de noms clients comme regle prioritaire.

De plus :
- La chambre **14** (2 chiffres) doit etre detectee parmi des chambres a 3 chiffres
- **Deux chambres sur une meme ligne** doivent etre affichees comme connectees (`107+108`)
- La preview doit permettre de selectionner/deselectionner les chambres detectees

## Plan technique

### 1. MewsAdapter - Ajouter la logique "nombre de noms clients"

**Fichier**: `src/services/pms/adapters/MewsAdapter.ts`

Dans `analyzeLineWithDate()`, ajouter une regle prioritaire AVANT la logique des horaires :
- Compter le nombre de noms clients distincts sur la ligne (pattern: `Prenom NOM` ou `NOM Prenom`)
- Filtrer les noms de housekeepers connus (deja fait via `FieldExtractor`)
- **2 noms distincts** → `a_blanc` (checkout/checkin)
- **1 seul nom** + statut SAL → `recouche` (client present)
- **0 nom** + statut SAL → `a_blanc` (chambre vide sale)

Ajouter une methode `countGuestNames(line)` qui retourne le nombre de noms clients trouves.

### 2. MewsAdapter - Detecter les chambres 2 chiffres (chambre 14)

**Fichier**: `src/services/pms/adapters/MewsAdapter.ts`

Modifier le `roomNumberRegex` dans `config` pour accepter aussi les numeros a 2 chiffres :
```
'(?<![\\d])([0-9]{2,4})(?:-T)?(?![\\d/])'
```
Le regex accepte deja 2 chiffres (`{2,4}`), mais le probleme est dans les filtres de format (`roomFormatUtils.ts`).

**Fichier**: `src/utils/roomFormatUtils.ts`

Modifier `filterRoomsByFormat` pour accepter les chambres 2 chiffres **si elles existent dans le registre hotel** (`hotel_rooms_registry`). Si une chambre 2 chiffres comme "14" est dans le registre, elle ne sera pas filtree. Ajouter un parametre optionnel `registryNumbers` pour le cross-check.

### 3. MewsAdapter - Deux chambres sur une ligne = connectees avec "+"

Le code existant dans `extractRooms()` detecte deja le pattern `XXX+XXX` et fusionne avec `roomNumber: "107-108"`. Modifier pour utiliser `+` au lieu de `-` : `roomNumber: "107+108"`.

Verifier aussi que dans `RoomLineParser.ts`, le pattern de detection des chambres liees est coherent.

### 4. PdfWorkflowDialog - Afficher les chambres connectees correctement

**Fichier**: `src/components/PdfWorkflowDialog.tsx`

Dans le rendu de la preview, afficher les `linkedRooms` avec le separateur `+` dans le badge du numero de chambre (ex: `107+108`).

### 5. RoomLineParser - Appliquer la meme logique noms clients

**Fichier**: `src/services/pms/RoomLineParser.ts`

Dans `determineCleaningType()`, ajouter la meme regle : si le texte contient 2 noms clients distincts → `a_blanc`, 1 nom → `recouche`.

Modifier aussi `parseSection()` pour extraire et stocker le nombre de noms clients (`guestNames: string[]` au lieu de `guestName: string`).

### 6. FieldExtractor - Extraire plusieurs noms clients

**Fichier**: `src/services/pms/FieldExtractor.ts`

Ajouter une methode `extractAllGuestNames(line)` qui retourne un tableau de noms au lieu d'un seul. Cela permet de compter 1 vs 2 noms pour la logique a blanc/recouche.

## Resume des changements

| Fichier | Modification |
|---------|-------------|
| `MewsAdapter.ts` | Logique noms clients dans `analyzeLineWithDate()`, roomNumber format `+` |
| `FieldExtractor.ts` | Nouvelle methode `extractAllGuestNames()` |
| `RoomLineParser.ts` | Logique noms clients dans `determineCleaningType()`, support multi-noms |
| `roomFormatUtils.ts` | Accepter chambres 2 chiffres si presentes dans le registre |
| `PdfWorkflowDialog.tsx` | Affichage chambres connectees avec `+` |

