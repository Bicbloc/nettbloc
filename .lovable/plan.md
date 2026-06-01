# Fiabiliser la connexion API Apaleo

## Objectif
Supprimer l'erreur « unexpected end of JSON input » lors du test de connexion Apaleo et renvoyer des messages d'erreur clairs.

## Cause identifiée
L'edge function `pms-sync` plante silencieusement pendant les appels Apaleo (scope OAuth manquant et parsing JSON non protégé), ce qui fait que le frontend reçoit une réponse vide qu'il n'arrive pas à parser → « unexpected end of JSON input ».

## Modifications

### 1. `supabase/functions/pms-sync/index.ts` — fonction `fetchApaleoRooms`
- **Ajouter le scope OAuth** dans la requête `connect/token` : ajouter `scope: 'reservation.read inventory.read'` aux `URLSearchParams`. C'est requis par Apaleo pour autoriser l'accès aux unités et réservations.
- **Sécuriser tous les `.json()`** : créer un petit helper `safeJson(res)` qui lit d'abord `res.text()` puis tente `JSON.parse`, et jette une erreur explicite (`"Réponse Apaleo invalide [status]: corps vide/non-JSON"`) au lieu de « unexpected end of JSON input ». L'appliquer au token, aux units et aux réservations.
- **Vérifier la présence du token** : si `access_token` est absent après parsing, jeter une erreur claire (« Token Apaleo non reçu — vérifiez Client ID / Client Secret »).
- **Valider `propertyId`** en amont : si vide, renvoyer « Property ID manquant ».

### 2. Robustesse générale du handler
- Envelopper le mapping final dans le try/catch existant (déjà le cas) — vérifier qu'aucune exception ne sort de la réponse JSON.

### 3. Frontend `src/components/pms/PmsApiConfigPanel.tsx`
- Dans `testConnection`, si `error` remonte de `invoke`, afficher un message générique plus utile (« Le serveur n'a pas répondu correctement, réessayez ») plutôt que de propager l'erreur brute de parsing.

## Validation
- Déployer la fonction puis la tester via l'outil de test edge function avec `action: 'test'` sur le hôtel Apaleo configuré.
- Vérifier les logs de l'edge function pour confirmer qu'une erreur lisible est renvoyée (et non un crash) en cas de mauvais identifiants.

## Détails techniques
- Endpoint token : `https://identity.apaleo.com/connect/token` (grant_type=client_credentials).
- Scopes Apaleo minimaux pour la lecture : `reservation.read`, `inventory.read`. Si le compte Apaleo n'a pas ces scopes activés, le test renverra désormais un message clair à la place de l'erreur JSON.
