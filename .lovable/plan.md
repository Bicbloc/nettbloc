
# Plan d'action : Correction des incohérences et améliorations

## Résumé des problèmes identifiés

### 1. Problèmes critiques de sécurité/fonctionnement

| Problème | Fichier | Impact |
|----------|---------|--------|
| `useUserTypeGuard` ne vérifie pas `technician_profiles` | `src/hooks/use-user-type-guard.tsx` | Un technicien peut accéder aux interfaces Établissement/Équipe |
| Résidu `'invitations'` dans les features payantes | `src/components/PremiumLimitGuard.tsx` | Code mort, confusion |
| `BackButton` dans `EstablishmentAuth` pointe vers `/` | `src/pages/EstablishmentAuth.tsx` | Devrait pointer vers `/auth` |

### 2. Incohérences visuelles (pages d'authentification)

| Page | Style | Couleurs |
|------|-------|----------|
| HousekeeperAuth | Gradient moderne | Violet/Purple |
| GovernessAuth | Gradient moderne | Amber/Orange |
| TechnicianLogin | Gradient simple | Slate/Blue |
| EstablishmentAuth | Plat, sans gradient | Gris/Vert |

**Problème** : `EstablishmentAuth` et `TechnicianLogin/Signup` ont un design daté comparé aux autres.

### 3. Textes hardcodés (pas i18n)

| Fichier | Textes en dur |
|---------|---------------|
| `AppSidebar.tsx` | "Opérations", "Inventaires", "Outils", "Objets Trouvés", "Menu" |
| `MobileBottomNav.tsx` | "Accueil", "Chambres", "Équipe", "Plus", "Principal", "Opérations", etc. |

---

## Actions à effectuer

### Phase 1 : Corrections critiques

#### 1.1 Ajouter la vérification `technician_profiles` dans `useUserTypeGuard`

**Fichier**: `src/hooks/use-user-type-guard.tsx`

```text
Ligne 85-89 : Ajouter la requête technician_profiles au Promise.all

Avant:
  const [hotelResult, housekeeperResult, governessResult] = await Promise.all([
    supabase.from('hotels').select('id').eq('email', email).maybeSingle(),
    supabase.from('housekeeper_profiles').select('id').eq('email', email).maybeSingle(),
    supabase.from('governess_profiles').select('id').eq('email', email).maybeSingle()
  ]);

Après:
  const [hotelResult, housekeeperResult, governessResult, technicianResult] = await Promise.all([
    supabase.from('hotels').select('id').eq('email', email).maybeSingle(),
    supabase.from('housekeeper_profiles').select('id').eq('email', email).maybeSingle(),
    supabase.from('governess_profiles').select('id').eq('email', email).maybeSingle(),
    supabase.from('technician_profiles').select('id').eq('email', email).maybeSingle()
  ]);
```

```text
Ligne 91-99 : Ajouter la détection du technicien

Avant:
  if (housekeeperResult.data) {
    detectedType = 'housekeeper';
  } else if (governessResult.data) {
    detectedType = 'governess';
  } else if (hotelResult.data) {
    detectedType = 'establishment';
  }

Après:
  if (technicianResult.data) {
    detectedType = 'technician';
  } else if (housekeeperResult.data) {
    detectedType = 'housekeeper';
  } else if (governessResult.data) {
    detectedType = 'governess';
  } else if (hotelResult.data) {
    detectedType = 'establishment';
  }
```

#### 1.2 Supprimer le résidu `'invitations'`

**Fichier**: `src/components/PremiumLimitGuard.tsx`

```text
Ligne 31:
Avant: const paidPlanFeatures = ['access_codes', 'invitations'];
Après: const paidPlanFeatures = ['access_codes'];
```

#### 1.3 Corriger le BackButton dans EstablishmentAuth

**Fichier**: `src/pages/EstablishmentAuth.tsx`

```text
Ligne 298:
Avant: <BackButton to="/" />
Après: <BackButton to="/auth" />
```

---

### Phase 2 : Harmonisation des pages d'authentification

#### 2.1 Moderniser `TechnicianLogin.tsx`

Appliquer le même style gradient que `HousekeeperAuth` avec une couleur bleue :
- Background: `bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-700`
- Ajouter les éléments décoratifs (cercles blur)
- Moderniser le header avec icône dans un cercle glassmorphism

#### 2.2 Moderniser `TechnicianSignup.tsx`

Même traitement que `TechnicianLogin`

#### 2.3 Moderniser `EstablishmentAuth.tsx`

- Background: `bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700`
- Ajouter les éléments décoratifs
- Supprimer la Card "Vous êtes femme de chambre ?" (redondante avec `/auth`)
- Corriger le BackButton vers `/auth`

---

### Phase 3 : Internationalisation du menu

#### 3.1 Ajouter les traductions manquantes

**Fichier**: `src/i18n/translations.ts`

```typescript
dashboard: {
  // Existants...
  lostAndFound: string;
  menu: string;
  operations: string;
  inventory: string;
  tools: string;
  principal: string;
}
```

Valeurs FR:
```typescript
lostAndFound: 'Objets Trouvés',
menu: 'Menu',
operations: 'Opérations',
inventory: 'Inventaires',
tools: 'Outils',
principal: 'Principal',
```

Valeurs EN:
```typescript
lostAndFound: 'Lost & Found',
menu: 'Menu',
operations: 'Operations',
inventory: 'Inventory',
tools: 'Tools',
principal: 'Main',
```

#### 3.2 Utiliser les traductions dans AppSidebar

**Fichier**: `src/components/layout/AppSidebar.tsx`

```text
Ligne 65: 
Avant: { value: 'lost-found', label: 'Objets Trouvés', ... }
Après: { value: 'lost-found', label: t.dashboard.lostAndFound, ... }

Ligne 138:
Avant: <span className="text-sm font-semibold">Menu</span>
Après: <span className="text-sm font-semibold">{t.dashboard.menu}</span>

Ligne 161: 
Avant: {renderSection(operationsItems, 'Opérations')}
Après: {renderSection(operationsItems, t.dashboard.operations)}

Ligne 165:
Avant: {renderSection(inventoryItems, 'Inventaires')}
Après: {renderSection(inventoryItems, t.dashboard.inventory)}

Ligne 169:
Avant: {renderSection(toolsItems, 'Outils')}
Après: {renderSection(toolsItems, t.dashboard.tools)}
```

#### 3.3 Utiliser les traductions dans MobileBottomNav

**Fichier**: `src/components/layout/MobileBottomNav.tsx`

Même principe : remplacer tous les textes en dur par `t.dashboard.*`

---

## Récapitulatif des fichiers à modifier

| Fichier | Changements |
|---------|-------------|
| `src/hooks/use-user-type-guard.tsx` | Ajouter vérification technician_profiles |
| `src/components/PremiumLimitGuard.tsx` | Supprimer 'invitations' |
| `src/pages/EstablishmentAuth.tsx` | Corriger BackButton, moderniser design |
| `src/pages/TechnicianLogin.tsx` | Moderniser design gradient |
| `src/pages/TechnicianSignup.tsx` | Moderniser design gradient |
| `src/i18n/translations.ts` | Ajouter traductions menu |
| `src/components/layout/AppSidebar.tsx` | Utiliser traductions |
| `src/components/layout/MobileBottomNav.tsx` | Utiliser traductions |

---

## Ordre d'exécution recommandé

1. **Corrections critiques** (Phase 1) - Sécurité et fonctionnement
2. **Internationalisation** (Phase 3) - Prérequis pour la cohérence
3. **Harmonisation visuelle** (Phase 2) - Expérience utilisateur

Total estimé : ~8 fichiers modifiés
