

# Plan : Ajout de la Réinitialisation de Mot de Passe pour Tous les Utilisateurs

## Résumé

Ajouter la fonctionnalité "Mot de passe oublié" aux trois pages d'authentification : Femme de chambre, Gouvernante et Technicien.

## Pages à Modifier

### 1. src/pages/HousekeeperAuth.tsx
**Objectif** : Ajouter le lien et la logique de réinitialisation de mot de passe

**Modifications** :
- Ajouter un état `isRecoveryMode` et `isPasswordReset` pour détecter le mode récupération
- Ajouter un état `newPassword` pour le nouveau mot de passe
- Ajouter une fonction `handlePasswordReset` qui appelle `supabase.auth.resetPasswordForEmail()`
- Ajouter une fonction `handleUpdatePassword` pour mettre à jour le mot de passe
- Détecter les tokens de récupération dans l'URL (`?code=` ou `#access_token`)
- Ajouter un lien "Mot de passe oublié ?" sous le formulaire de connexion
- Afficher le formulaire de nouveau mot de passe si en mode récupération

### 2. src/pages/GovernessAuth.tsx
**Objectif** : Ajouter le lien et la logique de réinitialisation de mot de passe

**Modifications** :
- Ajouter un état `isRecoveryMode` pour détecter le mode récupération
- Ajouter un état `newPassword` pour le nouveau mot de passe  
- Ajouter une fonction `handlePasswordReset` qui appelle `supabase.auth.resetPasswordForEmail()`
- Ajouter une fonction `handleUpdatePassword` pour mettre à jour le mot de passe
- Détecter les tokens de récupération dans l'URL
- Ajouter un lien "Mot de passe oublié ?" sous le formulaire de connexion
- Afficher le formulaire de nouveau mot de passe si en mode récupération

### 3. src/pages/TechnicianLogin.tsx
**Objectif** : Ajouter le lien et la logique de réinitialisation de mot de passe

**Modifications** :
- Ajouter un état `isRecoveryMode` pour détecter le mode récupération
- Ajouter un état `newPassword` pour le nouveau mot de passe
- Ajouter une fonction `handlePasswordReset` qui appelle `supabase.auth.resetPasswordForEmail()`
- Ajouter une fonction `handleUpdatePassword` pour mettre à jour le mot de passe
- Détecter les tokens de récupération dans l'URL
- Ajouter un lien "Mot de passe oublié ?" sous le formulaire de connexion
- Afficher le formulaire de nouveau mot de passe si en mode récupération

## Logique Commune à Implémenter

```typescript
// Détection du mode récupération au chargement
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const hash = window.location.hash;
  
  if (code) {
    // PKCE flow - échanger le code contre une session
    supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (!error && data.session) {
        setIsRecoveryMode(true);
      }
    });
  } else if (hash.includes('type=recovery')) {
    setIsRecoveryMode(true);
  }
}, []);

// Réinitialisation du mot de passe
const handlePasswordReset = async () => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/PAGE_PATH`
  });
  
  if (!error) {
    toast({ title: "Email envoyé", description: "Vérifiez votre boîte de réception" });
  }
};

// Mise à jour du mot de passe
const handleUpdatePassword = async () => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  
  if (!error) {
    toast({ title: "Mot de passe mis à jour" });
    setIsRecoveryMode(false);
    navigate('/PAGE_PATH');
  }
};
```

## URLs de Redirection

| Page | redirectTo |
|------|------------|
| HousekeeperAuth | `${window.location.origin}/housekeeper/auth` |
| GovernessAuth | `${window.location.origin}/governess/auth` |
| TechnicianLogin | `${window.location.origin}/technician/login` |

## Interface Utilisateur

Chaque page affichera :
1. **Mode normal** : Formulaire de connexion avec lien "Mot de passe oublié ?"
2. **Mode demande reset** : Champ email + bouton "Envoyer le lien"
3. **Mode récupération** : Champ "Nouveau mot de passe" + bouton "Mettre à jour"

## Configuration Supabase Requise

Les URLs suivantes doivent être dans les **Redirect URLs** du dashboard Supabase :
- `https://nettobloc.bicbloc.eu/housekeeper/auth`
- `https://nettobloc.bicbloc.eu/governess/auth`
- `https://nettobloc.bicbloc.eu/technician/login`

Ces URLs sont déjà couvertes par le pattern `https://nettobloc.bicbloc.eu/**` si vous l'avez configuré.

## Note sur l'Erreur Rate Limit

L'erreur "email rate limit exceeded" signifie que Supabase a temporairement bloqué les emails pour cette adresse. Attendez environ **60 minutes** avant de réessayer.

L'erreur de build "429 Cloudflare" est également temporaire - réessayez la publication dans quelques secondes.

