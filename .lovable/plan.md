
# Plan de Correction - Réinitialisation de Mot de Passe en Production

## Problème

La réinitialisation de mot de passe redirige vers `lovable.dev` au lieu de `nettbloc.lovable.app` car les URLs de production ne sont pas configurées dans Supabase Auth.

## Solution

### Configuration Supabase Dashboard (Action manuelle requise)

L'utilisateur doit ajouter les URLs dans le dashboard Supabase :
1. Aller sur https://supabase.com/dashboard/project/rarhqnvvbjzfdevnghnz/auth/url-configuration
2. Définir **Site URL** : `https://nettbloc.lovable.app`
3. Ajouter dans **Redirect URLs** :
   - `https://nettbloc.lovable.app/**`
   - `https://id-preview--b36a7a8c-909b-4be7-a22c-f96dedec2bb4.lovable.app/**`
   - `http://localhost:3000/**` (pour le développement)

### Mise à jour du fichier config.toml (Pour documentation)

Modifier `supabase/config.toml` section `[auth]` :

```toml
[auth]
enabled = true
port = 54322
site_url = "https://nettbloc.lovable.app"
additional_redirect_urls = [
  "https://nettbloc.lovable.app",
  "https://nettbloc.lovable.app/auth",
  "https://nettbloc.lovable.app/auth/establishment",
  "https://nettbloc.lovable.app/housekeeper/auth",
  "https://nettbloc.lovable.app/governess/auth",
  "https://id-preview--b36a7a8c-909b-4be7-a22c-f96dedec2bb4.lovable.app",
  "http://localhost:3000"
]
jwt_expiry = 3600
refresh_token_rotation_enabled = true
security_refresh_token_reuse_interval = 10
enable_signup = true
```

## Flux Corrigé

```text
1. Utilisateur demande réinitialisation
2. Email envoyé avec lien vers https://nettbloc.lovable.app/auth/establishment#access_token=...&type=recovery
3. L'application capture les tokens dans le hash
4. L'utilisateur définit son nouveau mot de passe
```

## Fichiers à Modifier

| Fichier | Modification |
|---------|--------------|
| `supabase/config.toml` | Mettre à jour `site_url` et `additional_redirect_urls` |

## Action Utilisateur Requise

La configuration principale doit être faite dans le **Dashboard Supabase** car le fichier `config.toml` est principalement pour le développement local. Le dashboard Supabase est la source de vérité pour la production.

## Résultat Attendu

Après configuration :
- Le lien de réinitialisation redirigera vers `https://nettbloc.lovable.app/auth/establishment`
- L'utilisateur pourra définir son nouveau mot de passe directement sur votre application
- Plus de redirection vers `lovable.dev`
