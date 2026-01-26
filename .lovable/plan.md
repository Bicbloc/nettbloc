
# Analyse Complète et Plan de Correction

## Résumé Exécutif

J'ai effectué une analyse approfondie de l'application et identifié **17 problèmes critiques** répartis en 5 catégories. Le problème principal avec le code HTL904 est lié aux politiques RLS (Row Level Security) de la table `hotels`.

---

## 1. Problèmes Identifiés

### 1.1 Saisie et Scan de Codes Établissement (HTL904)

| Type | Interface | Criticité |
|------|-----------|-----------|
| Bug | Femme de chambre / Technicien | **BLOQUANT** |

**Problème constaté:**
Le code HTL904 existe bien dans la base de données (Hotel ARTOIS, ID: `8925d462-e1c8-4699-bcbe-cb16e5d707c1`), mais les utilisateurs obtiennent "Établissement introuvable".

**Cause racine:**
La table `hotels` a des politiques RLS restrictives qui ne permettent la lecture que par le propriétaire de l'hôtel:
```sql
-- Politique actuelle:
qual: (auth.uid() = user_id) OR has_role(auth.uid(), 'super_admin')
```

**Fichiers concernés:**
- `src/pages/HousekeeperHotels.tsx:136-144` - Utilise `.single()` bloqué par RLS
- `src/contexts/TechnicianAuthContext.tsx:227-234` - Même problème
- `src/contexts/HousekeeperAuthContext.tsx:423-427` - Même problème

**Observation:**
La fonction edge `governess-request-hotel-access` fonctionne car elle utilise `SUPABASE_SERVICE_ROLE_KEY` pour bypasser RLS.

---

### 1.2 Authentification et Gestion des Comptes (CRITIQUE)

| Type | Interface | Criticité |
|------|-----------|-----------|
| Bug | Toutes les interfaces | **BLOQUANT** |

**Problème constaté:**
Les utilisateurs ne reçoivent pas:
- Les emails de confirmation
- Les codes d'authentification
- Les liens de réinitialisation

**Cause racine:**
1. **Resend en mode test:** L'email utilise `onboarding@resend.dev` qui ne fonctionne qu'avec l'email du propriétaire du compte Resend
2. **Aucun log d'appel aux fonctions email:** Les fonctions `send-activation-email` et `send-staff-invitation` n'ont aucun log récent, suggérant qu'elles ne sont pas appelées
3. **Les signups utilisent l'auth Supabase native** sans déclencher les fonctions edge personnalisées

**Fichiers concernés:**
- `supabase/functions/send-activation-email/index.ts:161-166` - Domaine non vérifié
- `src/pages/HousekeeperSignup.tsx` - N'appelle pas d'edge function après signup
- `src/pages/netto-count/NettoCountAuth.tsx` - Même problème

---

### 1.3 Interface Technicien

| Type | Interface | Criticité |
|------|-----------|-----------|
| Bug + UX | Technicien | **Majeur** |

**Problèmes constatés:**
1. **Recherche d'hôtel bloquée par RLS** (même problème que HTL904)
2. **Colonne incorrecte dans la requête de session:** `housekeeper_profile_id` est utilisé au lieu de `technician_profile_id`
3. **Messages d'erreur génériques:** "Code établissement invalide" sans plus de contexte

**Fichier concerné:**
- `src/contexts/TechnicianAuthContext.tsx:131` - Utilise `housekeeper_profile_id` au lieu de `technician_profile_id`

---

### 1.4 Interface Gouvernante

| Type | Interface | Criticité |
|------|-----------|-----------|
| UX | Gouvernante | **Mineur** |

**Observations:**
- Fonctionne correctement car utilise une edge function avec service role
- Bonne gestion des états (en attente, refusé, etc.)
- Suggestions d'amélioration: ajouter un bouton de rafraîchissement manuel

---

### 1.5 Application Netto Count

| Type | Interface | Criticité |
|------|-----------|-----------|
| Bug + UX | Netto Count | **Majeur** |

**Problèmes constatés:**
1. **reCAPTCHA en mode test:** Utilise la clé de test Google `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
2. **Confirmation email non fonctionnelle** (même problème que point 1.2)
3. **Un seul conteneur reCAPTCHA partagé:** Le formulaire Sign In et Sign Up utilisent le même `recaptcha-container`, causant des conflits

**Fichiers concernés:**
- `src/pages/netto-count/NettoCountAuth.tsx:19` - Clé de test reCAPTCHA
- `src/pages/netto-count/NettoCountAuth.tsx:256,320` - Conteneurs reCAPTCHA dupliqués

---

## 2. Problèmes de Sécurité

| Problème | Niveau |
|----------|--------|
| 30 avertissements du linter Supabase | WARN |
| Politiques RLS avec `USING (true)` sur plusieurs tables | WARN |
| Fonction avec `search_path` non défini | WARN |

---

## 3. Plan de Correction

### Phase 1: Correction du problème HTL904 (Bloquant)

**Objectif:** Permettre aux femmes de chambre et techniciens de rechercher des hôtels par code sans être bloqués par RLS.

**Actions:**
1. Créer une fonction RPC `search_hotel_by_code` avec `SECURITY DEFINER` qui retourne uniquement les informations publiques nécessaires (id, name, hotel_code)
2. Modifier les pages `HousekeeperHotels.tsx`, `HousekeeperAuthContext.tsx` et `TechnicianAuthContext.tsx` pour utiliser cette fonction RPC au lieu de requêtes directes

**Exemple de la fonction SQL:**
```sql
CREATE OR REPLACE FUNCTION public.search_hotel_by_code(p_code text)
RETURNS TABLE(id uuid, name text, hotel_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.name, h.hotel_code
  FROM public.hotels h
  WHERE h.hotel_code = upper(trim(p_code));
END;
$$;
```

---

### Phase 2: Correction des Emails (Bloquant)

**Objectif:** S'assurer que les emails de confirmation sont bien envoyés.

**Actions:**
1. **Vérifier le domaine Resend:** L'utilisateur doit valider un domaine d'envoi sur https://resend.com/domains
2. **Modifier les fonctions edge** pour utiliser un domaine vérifié au lieu de `onboarding@resend.dev`
3. **Appeler les fonctions edge après signup** dans les pages d'inscription
4. **Alternative:** Utiliser les emails natifs Supabase Auth (déjà configurés) et vérifier les templates dans le dashboard Supabase

---

### Phase 3: Correction Interface Technicien (Majeur)

**Objectif:** Corriger la recherche d'hôtel et la gestion des sessions.

**Actions:**
1. Utiliser la nouvelle fonction RPC `search_hotel_by_code` (créée en Phase 1)
2. Corriger la colonne `housekeeper_profile_id` → `technician_profile_id` dans la requête de session (ou créer une table `technician_sessions` dédiée)
3. Améliorer les messages d'erreur avec des suggestions d'actions

---

### Phase 4: Correction Netto Count (Majeur)

**Objectif:** Configurer correctement reCAPTCHA et l'envoi d'emails.

**Actions:**
1. Créer un secret `RECAPTCHA_SITE_KEY` dans Supabase pour stocker la vraie clé
2. Séparer les conteneurs reCAPTCHA pour Sign In et Sign Up
3. Ajouter un callback pour réinitialiser le reCAPTCHA lors du changement d'onglet
4. Intégrer l'envoi d'email de confirmation via la fonction edge

---

### Phase 5: Améliorations UX (Mineur)

**Actions:**
1. Ajouter des messages d'erreur explicites avec causes et actions correctives
2. Ajouter un indicateur de chargement lors de la recherche d'hôtel
3. Proposer "Vérifiez le code auprès de votre responsable" en cas d'erreur
4. Ajouter un bouton de rafraîchissement sur les pages de demandes en attente
5. Harmoniser les termes entre les interfaces (ex: "Établissement" vs "Hôtel")

---

## 4. Fichiers à Modifier

| Fichier | Modifications |
|---------|---------------|
| `supabase/migrations/xxx.sql` | Nouvelle fonction RPC `search_hotel_by_code` |
| `src/pages/HousekeeperHotels.tsx` | Utiliser RPC au lieu de requête directe |
| `src/contexts/HousekeeperAuthContext.tsx` | Utiliser RPC pour `requestHotelAccess` |
| `src/contexts/TechnicianAuthContext.tsx` | Corriger colonne + utiliser RPC |
| `src/pages/netto-count/NettoCountAuth.tsx` | Corriger reCAPTCHA + conteneurs séparés |
| `supabase/functions/send-activation-email/index.ts` | Vérifier domaine email |
| Messages d'erreur dans toutes les interfaces | Améliorer clarté |

---

## 5. Tests Recommandés

### Parcours Utilisateur Nouveau
- [ ] Inscription femme de chambre → Email reçu → Confirmation → Connexion → Saisie code hôtel → Demande envoyée
- [ ] Inscription technicien → Email reçu → Confirmation → Connexion → Saisie code hôtel → Demande envoyée
- [ ] Inscription gouvernante → Email reçu → Confirmation → Connexion → Saisie code hôtel → Demande envoyée
- [ ] Inscription Netto Count → reCAPTCHA validé → Email reçu → Configuration items → Scan

### Parcours Utilisateur Existant
- [ ] Connexion avec email/mot de passe valides
- [ ] Réinitialisation mot de passe → Email reçu → Lien fonctionnel
- [ ] Accès aux hôtels approuvés

### Tests Code Établissement
- [ ] HTL904 → Doit trouver "Hotel ARTOIS"
- [ ] HTL001 → Doit trouver l'hôtel correspondant
- [ ] INVALID → Message d'erreur clair "Code introuvable. Vérifiez auprès de votre responsable."

---

## 6. Priorité d'Implémentation

1. **Immédiat (Bloquant):** Fonction RPC `search_hotel_by_code` + Intégration dans les interfaces
2. **Urgent (Bloquant):** Vérification domaine Resend + Correction emails
3. **Important (Majeur):** Correction interface technicien + Netto Count reCAPTCHA
4. **Normal (Mineur):** Améliorations UX et messages d'erreur
