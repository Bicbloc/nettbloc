

# Audit complet de la plateforme Nettobloc - Mars 2026

---

## 1. Architecture et structure

```text
App.tsx (146 ln)
├── AppBoot (cache invalidation)
├── LanguageProvider
├── AuthProvider (Supabase auth, refresh 10min)
├── HotelProvider (charge hotel par user_id)
├── HousekeeperAuthProvider (localStorage auth)
├── TechnicianAuthProvider (Supabase auth)
├── HousekeepingProvider (rooms + housekeepers, polling 30s)
├── NotificationProvider
│
├── Index (910 ln) — Etablissement
├── GovernessDashboard (872 ln) — Gouvernante
├── HousekeeperWorkSimple (1403 ln) — Femme de chambre
├── TechnicianDashboard (190 ln) — Technicien
├── Admin — Super admin
├── NettoCount (4 pages) — Scanner linge
└── PdfWorkflowDialog (2223 ln) — Import/workflow PDF
```

**6 interfaces, 60+ composants, 25+ services, 30+ hooks.**

---

## 2. Problemes critiques identifies

### 2.1 Polling agressif — surcharge DB et batterie

**3 pollings a 5s actifs simultanement** sur l'interface Etablissement :

| Source | Intervalle | Impact |
|--------|-----------|--------|
| `use-dashboard-rooms.ts:240` | 5s | Recharge TOUTES les rooms |
| `HousekeeperWorkSimple.tsx:936` | 5s | `loadWorkData()` complet |
| `RoomsGridSection.tsx:36` | 5s | `invalidateQueries` incident counts |
| `AssignmentTab.tsx:94` | 5s | `invalidateQueries` rooms |
| `HousekeepingContext.tsx:444` | 30s | Refresh housekeepers |
| `ActiveUsersPanel.tsx:55` | 30s | Update sessions |

Tout cela **en plus** du Realtime Supabase deja actif. Resultat : 12+ requetes/minute inutiles par utilisateur connecte.

### 2.2 `saveDailyReport` — fallback localStorage fragile

`reportService.ts:48` : `const hotelId = params.hotelId || localStorage.getItem('selectedHotelId')`. Malgre la correction precedente ajoutant le parametre `hotelId`, le fallback localStorage reste present. Si `params.hotelId` est `undefined` (pas `null`), le fallback ne s'active pas, mais le risque d'archiver sur le mauvais hotel persiste si un appelant oublie le parametre.

### 2.3 `window.location.reload()` dans HotelLoadingScreen — corrige

Le `HotelLoadingScreen` (ligne 123-157) utilise maintenant un **bouton "Reessayer"** au lieu du reload automatique. **Corrige depuis le dernier audit.**

### 2.4 Gouvernante — session localStorage sans expiration

La gouvernante utilise `localStorage.getItem('governess_profile')` sans aucune verification de validite temporelle. Si le profil est revoque cote serveur, la gouvernante continue de voir les donnees jusqu'a recharger la page. La validation `governess_hotel_sessions.is_active` est faite au `loadHotels` mais pas periodiquement.

---

## 3. Analyse par interface

### 3.1 Etablissement (Index.tsx — 910 lignes)

**Forces :** Architecture modulaire (tabs separees), HotelContext centralise, Realtime + PDF workflow complet, UserTypeGuard, subscription management.

**Faiblesses :**
- Double/triple polling (voir 2.1) en parallele du Realtime
- PdfWorkflowDialog = 2223 lignes monolithiques
- 65 references a `localStorage.getItem('selectedHotelId')` dans le codebase (devrait etre 0, tout via HotelContext ou storageService)

### 3.2 Gouvernante (GovernessDashboard.tsx — 872 lignes)

**Forces :** Realtime sync integre (rooms, incidents, assignments, lost_and_found, inspections), validation session active au chargement, persistence hotel selectionne.

**Faiblesses :**
- `loadStats()` fait **5 requetes separees** au lieu d'une RPC unique
- Pas de polling ni Realtime pour les `staff_timesheets`
- `loadStats` referencing `selectedHotel` dans le useCallback sans dependency — potentiel bug de closure stale

### 3.3 Femme de chambre (HousekeeperWorkSimple.tsx — 1403 lignes)

**Forces :** Tabs bien structurees (rooms, tasks, instructions, inventory), RoomCardEnhanced, Realtime sync, pointage integre, journal d'activite.

**Faiblesses :**
- **1403 lignes** — monolithe, devrait etre split en sous-composants
- **Polling 5s** (`loadWorkData`) EN PLUS du Realtime sync — double charge
- `InstructionsTabContent` (lignes 38-57) duplique `DailyInstructionsBanner` — logique dupliquee
- Pas de `UserTypeGuard` : un utilisateur Supabase Auth peut acceder a `/housekeeper/work` sans verification

### 3.4 Technicien (TechnicianDashboard.tsx — 190 lignes)

**Forces :** Compact, UserTypeGuard, DailyInstructionsBanner + StaffTasksList integres, bouton retour correct (`/technician/hotels`).

**Faiblesses :**
- Pas de Realtime sync — les incidents ne se mettent pas a jour en temps reel
- Interface minimale : seulement incidents, pas d'acces aux chambres, objets trouves, ou linge
- Pas de stats/dashboard (0 compteurs)

---

## 4. Logique des donnees

### 4.1 Flux des consignes du jour

```text
PdfWorkflowDialog → daily_instructions (DB)
                  ↓
DailyInstructionsBanner ← daily_instructions (DB) ✅
reportService.generateReport ← daily_instructions (DB) ✅ (recemment ajoute)
dailyReportPdfService ← daily_instructions + task_templates (DB) ✅
```

**Statut : Corrige.** Les consignes apparaissent dans les 3 interfaces staff et dans les rapports PDF.

### 4.2 Flux des taches

```text
TaskTemplateManager → task_templates (DB)
                   ↓
StaffTasksList ← task_templates + task_completions (DB) ✅
reportService ← task_templates filtrees par housekeeper ✅
dailyReportPdfService ← task_templates + task_completions ✅
```

**Statut : OK.**

### 4.3 Flux d'assignation des chambres

```text
PdfWorkflowDialog → rooms (upsert) + assignments (insert) + housekeepers (upsert)
                  ↓
Realtime ← rooms (updates)
        ↓
Index (handleRealtimeUpdate) → preserve assignedTo ✅
HousekeeperWorkSimple ← assignments par housekeeper_id ✅
```

**Probleme potentiel :** `handleRealtimeUpdate` (ligne 374) preserve `assignedTo` mais ne met pas a jour `floor` ni d'autres champs potentiellement modifies.

### 4.4 Cycle quotidien

Les donnees operationnelles (rooms, assignments) persistent jusqu'a la "Cloture de la journee". Il n'y a **aucun nettoyage automatique** — si l'admin oublie la cloture, les donnees du jour precedent restent visibles indefiniment.

---

## 5. Entrainement (refonte recente)

**Statut : Refactore en 3 etapes (Import → Configurer → Valider).**

**Forces :**
- UniversalParser v2.0 avec 150+ codes statut, fuzzy matching, 6 langues
- Support multi-format (PDF, CSV, TXT, copier-coller)
- Skip automatique etape 2 si confiance >= 90%
- TrainingStep1bColumnMapping simplifie (~250 lignes)

**Faiblesses restantes :**
- Le chargement des mappings hotel (`loadHotelMappings`) dans UniversalParser fait une requete DB synchrone qui n'est pas appelee depuis `universalParse()` — les mappings hotel ne sont jamais charges automatiquement
- `TrainingStep2Annotate.tsx` et `TrainingStep3Result.tsx` existent encore dans le filesystem mais ne sont plus importes — fichiers morts

---

## 6. Securite

| Point | Statut |
|-------|--------|
| Auth Supabase + RLS | ✅ Etablissement + Technicien |
| UserTypeGuard | ✅ Index, TechnicianDashboard |
| UserTypeGuard manquant | ❌ HousekeeperWorkSimple, GovernessDashboard |
| Gouvernante auth localStorage | ⚠️ Pas de token serveur, revocable seulement via `is_active` |
| ConnectionDebugPanel en prod | ✅ Corrige (`import.meta.env.DEV` guard) |
| `has_role()` SECURITY DEFINER | ✅ |
| Codes d'acces caches dans UI | ✅ (recemment retire) |

---

## 7. Performance

### Requetes excessives (par interface connectee)
- **Etablissement** : ~15 req/min (polling 5s x 3 sources + housekeepers 30s + Realtime)
- **Femme de chambre** : ~12 req/min (polling 5s `loadWorkData`)
- **Gouvernante** : ~2 req/min (Realtime uniquement) ✅
- **Technicien** : 0 req/min (pas de Realtime ni polling) — donnees statiques

### Composants monolithiques
| Composant | Lignes | Recommandation |
|-----------|--------|----------------|
| PdfWorkflowDialog | 2223 | Refactorer en 5+ sous-composants |
| HousekeeperWorkSimple | 1403 | Refactorer en 4+ sous-composants |
| ReportFormatDetector | 1254 | Sous-utilise, devrait deleguer a UniversalParser |
| Index | 910 | Acceptable avec hooks extraits |
| GovernessDashboard | 872 | Refactorer stats en hook |

### Pas de code splitting
Toutes les tabs du dashboard sont importees statiquement. Aucun `React.lazy()`.

---

## 8. Coherence entre interfaces

| Feature | Etab. | Gouv. | FdC | Tech. |
|---------|:---:|:---:|:---:|:---:|
| Realtime sync | ✅ | ✅ | ✅ | ❌ |
| Polling 5s (doublon) | ❌ oui | ❌ non | ❌ oui | ❌ non |
| Consignes du jour | ✅ | ✅ | ✅ | ✅ |
| Taches assignees | ✅ | ✅ | ✅ | ✅ |
| Incidents | ✅ | ✅ | ✅ | ✅ |
| Objets trouves | ✅ | ✅ | ❌ | ❌ |
| Inventaire linge | ✅ | ✅ | ✅ | ❌ |
| UserTypeGuard | ✅ | ❌ | ❌ | ✅ |
| Stats dashboard | ✅ | ✅ | basique | ❌ |

---

## 9. Fichiers morts / code mort

- `src/components/training/TrainingStep2Annotate.tsx` — plus importe
- `src/components/training/TrainingStep3Result.tsx` — plus importe (remplace par TrainingStep3Validate)
- `src/components/training/TrainingStep3Mapping.tsx` — a verifier
- `src/components/training/TrainingStep4Save.tsx` — a verifier

---

## 10. Corrections recommandees par priorite

### Priorite critique
1. **Supprimer les pollings 5s** dans `use-dashboard-rooms.ts`, `HousekeeperWorkSimple.tsx`, `RoomsGridSection.tsx`, `AssignmentTab.tsx` — le Realtime suffit. Economie : ~25 req/min par utilisateur
2. **Supprimer le fallback localStorage** dans `saveDailyReport` — forcer le parametre `hotelId` requis

### Priorite haute
3. **Ajouter Realtime au technicien** — les incidents ne se mettent pas a jour en temps reel
4. **Dedupliquer `InstructionsTabContent`** dans HousekeeperWorkSimple — utiliser directement DailyInstructionsBanner
5. **Optimiser les stats gouvernante** — remplacer 5 requetes par une RPC unique
6. **Appeler `loadHotelMappings()` dans le flux d'import** — les mappings hotel ne sont jamais charges dans UniversalParser

### Priorite moyenne
7. **Refactorer PdfWorkflowDialog** (2223 ln) en sous-composants
8. **Refactorer HousekeeperWorkSimple** (1403 ln) en sous-composants
9. **Supprimer les fichiers morts** (TrainingStep2Annotate, TrainingStep3Result, etc.)
10. **Remplacer les 65 `localStorage.getItem('selectedHotelId')`** par `storageService.getHotelId()` ou HotelContext
11. **Ajouter lazy loading** (`React.lazy`) sur les tabs du dashboard

### Priorite basse
12. Enrichir le dashboard technicien (stats, objets trouves)
13. Ajouter le mode offline pour la femme de chambre
14. Centraliser la gestion d'erreurs avec un ErrorBoundary global

