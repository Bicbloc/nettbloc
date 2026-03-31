

## Plan : APK affiche directement l'écran de connexion staff (sans landing page)

### Problème
Actuellement, quand l'APK s'ouvre (`/?mode=staff`), l'utilisateur non authentifié est redirigé vers `/landing` (le site vitrine complet). On veut qu'il aille directement à `/auth?mode=staff` (l'écran avec les 3 boutons : Équipe, Gouvernante, Technicien).

### Modifications

**1. `src/pages/Index.tsx`** — Changer la redirection pour les utilisateurs non authentifiés : si `mode=staff` est dans l'URL, rediriger vers `/auth?mode=staff` au lieu de `/landing`.

```tsx
// Ligne ~85-87 actuelle :
if (!isAuthenticated && !isGuestMode) {
  return <Navigate to="/landing" replace />;
}

// Devient :
if (!isAuthenticated && !isGuestMode) {
  const isStaffMode = searchParams.get('mode') === 'staff';
  return <Navigate to={isStaffMode ? "/auth?mode=staff" : "/landing"} replace />;
}
```

**2. `capacitor.config.ts`** — L'URL est déjà correcte (`?mode=staff`), rien à changer.

### Résultat
- **APK** : ouvre directement l'écran de sélection avec 3 boutons (Équipe, Gouvernante, Technicien)
- **Site web** : continue de rediriger vers la landing page comme avant

