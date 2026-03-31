

## Plan : APK affiche uniquement les logins staff (sans Établissement)

### Contexte
Actuellement, l'APK pointe vers `https://nettobloc.bicbloc.eu?forceHideBadge=true`, qui affiche la page `/auth` avec 4 boutons : Établissement, Équipe, Gouvernante, Technicien. L'utilisateur veut que l'APK ne montre **que** les 3 rôles staff.

### Approche
Puisque l'APK est une WebView qui charge le même site web, on ne peut pas modifier l'APK sans le regénérer. La solution la plus simple est d'utiliser un **paramètre URL** pour indiquer le mode "mobile/staff only" et masquer le bouton Établissement.

### Modifications

**1. `capacitor.config.ts`** — Ajouter un paramètre `mode=staff` à l'URL :
```
url: 'https://nettobloc.bicbloc.eu?forceHideBadge=true&mode=staff'
```

**2. `src/pages/Auth.tsx`** — Dans l'écran de sélection (`mode === 'select'`), lire le paramètre `mode` depuis l'URL. Si `mode=staff`, masquer le bouton "Établissement" et ne montrer que Équipe, Gouvernante et Technicien.

```typescript
const searchParams = new URLSearchParams(window.location.search);
const isStaffMode = searchParams.get('mode') === 'staff';
```

Puis conditionner l'affichage du bouton Établissement :
```tsx
{!isStaffMode && (
  <button onClick={() => navigate('/auth/establishment')}>
    {/* bouton Établissement */}
  </button>
)}
```

### Résultat
- **Site web** (`nettobloc.bicbloc.eu`) : affiche les 4 options comme avant
- **APK** (`?mode=staff`) : affiche uniquement Équipe, Gouvernante, Technicien
- **Pas besoin de regénérer l'APK** si le paramètre est déjà dans l'URL Capacitor actuelle — il suffit de publier le site

### Note importante
Après publication, il faudra **regénérer l'APK** une seule fois car l'URL dans `capacitor.config.ts` change (ajout de `&mode=staff`).

