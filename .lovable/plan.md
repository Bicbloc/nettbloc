# Générer l'APK Nettobloc avec notifications — depuis le début

Votre Android Studio est déjà connecté à GitHub et vous avez le fichier `google-services.json`. On repart proprement et on fait tout depuis le **Terminal intégré d'Android Studio** (menu `View → Tool Windows → Terminal`, ou l'onglet "Terminal" en bas).

Aucune modification de code n'est nécessaire — le projet est déjà prêt (plugins Capacitor v7, service push FCM, config `appId` correcte). Ce plan est purement une procédure à suivre de votre côté.

---

## Étape 0 — Repartir sur une base propre

Dans le Terminal d'Android Studio (à la racine du projet) :

```bash
git pull
```

Cela récupère la dernière version (package.json corrigé v7 + service push). Ensuite, on supprime un éventuel ancien dossier `android` incomplet pour éviter les conflits :

```bash
rm -rf android
```

> Si la commande dit que le dossier n'existe pas, c'est parfait : il n'y avait rien à nettoyer.

---

## Étape 1 — Installer les dépendances

```bash
npm install --legacy-peer-deps
```

Le `--legacy-peer-deps` est nécessaire à cause d'un conflit secondaire entre `react-day-picker` et `date-fns` (sans rapport avec Capacitor). C'est sans danger.

---

## Étape 2 — Construire le site web

```bash
npm run build
```

Cela génère le dossier `dist/` que Capacitor va embarquer dans l'app.

---

## Étape 3 — Ajouter la plateforme Android

```bash
npx cap add android
```

Cela crée le dossier natif `android/`.

---

## Étape 4 — Placer le fichier Firebase (indispensable pour les notifications)

Copiez votre fichier `google-services.json` dans :

```text
android/app/google-services.json
```

Il doit être **exactement** à cet endroit (au même niveau que le `build.gradle` du module app). Sans ce fichier, l'app se construit quand même mais les notifications push ne fonctionneront pas.

> Vérifiez aussi que, dans Firebase, le nom de package de l'app est bien :
> `app.lovable.b36a7a8c909b4be7a22cf96dedec2bb4`

---

## Étape 5 — Synchroniser Capacitor

```bash
npx cap sync android
```

Cela copie le build web + les plugins (push, notifications locales, caméra, haptics) dans le projet Android.

---

## Étape 6 — Ouvrir et générer l'APK dans Android Studio

```bash
npx cap open android
```

Une fois le projet ouvert et indexé (Gradle sync terminé en bas) :

1. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Attendez la fin de la compilation
3. Cliquez sur **locate** dans la notification, ou récupérez le fichier ici :
   ```text
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. Transférez cet APK sur le téléphone Android et installez-le (autoriser les sources inconnues).

---

## Étape 7 — Vérifier les notifications

1. Lancez l'app sur le téléphone, connectez-vous avec un compte staff et choisissez un hôtel.
2. Acceptez la demande de permission **notifications** au premier lancement.
3. Déclenchez une action qui crée une notification (ex. assignation de chambre) → le téléphone doit sonner/vibrer, **même app fermée**.

---

## Détails techniques (pour référence)

- `capacitor.config.ts` : `appId = app.lovable.b36a7a8c909b4be7a22cf96dedec2bb4`, `server.url` pointe vers `https://nettobloc.bicbloc.eu` (mode staff) → l'app charge le site en production en WebView.
- Plugins déjà alignés en v7 : `@capacitor/camera`, `haptics`, `local-notifications`, `push-notifications`.
- Le push FCM (`pushNotificationService`) enregistre le token dans la table `device_push_tokens` (ciblage par hôtel) ; la fonction edge `send-push` envoie via FCM.
- Le push ne fonctionne **que dans l'APK installé**, jamais dans la preview navigateur.

---

### Si une étape échoue
- `cap sync` se plaint que la plateforme n'existe pas → relancez l'Étape 3.
- Gradle échoue sur Firebase → vérifiez l'emplacement exact du `google-services.json` (Étape 4).
- Conflit npm → toujours `npm install --legacy-peer-deps`.

Dites-moi à quelle étape vous êtes / quel message exact apparaît, et je vous débloque.