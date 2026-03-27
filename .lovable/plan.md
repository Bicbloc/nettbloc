

## Plan : Plan architectural accessible à tous les rôles + notifications d'activité sur les espaces

### Contexte
Le plan architectural (`FloorPlanView`) n'est actuellement visible que dans le registre admin (`/room-registry`). Les interfaces technicien, gouvernante et femme de chambre n'y ont pas accès. De plus, il n'y a pas de badge de notification sur les espaces pour signaler une activité récente, ni de clic direct pour voir l'historique.

### Ce qui sera fait

**1. Créer un composant `ReadOnlyFloorPlan` réutilisable**
- Adapter `FloorPlanView` en une version lecture seule (sans drag-and-drop, sans edit/toggle active)
- Chaque cellule d'espace affiche un badge de notification (pastille rouge avec compteur) quand il y a des actions récentes (dernières 24h) via une requête sur `daily_action_logs`
- Un clic sur un espace ouvre le `SpaceActivityLog` (journal d'activité existant) en mode Sheet

**2. Intégrer le plan dans l'interface Femme de chambre**
- Ajouter un 5e onglet "Plan" dans `HousekeeperTabNav` (icône `Map`)
- Afficher le `ReadOnlyFloorPlan` filtré sur les espaces de l'hôtel courant
- Mettre en surbrillance les chambres assignées à la femme de chambre

**3. Intégrer le plan dans l'interface Gouvernante**
- Ajouter un onglet/bouton "Plan" dans `GovernessRoomManagement`
- Afficher le plan complet de l'hôtel avec indicateurs d'activité

**4. Intégrer le plan dans l'interface Technicien**
- Ajouter un onglet "Plan" dans les tabs de `TechnicianWork`
- Afficher le plan avec mise en évidence des espaces ayant des incidents actifs

### Fichiers concernés

| Fichier | Action |
|---|---|
| `src/components/registry/ReadOnlyFloorPlan.tsx` | **Créer** - Composant plan lecture seule avec badges d'activité et clic → journal |
| `src/components/housekeeper/HousekeeperTabNav.tsx` | **Modifier** - Ajouter onglet "Plan" |
| `src/components/HousekeeperWorkSimple.tsx` | **Modifier** - Rendre le contenu du tab "Plan" |
| `src/components/governess/GovernessRoomManagement.tsx` | **Modifier** - Ajouter vue plan |
| `src/pages/TechnicianWork.tsx` | **Modifier** - Ajouter tab "Plan" |

### Detail technique - Badges de notification
- Requête `daily_action_logs` groupée par `room_number` pour les dernières 24h
- Affichage d'une pastille rouge avec le nombre d'actions sur chaque cellule d'espace
- Le clic ouvre `SpaceActivityLog` existant en mode Sheet avec l'historique complet

