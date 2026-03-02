

# Audit complet de la plateforme Nettobloc - Mars 2026

---

## 1. Architecture globale

La plateforme comprend 6 interfaces : **Etablissement** (892 lignes), **Gouvernante** (833 lignes), **Femme de chambre** (1521 lignes), **Technicien** (190 lignes), **Admin**, et **Netto Count** (scanner linge). Plus une landing page et des pages d'acces.

```text
┌──────────────────────────────────────────────────────┐
│                    App.tsx (146 lignes)               │
│  LanguageProvider > QueryClient > AuthProvider >     │
│  HotelProvider > HousekeeperAuth > TechnicianAuth >  │
│  HousekeepingProvider > NotificationProvider         │
│                                                      │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐│
│  │  Index   │ │Governess │ │Housekeeper│ │Technician│
│  │Dashboard │ │Dashboard │ │WorkSimple │ │Dashboard │
│  │(892 ln)  │ │(833 ln)  │ │(1521 ln)  │ │(190 ln) │
│  └─────────┘ └──────────┘ └───────────┘ └─────────┘│
│         │                        │                   │
│  ┌──────┴─────────┐    ┌────────┴──────────┐        │
│  │PdfWorkflowDialog│    │DailyInstructions  │        │
│  │   (2223 ln)     │    │Banner + TabContent│        │
│  └────────────────┘    └───────────────────┘        │
│                                                      │
│  Services: RealtimeManager (616 ln, singleton)       │
│  Services: reportService (942 ln)                    │
│  Contexts: Auth, Hotel, Language, Notification       │
└──────────────────────────────────────────────────────┘
```

---

## 2. Analyse par interface

### 2.1 Interface Etablissement (Index.tsx)

**Forces :**
- Architecture modulaire avec tabs en composants separes (OverviewTab, RoomManagementTab, etc.)
- MainLayout avec sidebar responsive et MobileBottomNav
- RealtimeManager singleton robuste avec heartbeat, reconnexion exponentielle, gestion auth
- PDF workflow complet (import, preview, mapping, housekeepers, governess, distribution)
- UserTypeGuard pour verifier le role establishment
- Subscription management (trial, premium, free)

**Problemes restants :**
- **`saveDailyReport` utilise encore `localStorage.getItem('selectedHotelId')`** (ligne 46 de reportService.ts) : meme si `generateReport` recoit maintenant `hotelId` en parametre, la fonction `saveDailyReport` ne le recoit pas et fait un fallback fragile sur localStorage. Si le localStorage n'a pas la bonne cle, l'archivage echoue silencieusement.
- **`HotelLoadingScreen` force `window.location.reload()` apres 8s** (ligne 127 de Index.tsx) : risque de boucle de reload infinie si le hotel ne charge jamais (sous-compte sans hotel lie par exemple).
- **9 fichiers utilisent encore `localStorage.getItem('selectedHotelId')`** (65 occurrences trouvees) : `hotelSessionService.ts`, `PdfWorkflowDialog.tsx`, `use-housekeeper-sync.ts`, `use-permission.ts`, `ActiveUsersPanel.tsx`, `use-notifications.ts`, `storageService.ts`, `HousekeeperHotels.tsx`. Certains sont des fallbacks necessaires, d'autres sont des acces directs qui devraient utiliser `storageService.getHotelId()` ou le contexte Hotel.
- **PdfWorkflowDialog.tsx : 2223 lignes** monolithique -- pas de code splitting

### 2.2 Interface Gouvernante (GovernessDashboard.tsx)

**Forces :**
- 8 onglets complets (chambres, inspections, incidents, objets, linge, personnel, validation, journal)
- DailyInstructionsBanner et StaffTasksList integres
- Multi-hotels avec selection persistee
- Hotel selectionne persiste dans localStorage (corrige dans l'audit precedent)

**Problemes :**
- **Aucune souscription Realtime** : stats et donnees ne se rafraichissent qu'au changement d'hotel ou clic "Actualiser". Les chambres, incidents, linge ne se mettent pas a jour en temps reel.
- **Auth par localStorage seulement** : profil charge depuis `localStorage.getItem('governess_profile')` sans validation serveur. Un utilisateur pourrait forger un profil JSON en localStorage.
- **Pas de validation de session active** : aucune verification que `governess_hotel_sessions.is_active` est toujours true. Si un admin desactive la session, la gouvernante continue d'avoir acces.
- **Stats font 5 requetes separees** (lignes 176-222) au lieu d'une seule RPC ou requete optimisee.
- **Pas de gestion d'erreur UI** : si `loadHotels` echoue, l'utilisateur voit juste "Aucun hotel assigne" sans indication d'erreur reseau.

### 2.3 Interface Femme de chambre (HousekeeperWorkSimple.tsx)

**Forces :**
- Mobile-first avec tabs (chambres, inventaire, taches, consignes)
- Pointage (timesheet) avec persistence DB
- RoomCardEnhanced avec gestion complete des statuts
- Realtime sync integre via `useRealtimeSync`
- Fallback templates (day-of-week > default) pour consignes

**Problemes :**
- **1521 lignes monolithique** : `InstructionsTabContent` (lignes 38-175), `HousekeeperWorkContent` (lignes 177-1500+), pointage, auth check, realtime -- tout dans un seul fichier.
- **Duplication de logique instructions** : `InstructionsTabContent` (lignes 38-175) duplique exactement la meme logique de fallback template que `DailyInstructionsBanner` (lignes 70-101). Meme requetes, meme priorite day_of_week > default. Double maintenance.
- **Double affichage potentiel** : `DailyInstructionsBanner` est aussi importe (ligne 17) et utilise dans le header. Si les deux sont visibles, l'utilisateur voit les memes consignes deux fois.
- **`getHotelId()` sans validation UUID** (lignes 229-240) : cascade fragile URL > storageService > profile sans verifier que la valeur est un UUID valide, juste `.length >= 30`.
- **Pas de gestion offline** : le hook `use-offline-storage.ts` existe dans le projet mais n'est pas utilise.
- **Auth check fragile** : verifie la session Supabase + profil housekeeper_profiles, mais ne verifie pas que la session d'acces a l'hotel est toujours active.

### 2.4 Interface Technicien (TechnicianDashboard.tsx)

**Forces :**
- Le plus propre : 190 lignes, bien structure
- `UserTypeGuard` integre (seule interface staff a l'utiliser correctement)
- DailyInstructionsBanner et StaffTasksList integres
- Back button corrige vers `/technician/hotels`

**Problemes :**
- **Interface tres limitee** : seulement 2 onglets (incidents et signaler). Pas d'acces aux chambres, linge, objets trouves, ou taches techniques specifiques.
- **Pas d'acces au profil** depuis le dashboard (doit naviguer manuellement vers `/technician/profile`).
- **Pas de stats ou dashboard overview** : pas de compteurs (incidents assignes, resolus, en attente).

---

## 3. Flux des consignes et templates

```text
┌──────────────────────────────────────────────────┐
│ Admin: InstructionTemplateSelector               │
│ - Cree des templates (instructions, to_know,     │
│   todo) avec day_of_week optionnel               │
│ - Stocke dans instruction_templates              │
└─────────────────────┬────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────┐
│ PdfWorkflow: GovernessAssignmentStep             │
│ - Charge: today daily_instructions               │
│           > day_of_week template                 │
│           > default template                     │
│           > most recent daily_instructions       │
│ - Sauvegarde dans daily_instructions             │
└─────────────────────┬────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────┐
│ Affichage Staff (3 interfaces)                   │
│                                                  │
│ DailyInstructionsBanner:                         │
│   daily_instructions (today)                     │
│   > day_of_week template > default template      │
│   ✅ Fonctionne correctement                     │
│                                                  │
│ InstructionsTabContent (HousekeeperWorkSimple):  │
│   Meme logique, CODE DUPLIQUE                    │
│   ⚠️ Devrait reutiliser DailyInstructionsBanner │
└──────────────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────┐
│ PDF Report Generation (reportService.ts)         │
│ - generateReport: si customFields vides,         │
│   charge daily_instructions depuis DB            │
│ - ✅ Corrige dans l'audit precedent              │
│ - ⚠️ saveDailyReport utilise encore              │
│   localStorage au lieu du hotelId param          │
└──────────────────────────────────────────────────┘
```

---

## 4. Gestion des donnees et localStorage

### Probleme systemique : fragmentation des sources de verite

Le hotelId est accede de multiples facons inconsistantes :

| Source | Utilisee par | Fiabilite |
|--------|-------------|-----------|
| `useHotel().hotelId` (contexte) | Index.tsx | Haute |
| `storageService.getHotelId()` | HousekeeperWorkSimple, hooks | Moyenne |
| `localStorage.getItem('selectedHotelId')` | 9 fichiers, 65 occurrences | Fragile |
| `localStorage.getItem('currentHotelId')` | Fallbacks | Fragile |
| `URL searchParams` | HousekeeperWorkSimple | Variable |
| `localStorage.getItem('governess_selected_hotel')` | GovernessDashboard | OK (isole) |

**Impact** : Si `selectedHotelId` et `storageService` sont desynchronises, certaines fonctions (archivage rapports, sync housekeepers, permissions, notifications) peuvent operer sur le mauvais hotel ou echouer silencieusement.

---

## 5. Securite

### Points solides
- Roles dans `user_roles` (pas sur le profil) avec `has_role()` SECURITY DEFINER
- `can_manage_hotel_data()` verifie ownership
- RLS sur les tables critiques
- `can_access_hotel()` pour l'acces unifie
- UserTypeGuard sur establishment et technician
- Codes d'acces generes par fonctions SECURITY DEFINER

### Failles identifiees

1. **Gouvernante : zero validation serveur**
   - Profil charge depuis localStorage sans verification
   - Session `governess_hotel_sessions.is_active` jamais verifiee cote client
   - Un utilisateur peut injecter un `governess_profile` JSON fictif en localStorage et acceder aux donnees de n'importe quel hotel (les requetes Supabase utilisent `selectedHotel.id` qui vient du localStorage)

2. **Femme de chambre : validation auth mais pas de verification de session hotel**
   - Auth Supabase verifiee, profil `housekeeper_profiles` verifie
   - Mais pas de verification que l'acces a cet hotel specifique est toujours autorise
   - `getHotelId()` pourrait retourner un hotelId auquel l'utilisateur n'a plus acces

3. **Donnees sensibles dans localStorage**
   - Profils complets stockes (`governess_profile`, `housekeeper_profile`, `technician_profile`)
   - Hotel IDs multiples
   - Tabs, preferences, pointage

4. **RLS protege les donnees** : Malgre les failles localStorage, les RLS Supabase empechent l'acces non autorise aux tables critiques. Le risque est surtout une confusion de donnees (voir donnees d'un autre hotel) plutot qu'un acces non autorise a des donnees protegees.

---

## 6. Performance

### Problemes identifies

| Composant | Lignes | Probleme |
|-----------|--------|----------|
| PdfWorkflowDialog | 2223 | Monolithe, pas de lazy loading |
| HousekeeperWorkSimple | 1521 | Monolithe, charge tout en un chunk |
| reportService.ts | 942 | Genere HTML inline (pas de template) |
| GovernessDashboard | 833 | 5 requetes stats separees |
| RealtimeManager | 616 | OK (singleton bien optimise) |

### Optimisations possibles
- **Code splitting** : PdfWorkflowDialog et HousekeeperWorkSimple devraient etre lazy-loaded
- **Stats gouvernante** : regrouper les 5 `SELECT count(*)` en une seule RPC
- **Tabs dashboard** : lazy load des composants de tabs (React.lazy)
- **Template instructions** : une seule requete au lieu de deux separees (daily_instructions + instruction_templates)

---

## 7. Coherence UX entre interfaces

| Feature | Etablissement | Gouvernante | Femme de chambre | Technicien |
|---------|:---:|:---:|:---:|:---:|
| Realtime sync | ✅ | ❌ | ✅ | ❌ |
| Consignes du jour | ✅ (workflow) | ✅ (banner) | ✅ (banner + tab) | ✅ (banner) |
| Taches assignees | ✅ | ✅ | ✅ | ✅ |
| Incidents | ✅ | ✅ | ✅ | ✅ |
| Objets trouves | ✅ | ✅ | ❌ | ❌ |
| Inventaire linge | ✅ | ✅ | ✅ | ❌ |
| UserTypeGuard | ✅ | ❌ | ❌ | ✅ |
| Offline support | ❌ | ❌ | ❌ | ❌ |
| Stats/dashboard | ✅ | ✅ | ✅ (basique) | ❌ |

---

## 8. Corrections recommandees par priorite

### Priorite critique
1. **Corriger `saveDailyReport`** : accepter `hotelId` en parametre au lieu de lire localStorage
2. **Ajouter validation de session gouvernante** : verifier `governess_hotel_sessions.is_active` avant d'afficher les donnees
3. **Supprimer le `window.location.reload()` dans HotelLoadingScreen** : remplacer par un message d'erreur avec bouton de retry

### Priorite haute
4. **Ajouter Realtime a la gouvernante** : souscrire aux tables rooms, incidents, assignments pour mise a jour en temps reel
5. **Dedupliquer InstructionsTabContent** : reutiliser DailyInstructionsBanner au lieu de dupliquer 140 lignes de logique
6. **Unifier les acces hotelId** : remplacer les 65 `localStorage.getItem('selectedHotelId')` par `storageService.getHotelId()` ou le contexte

### Priorite moyenne
7. **Refactorer PdfWorkflowDialog** (2223 lignes) en sous-composants
8. **Refactorer HousekeeperWorkSimple** (1521 lignes) en sous-composants
9. **Ajouter stats au dashboard technicien** : compteurs incidents assignes/resolus
10. **Optimiser stats gouvernante** : une seule RPC au lieu de 5 requetes

### Priorite basse
11. Code splitting / lazy loading sur les tabs
12. Mode offline pour interface femme de chambre
13. Enrichir interface technicien (objets trouves, linge)
14. Centraliser la gestion d'erreurs UI (toast + retry)

