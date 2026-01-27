

# Plan de Migration vers le Domaine nettobloc.bicbloc.eu

## Résumé

Migration de tous les fichiers de configuration pour utiliser le nouveau domaine personnalisé `nettobloc.bicbloc.eu` au lieu de `nettbloc.lovable.app`.

## Fichiers à Modifier

### 1. supabase/config.toml
**Objectif** : Mettre à jour les URLs de redirection pour l'authentification

**Modifications** :
```toml
[auth]
site_url = "https://nettobloc.bicbloc.eu"
additional_redirect_urls = [
  "https://nettobloc.bicbloc.eu",
  "https://nettobloc.bicbloc.eu/auth",
  "https://nettobloc.bicbloc.eu/auth/establishment",
  "https://nettobloc.bicbloc.eu/housekeeper/auth",
  "https://nettobloc.bicbloc.eu/governess/auth",
  "https://id-preview--b36a7a8c-909b-4be7-a22c-f96dedec2bb4.lovable.app",
  "http://localhost:3000"
]
```

### 2. supabase/functions/send-staff-invitation/index.ts
**Objectif** : Corriger l'URL par défaut pour les liens d'invitation

**Ligne 31** - Changer :
```typescript
const baseUrl = Deno.env.get("APP_URL") || "https://rarhqnvvbjzfdevnghnz.lovableproject.com";
```
**En** :
```typescript
const baseUrl = Deno.env.get("APP_URL") || "https://nettobloc.bicbloc.eu";
```

### 3. supabase/functions/send-activation-email/index.ts
**Objectif** : Corriger les liens dans les emails d'activation

**Ligne 106** - Changer :
```html
<a href="https://app.nettobloc.com"
```
**En** :
```html
<a href="https://nettobloc.bicbloc.eu"
```

**Ligne 143** - Même modification

### 4. capacitor.config.ts
**Objectif** : Corriger l'URL du serveur pour l'application mobile

**Ligne 8** - Changer :
```typescript
url: 'https://b36a7a8c-909b-4be7-a22c-f96dedec2bb4.lovableproject.com?forceHideBadge=true',
```
**En** :
```typescript
url: 'https://nettobloc.bicbloc.eu?forceHideBadge=true',
```

## Action Manuelle Requise (Dashboard Supabase)

Après l'implémentation, vous devez également mettre à jour le Dashboard Supabase :

1. Aller sur https://supabase.com/dashboard/project/rarhqnvvbjzfdevnghnz/auth/url-configuration
2. **Site URL** : `https://nettobloc.bicbloc.eu`
3. **Redirect URLs** - Ajouter :
   - `https://nettobloc.bicbloc.eu/**`

## Fichiers Non Modifiés

Les fichiers suivants contiennent `@bicbloc.eu` mais ce sont des adresses email, pas des URLs d'application :
- Migrations SQL avec `support@bicbloc.eu`, `operations@bicbloc.eu`, `freeflex@bicbloc.eu`
- `src/pages/Invoices.tsx` avec `support@bicbloc.eu`

Ces fichiers n'ont **pas** besoin d'être modifiés.

## Résultat Attendu

Après cette migration :
- Les emails de réinitialisation de mot de passe redirigeront vers `nettobloc.bicbloc.eu`
- Les invitations du personnel utiliseront le bon domaine
- Les emails d'activation pointeront vers le bon site
- L'application mobile se connectera au bon domaine

