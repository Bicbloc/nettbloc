

## Plan: Refonte du Registre des Espaces avec suppression en masse, ajout d'espaces techniques et journal d'activite par espace

### Contexte

Le registre actuel (`hotel_rooms_registry`) ne gere que des "chambres" avec un formulaire basique. Il manque :
- La suppression en masse (bulk delete)
- L'ajout d'espaces non-chambre (couloir, office, chaufferie, SSI, etc.)
- Un systeme d'etage flexible (sous-sol, -1, -2, RDC, etc.)
- Un journal d'activite par espace

La table `hotel_rooms_registry` a deja les colonnes `room_type`, `zone`, `metadata` et `floor` (integer, accepte les negatifs). La table `activities` et `daily_action_logs` existent deja avec `room_number` et `entity_id` pour le suivi.

### Migration SQL

Ajouter une colonne `space_category` a `hotel_rooms_registry` pour distinguer chambres et espaces techniques :

```sql
ALTER TABLE hotel_rooms_registry 
ADD COLUMN IF NOT EXISTS space_category text DEFAULT 'room';

COMMENT ON COLUMN hotel_rooms_registry.space_category IS 
'room = chambre, common = espace commun, technical = espace technique';
```

### Fichiers a modifier

#### 1. `src/pages/RoomRegistry.tsx` - Refonte majeure

- **Renommer le titre** : "Registre des Espaces" au lieu de "Registre des Chambres"
- **Bulk selection** : Ajouter des checkboxes sur chaque ligne + checkbox "tout selectionner" dans le header. Barre d'actions flottante en bas quand des elements sont selectionnes avec compteur + bouton "Supprimer la selection"
- **Filtres par categorie** : Tabs ou boutons filtres (Tout / Chambres / Espaces communs / Espaces techniques) en plus de la recherche texte existante
- **Stats** : Ajouter un compteur "Espaces" dans les stats cards
- **Colonne Etage amelioree** : Afficher "SS" pour sous-sol, "RDC" pour 0, "1er", "2e" etc. au lieu du chiffre brut
- **Bouton "Ajouter un espace"** a cote de "Ajouter une chambre"
- **Journal d'activite** : Dialog/Sheet qui s'ouvre au clic sur une ligne, affichant l'historique des actions (nettoyages, incidents, inspections) filtrees par `room_number` depuis `daily_action_logs` et `activities`
- **Confirmation de suppression** : AlertDialog avant suppression bulk

#### 2. `src/components/AddRoomRegistryDialog.tsx` - Ajouter le mode "Espace"

- Ajouter un champ `space_category` avec Select (Chambre / Espace commun / Espace technique)
- Quand "Espace commun" ou "Espace technique" est selectionne : 
  - Le placeholder du nom change ("Couloir 1er", "Chaufferie", "Office", "Buanderie", etc.)
  - Proposer des types pre-definis via Select : Couloir, Office, Chaufferie, Buanderie, Lobby, Ascenseur, Escalier, SSI, Local technique, Parking, Terrasse, Piscine, Salle de reunion, Restaurant
- Champ etage : remplacer `type="number"` par un Select avec : Sous-sol -2, Sous-sol -1, Sous-sol, RDC, 1er, 2e, 3e... jusqu'a 20e + option "Autre" pour saisie libre
- Permettre d'ajouter plusieurs espaces en une fois (bouton "+ Ajouter un autre")

#### 3. `src/components/EditRoomRegistryDialog.tsx` - Memes ameliorations

- Ajouter le champ `space_category`
- Meme logique d'etage amelioree

#### 4. Nouveau composant : `src/components/SpaceActivityLog.tsx`

- Sheet/Dialog affichant le journal d'activite d'un espace specifique
- Requete sur `daily_action_logs` filtree par `hotel_id` + `room_number` (correspond au `room_number` du registre)
- Requete complementaire sur `activities` avec `entity_type = 'room'` et filtrage par room_number dans details
- Affichage chronologique : date, heure, type d'action, acteur, description
- Icones par type : nettoyage (broom), incident (alert), inspection (check), inventaire (clipboard)
- Filtre par date range
- Badge de compteur total

### Details techniques

**Schema d'etage** : On continue d'utiliser `floor: integer` en base. Les valeurs negatives representent les sous-sols (-1, -2). 0 = RDC. L'affichage est gere cote frontend avec une fonction utilitaire `formatFloorLabel(floor: number): string`.

**Suppression bulk** : Suppression reelle (`DELETE FROM hotel_rooms_registry WHERE id IN (...)`) avec confirmation. Pas de soft-delete car `is_active` existe deja pour desactiver sans supprimer.

**Interaction avec les modes manuel/IA** : La colonne `source` indique deja l'origine ('manual', 'pdf_import', 'pms_sync'). Les espaces ajoutes manuellement auront `source = 'manual'`. Le systeme IA/PDF ne les ecrasera pas car l'upsert se fait sur `(hotel_id, room_number)` et les espaces techniques ont des noms uniques.

**Journal d'activite** : Pas de nouvelle table necessaire. On exploite les tables existantes `daily_action_logs` (qui a `room_number`) et `activities` (qui a `entity_id` + `entity_type`). Le composant fait deux requetes paralleles et merge les resultats par date.

```text
┌──────────────────────────────────────────────────┐
│ Registre des Espaces                             │
├──────────────────────────────────────────────────┤
│ [Tout] [Chambres] [Communs] [Techniques]         │
│ [🔍 Rechercher...]                               │
├──┬───────┬───────┬─────────┬────────┬────────────┤
│☐ │ Nom   │ Etage │ Type    │ Source │ Actions    │
│☐ │ 101   │ 1er   │ Standard│ Manuel │ ✏️ 📋 ⚡   │
│☐ │ 102   │ 1er   │ Suite   │ PDF    │ ✏️ 📋 ⚡   │
│☐ │ Coul. │ 1er   │ Couloir │ Manuel │ ✏️ 📋 ⚡   │
│☐ │ Chauff│ SS    │ Techn.  │ Manuel │ ✏️ 📋 ⚡   │
├──┴───────┴───────┴─────────┴────────┴────────────┤
│ ┌──────────────────────────────────────┐          │
│ │ 3 selectionnes  [🗑 Supprimer]      │          │
│ └──────────────────────────────────────┘          │
└──────────────────────────────────────────────────┘
```

