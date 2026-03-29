

# Générer un APK pour l'interface Technicien

## Situation actuelle

Capacitor est deja configure dans le projet avec les dependances Android (`@capacitor/android`). La configuration pointe vers `https://nettobloc.bicbloc.eu`.

## Ce qu'il faut faire

Aucune modification de code n'est necessaire dans Lovable. Le projet est deja pret pour generer un APK. Voici les etapes a suivre sur votre machine locale :

### Etapes pour generer l'APK

1. **Exporter vers GitHub** via le bouton "Export to GitHub" dans Lovable
2. **Cloner le projet** sur votre machine :
   ```bash
   git clone <votre-repo-github>
   cd <nom-du-projet>
   ```
3. **Installer les dependances** :
   ```bash
   npm install
   ```
4. **Ajouter la plateforme Android** :
   ```bash
   npx cap add android
   ```
5. **Builder le projet** :
   ```bash
   npm run build
   ```
6. **Synchroniser avec Android** :
   ```bash
   npx cap sync android
   ```
7. **Generer l'APK** avec Android Studio :
   ```bash
   npx cap open android
   ```
   Puis dans Android Studio : **Build → Build Bundle(s) / APK(s) → Build APK(s)**

### Pre-requis

- **Android Studio** installe sur votre machine
- **Java JDK 17+**

### Optionnel - Forcer l'ouverture sur la page technicien

Si vous souhaitez que l'APK ouvre directement l'interface technicien, on peut modifier le `capacitor.config.ts` pour pointer vers `/technician-login` :

```typescript
server: {
  url: 'https://nettobloc.bicbloc.eu/technician-login?forceHideBadge=true',
  cleartext: true
}
```

### Important

L'APK genere chargera l'application web depuis votre serveur publie. Il n'embarque pas le code en local — c'est une WebView qui pointe vers votre site. Cela signifie que les mises a jour du site sont automatiquement refletees dans l'APK sans republier.

Pour plus de details, consultez le guide Capacitor : https://docs.lovable.dev/tips-tricks/mobile-development

