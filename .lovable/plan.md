

# Audit complet de la plateforme Nettobloc

## Architecture globale

La plateforme comprend 5 interfaces distinctes : **Etablissement** (admin), **Gouvernante**, **Femme de chambre**, **Technicien**, et **Admin** (super admin). Plus un module **Netto Count** (scanner linge) et une **Landing page**.

---

## 1. Interface Etablissement (Index.tsx - Dashboard principal)

**Points positifs :**
- Architecture modulaire (tabs separees en composants)
- MainLayout avec sidebar responsive et bottom nav mobile
- Realtime sync avec Supabase
- PDF workflow complet (import, preview, mapping, housekeepers, governess, distribution)
- Session tracking et subscription management

**Problemes identifies :**
- **Polling agressif** : `setInterval(loadRoomsFromDatabase, 5000)` en plus du realtime sync -- double charge inutile sur la base
- **HotelLoadingScreen** : force un `window.location.reload()` apres 8s -- risque de boucle infinie si le hotel ne charge jamais
- **reportService.ts** : utilise `localStorage.getItem('selectedHotelId')` pour `saveDailyReport` au lieu du contexte Hotel -- fragile et peut archiver sur le mauvais hotel
- **PdfWorkflowDialog** : 2223 lignes -- monolithe difficile a maintenir
- **Instructions dans le PDF** : les consignes du jour (`dailyInstructions`) sont sauvegardees en DB via `handleGovernessComplete`, mais le `generateReport` utilise `customFields.instructions` qui vient d'un etat local (`reportCustomFields`) jamais lie aux `daily_instructions` de la DB. Les consignes du workflow ne se retrouvent pas dans le PDF genere depuis l'onglet Rapports.

---

## 2. Interface Gouvernante (GovernessDashboard.tsx)

**Points positifs :**
- 8 onglets fonctionnels (chambres, inspections, incidents, objets, linge, personnel, validation, journal)
- DailyInstructionsBanner integre (recemment ajoute)
- StaffTasksList integre
- Gestion multi-hotels

**Problemes identifies :**
- **Pas de realtime** : les stats et donnees ne se rafraichissent qu'au changement d'hotel ou clic "Actualiser" -- pas de subscription realtime
- **Auth par localStorage** : profil stocke en local sans validation server-side -- un utilisateur peut forger un profil
- **selectedHotel non persiste correctement** : `localStorage.getItem('governess_selected_hotel')` est lu au mount mais jamais ecrit (le `setSelectedHotel` ne persiste pas)
- **Aucun guard d'acces** : pas de verification que la session governess est toujours valide (session `governess_hotel_sessions` pourrait etre desactivee cote DB)

---

## 3. Interface Femme de chambre (HousekeeperWorkSimple.tsx)

**Points positifs :**
- Interface mobile-first bien concue
- Pointage (timesheet) integre avec persistence DB
- RoomCardEnhanced avec gestion des statuts
- Tabs: chambres, inventaire linge, taches, consignes
- Fallback templates (day-of-week puis default) pour les instructions

**Problemes identifies :**
- **1521 lignes** : composant monolithique, difficile a maintenir
- **InstructionsTabContent** duplique la logique de fallback template deja presente dans `DailyInstructionsBanner` -- code duplique
- **DailyInstructionsBanner** est aussi importe mais utilise separement -- double affichage potentiel si les deux sont visibles
- **Pas de gestion offline** : malgre le hook `use-offline-storage.ts` dans le projet, il n'est pas utilise dans cette interface
- **getHotelId()** : cascade fragile (URL > storageService > profile) sans validation UUID

---

## 4. Interface Technicien (TechnicianDashboard.tsx)

**Points positifs :**
- UserTypeGuard integre (seule interface staff a l'utiliser)
- DailyInstructionsBanner integre
- StaffTasksList integre
- Interface simple et focalisee (incidents)

**Problemes identifies :**
- **Interface tres limitee** : seulement 2 onglets (incidents et signaler) -- pas d'acces aux chambres, linge ou objets trouves
- **Pas de profil technicien editable** depuis le dashboard (doit aller sur `/technician/profile`)
- **Bouton "Retour" pointe vers `/technician/login`** au lieu de `/technician/hotels` -- navigation confuse

---

## 5. Interface Admin (Admin.tsx)

- Non audite en detail mais presente dans le routing
- Protege par `useAdminRole` qui verifie `user_roles` table -- conforme aux bonnes pratiques

---

## 6. Consignes & Templates -- Flux complet

**Flux actuel :**
1. Admin cree des templates (onglet Rapports > Templates) via `InstructionTemplateSelector`
2. Pendant le workflow PDF, l'etape Gouvernante (step 4/5) permet d'editer et sauvegarder les consignes du jour en DB (`daily_instructions`)
3. Le `DailyInstructionsBanner` les affiche sur les 3 interfaces staff (gouvernante, technicien, femme de chambre)
4. Le tab "Consignes" dans HousekeeperWorkSimple les affiche aussi (code duplique)

**Probleme critique :**
- Les consignes sauvegardees en DB (`daily_instructions`) ne sont **pas injectees** dans le PDF genere via "Generer rapport". Le `generateReport` utilise `customFields` qui est un etat local (`reportCustomFields`) initialise a vide et jamais rempli par les `daily_instructions`.
- Les templates day-of-week fonctionnent dans le banner et le tab consignes, mais l'auto-population dans `GovernessAssignmentStep` fait un fallback sur les dernieres instructions (pas sur le template du jour de la semaine)

---

## 7. Securite

**Points positifs :**
- Roles stockes dans `user_roles` (pas sur le profil)
- `has_role()` en SECURITY DEFINER
- `can_manage_hotel_data()` verifie ownership
- RLS activee sur les tables critiques
- UserTypeGuard pour le routing establishment/technician

**Points d'attention :**
- Gouvernante et Femme de chambre utilisent localStorage auth sans verification serveur continue
- `ConnectionDebugPanel` est rendu globalement dans App.tsx -- potentiellement visible en production
- `reportService.ts` utilise `localStorage.getItem('selectedHotelId')` sans validation

---

## 8. Performance

- **Index.tsx** : polling 5s + realtime = double charge
- **PdfWorkflowDialog** : 2223 lignes chargees en un seul chunk
- **HousekeeperWorkSimple** : 1521 lignes
- **GovernessDashboard** : 829 lignes
- Pas de lazy loading sur les tabs du dashboard

---

## Resume des corrections recommandees (par priorite)

### Priorite haute
1. **Lier les consignes du jour au rapport PDF** : charger `daily_instructions` depuis la DB dans le `generateReport` pour que les consignes apparaissent dans le PDF
2. **Supprimer le polling 5s** dans Index.tsx -- le realtime suffit
3. **Corriger la navigation technicien** : "Retour" vers `/technician/hotels` au lieu de `/technician/login`
4. **Corriger la persistence de l'hotel selectionne gouvernante** : sauvegarder dans localStorage a chaque `setSelectedHotel`
5. **Auto-populer GovernessAssignmentStep avec le template du jour** (pas juste les dernieres instructions)

### Priorite moyenne
6. **Dedupliquer la logique instructions** : InstructionsTabContent dans HousekeeperWorkSimple vs DailyInstructionsBanner
7. **Refactorer PdfWorkflowDialog** en sous-composants (2223 lignes)
8. **Ajouter validation de session gouvernante** : verifier que `governess_hotel_sessions.is_active` est encore true
9. **Masquer ConnectionDebugPanel en production**
10. **Ajouter lazy loading** sur les tabs du dashboard

### Priorite basse
11. Enrichir l'interface technicien (acces objets trouves, chambres)
12. Implementer le mode offline pour l'interface femme de chambre
13. Refactorer HousekeeperWorkSimple en sous-composants

