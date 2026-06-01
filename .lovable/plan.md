# Corriger l'authentification Apaleo (retirer le scope)

## Cause confirmée par test live
- Avec `scope=reservation.read inventory.read` → Apaleo répond `{"error":"invalid_scope"}`.
- Sans paramètre `scope` → le token est délivré et contient déjà tous les scopes du compte (account.read, reservations, inventory, etc.).

Mon ajout précédent du `scope` était donc la cause de l'échec. Il faut le retirer.

## Modification

### `supabase/functions/pms-sync/index.ts` — fonction `fetchApaleoRooms`
- **Retirer la ligne `scope: 'reservation.read inventory.read'`** des `URLSearchParams` de la requête `connect/token`. Garder `grant_type`, `client_id`, `client_secret`.
- Conserver le reste des améliorations déjà en place : helper `safeJson`, validation de `clientId`/`clientSecret`/`propertyId`, message clair si `access_token` absent.

## Validation
- Déployer `pms-sync`.
- Tester le token Apaleo (déjà confirmé OK sans scope).
- Vérifier ensuite la récupération des unités et réservations avec le `propertyId` configuré, et confirmer que le test renvoie « Connexion réussie : N chambres ».
