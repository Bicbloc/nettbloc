# Finaliser la clé Firebase + tester le push

Tout le code push est déjà en place (table `device_push_tokens`, trigger sur `notifications`, fonction `send-push`, service `pushNotificationService` branché dans `AppBoot`). Il reste seulement à corriger le secret Firebase, qui est actuellement invalide (il manque l'accolade `{` au début → erreur `Unexpected non-whitespace character`).

## Étapes (au passage en build)
1. Réouvrir le formulaire sécurisé du secret `FIREBASE_SERVICE_ACCOUNT`.
2. Tu y colles le **contenu complet** du fichier JSON Firebase, en commençant par `{` et en finissant par `}` (jamais une seule clé, jamais dans le chat).
3. Je relance un test de la fonction `send-push` pour confirmer qu'elle lit bien la clé (plus d'erreur de parsing JSON).
4. Je vérifie les logs de la fonction pour valider l'authentification FCM.

## Rappels
- La clé déjà collée dans le chat est exposée : à révoquer dans Firebase (Comptes de service) et régénérer.
- Le push ne se teste réellement que dans l'APK installé (pas dans la preview).
