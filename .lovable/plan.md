# APK nettobloc : ouverture sur l'auth + notifications sonores + Firebase

## Ce qui est déjà en place (rien à refaire)
- `capacitor.config.ts` pointe déjà sur `https://nettobloc.bicbloc.eu?forceHideBadge=true&mode=staff`.
- La route `/` (Index) redirige `mode=staff` → `/auth?mode=staff` : **l'APK ouvre donc déjà directement sur l'authentification, jamais la landing page**.
- Un service natif (`nativeNotificationService`) envoie déjà notification locale + son système (`sound: 'default'`) + vibration.
- `use-notifications.ts` déclenche déjà ce service à chaque `INSERT` dans la table `notifications` via le temps réel.

Le travail restant : (1) garantir que **tout événement** écrit dans `notifications` (donc sonne), (2) ajouter le **push Firebase** pour que ça sonne même app fermée, (3) te donner les **étapes de build et de config Firebase**.

---

## Partie A — Construire et lancer l'APK (étapes pour toi, sur ton ordinateur)

```text
1. Bouton « Export to GitHub » (haut droite de Lovable) → crée le repo.
2. git clone <ton-repo> puis: cd <dossier>
3. npm install
4. npx cap add android
5. npx cap update android
6. npm run build
7. npx cap sync android
8. npx cap run android        (téléphone branché en USB-debug ou émulateur)
```

Pour générer le fichier `.apk` à installer/distribuer :
```text
9.  npx cap open android        (ouvre Android Studio)
10. Menu: Build → Build Bundle(s)/APK(s) → Build APK(s)
11. L'APK est dans android/app/build/outputs/apk/debug/app-debug.apk
```
Pour une version signée (Play Store / installation propre) : Build → Generate Signed Bundle/APK → créer une keystore.

> À chaque fois que tu modifies le code dans Lovable : `git pull`, puis `npm run build` et `npx cap sync android`.

---

## Partie B — Configurer Firebase (FCM) pour le push « app fermée »

Côté console Firebase (toi, dans le navigateur) :
```text
1. console.firebase.google.com → Add project → nomme-le « nettobloc ».
2. Add app → Android. Package name EXACT: app.lovable.b36a7a8c909b4be7a22cf96dedec2bb4
3. Télécharge google-services.json.
4. Place le fichier dans: android/app/google-services.json
5. Project settings → Cloud Messaging → récupère la clé serveur (API V1 / compte de service JSON).
```

Gradle (Android Studio les ajoute souvent automatiquement via `npx cap sync`, sinon manuel) :
```text
- android/build.gradle: classpath 'com.google.gms:google-services:4.4.x'
- android/app/build.gradle (bas du fichier): apply plugin: 'com.google.gms.google-services'
```

Côté Lovable (je m'en occupe lors du build) :
- Stockage sécurisé de la clé de service Firebase via le gestionnaire de secrets (`FIREBASE_SERVICE_ACCOUNT`) — je te demanderai de coller le JSON quand on passera en build.

---

## Partie C — Modifications de code que je ferai (en mode build)

### 1. Enregistrement du token push (nouveau)
- Nouveau service `pushNotificationService.ts` : au démarrage de l'APK, demande la permission, `PushNotifications.register()`, récupère le token FCM.
- Stocke le token dans une nouvelle table `device_push_tokens` (hotel_id, user_type, token), pour cibler les bons appareils.
- Branché dans `AppBoot.tsx` à côté du `nativeNotificationService.initialize()` existant.

### 2. Table `device_push_tokens` (migration)
- Colonnes : `hotel_id`, `user_type`, `token`, `platform`. GRANT + RLS (insert/update par hôtel).

### 3. Edge function `send-push` (nouveau)
- Reçoit `{ hotel_id, title, body }`, lit les tokens de l'hôtel, envoie via l'API FCM HTTP v1 (auth par `FIREBASE_SERVICE_ACCOUNT`), avec `sound: default` pour la sonnerie native.

### 4. « Sonnerie pour tout événement »
- Option fiable et centralisée : un **trigger Postgres `AFTER INSERT` sur `notifications`** qui appelle l'edge function `send-push` (via `pg_net`). Ainsi, dès qu'une action crée une notification (incident, assignation, tâche, recouche, clôture, etc.), ça sonne en local (déjà le cas, app ouverte) **et** en push (app fermée).
- Vérification que les actions clés écrivent bien dans `notifications` ; pour celles qui ne le font pas encore, ajout de l'insertion.
- Côté front, confirmation que `nativeNotificationService.sendNotification` reste appelé sur chaque INSERT temps réel (déjà en place) pour le son immédiat quand l'app est ouverte.

### 5. Son personnalisé ? (non retenu)
Tu as choisi le **son système par défaut** : aucun fichier `.wav` à bundler, on garde `sound: 'default'`.

---

## Détails techniques (résumé)
- Plugins déjà installés : `@capacitor/push-notifications`, `@capacitor/local-notifications`, `@capacitor/haptics`. Pas d'install supplémentaire nécessaire côté JS.
- `presentationOptions: ["badge","sound","alert"]` déjà présent dans `capacitor.config.ts`.
- FCM v1 nécessite un access token OAuth généré à partir du compte de service → géré dans l'edge function.
- Le push ne fonctionne **que dans l'APK installé** (pas dans la preview navigateur ni l'éditeur Lovable).

---

## Ordre d'exécution proposé (au passage en build)
1. Migration `device_push_tokens` + trigger sur `notifications`.
2. Demande du secret `FIREBASE_SERVICE_ACCOUNT`.
3. Edge function `send-push`.
4. `pushNotificationService.ts` + branchement `AppBoot`.
5. Vérif/ajout des insertions `notifications` pour les actions manquantes.
6. Je te redonne la checklist Android Studio + google-services.json pour générer l'APK final.
