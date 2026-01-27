
# Plan : Système d'invitation par email pour les sous-comptes

## Résumé

Ce plan implémente un système d'invitation par email pour les sous-comptes. Lorsqu'un administrateur crée un sous-compte, l'invité reçoit un email avec un lien pour créer son compte personnel, automatiquement rattaché à l'hôtel de l'administrateur.

## Architecture proposée

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUX D'INVITATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Admin crée sous-compte    2. Email envoyé                   │
│  ┌─────────────────┐         ┌─────────────────┐                │
│  │ SubAccountsManager │────▶│ Edge Function   │                │
│  │ (Formulaire)    │         │ send-subaccount │                │
│  └─────────────────┘         │ -invitation     │                │
│                              └────────┬────────┘                │
│                                       │                         │
│                                       ▼                         │
│                              ┌─────────────────┐                │
│                              │  Email Resend   │                │
│                              │  avec lien      │                │
│                              └────────┬────────┘                │
│                                       │                         │
│  3. Invité clique             4. Création compte                │
│  ┌─────────────────┐         ┌─────────────────┐                │
│  │ /team/join?code=│────▶│ SubAccountSignup │                   │
│  │ INV-XXXX        │         │ Page            │                │
│  └─────────────────┘         └────────┬────────┘                │
│                                       │                         │
│                                       ▼                         │
│                              ┌─────────────────┐                │
│                              │ Supabase Auth   │                │
│                              │ + Link to hotel │                │
│                              └─────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## Modifications à effectuer

### 1. Base de données

**Nouvelle table : `sub_account_invitations`**

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Clé primaire |
| sub_account_id | uuid | FK vers sub_accounts |
| invitation_code | text | Code unique (ex: INV-XK4F-A2B3) |
| status | text | pending, sent, accepted, expired |
| sent_at | timestamp | Date d'envoi email |
| accepted_at | timestamp | Date d'acceptation |
| expires_at | timestamp | Expiration (7 jours) |

**Ajouts à `sub_accounts`**

| Colonne | Type | Description |
|---------|------|-------------|
| user_id | uuid | FK vers auth.users (rempli après signup) |
| invitation_status | text | invited, active |
| hotel_id | uuid | FK vers hotels (hôtel de rattachement) |

### 2. Edge Function : `send-subaccount-invitation`

**Rôle** : Envoie l'email d'invitation avec Resend

**Logique** :
1. Reçoit : sub_account_id, email, first_name, last_name, hotel_name
2. Génère un code d'invitation unique
3. Enregistre dans `sub_account_invitations`
4. Envoie l'email avec le lien `/team/join?code=XXX`
5. Met à jour le statut

**Template email** :
- Titre : "Vous êtes invité à rejoindre {hotel_name}"
- Corps : Bouton "Créer mon compte" + code d'invitation
- Expiration : 7 jours

### 3. Nouvelle page : `/team/join` (SubAccountSignup)

**Fonctionnalités** :
1. Récupère le code d'invitation depuis l'URL
2. Vérifie la validité (non expiré, non utilisé)
3. Affiche les infos préremplies (email, prénom, nom)
4. Permet à l'invité de définir son mot de passe
5. Crée le compte Supabase Auth
6. Lie le `sub_account` au nouveau `user_id`
7. Redirige vers le dashboard

### 4. Modifications SubAccountsManager

**Changements UI** :
- Affichage du statut d'invitation (badge : Invité / Actif)
- Bouton "Renvoyer l'invitation" pour les invités non confirmés
- Désactivation de l'édition tant que le compte n'est pas activé

**Nouveau flux de création** :
```text
1. Admin remplit formulaire (prénom, nom, email, rôle)
2. Clic "Créer" → Insert dans sub_accounts
3. Appel Edge Function → Email envoyé
4. Toast : "Invitation envoyée à {email}"
```

### 5. Gestion des permissions

**Contexte d'authentification étendu** :
- Détecter si l'utilisateur est un sous-compte
- Charger ses permissions depuis `sub_accounts` + `sub_account_permissions`
- Restreindre l'accès aux pages/fonctionnalités

**Hook : `useSubAccountPermissions`**
```typescript
const { hasPermission, isSubAccount, parentHotelId } = useSubAccountPermissions();

// Usage
if (hasPermission('linen.add_types')) {
  // Afficher le bouton
}
```

## Fichiers à créer/modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `supabase/migrations/XXX.sql` | Créer | Schema sub_account_invitations + colonnes |
| `supabase/functions/send-subaccount-invitation/index.ts` | Créer | Edge function envoi email |
| `src/pages/SubAccountJoin.tsx` | Créer | Page signup pour invités |
| `src/components/SubAccountsManager.tsx` | Modifier | Ajouter appel invitation + statuts |
| `src/hooks/use-sub-account-permissions.ts` | Créer | Hook gestion permissions |
| `src/contexts/AuthContext.tsx` | Modifier | Détecter sous-comptes |
| `src/App.tsx` | Modifier | Route /team/join |

## Sécurité

1. **RLS sur `sub_account_invitations`** : Seul l'admin parent peut voir/créer
2. **Validation du code** : Vérification serveur de l'expiration et unicité
3. **Lien user_id** : Le sub_account ne peut être lié qu'une seule fois
4. **Permissions** : Stockées en base, jamais côté client

## Détails techniques

### Code d'invitation
Format : `SUB-{timestamp_base36}-{random_4chars}`
Exemple : `SUB-2K4F1A-X7B3`

### Email (via Resend)
```html
Bonjour {first_name},

Vous avez été invité(e) à rejoindre l'équipe de {hotel_name}.

Rôle : {role_display_name}

[Créer mon compte] ← Bouton vers /team/join?code=XXX

Ce lien expire dans 7 jours.
```

### Workflow de connexion sous-compte

1. Sous-compte se connecte avec email/password
2. AuthContext détecte qu'il est un sous-compte (via `sub_accounts.user_id`)
3. Charge l'hôtel rattaché (`sub_accounts.hotel_id`)
4. Applique les restrictions de permissions
