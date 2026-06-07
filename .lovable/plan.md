# Réparer la connexion Apaleo (petit-déjeuner & sync PMS)

## Constat

- Les 2 hôtels (PAR et BER) partagent **exactement les mêmes** Client ID / Client Secret Apaleo ; seul le Property ID change (`PAR` vs `BER`).
- L'hôtel PAR se synchronise avec succès **toutes les minutes** → les identifiants sont valides.
- L'hôtel BER échoue par intermittence avec `400 invalid_client` (il a même réussi avec 1133 chambres à 16h50, puis échoué à 16h51).
- L'appel du token Apaleo n'utilise que Client ID + Secret (pas le Property ID). Des identifiants valides ne peuvent donc pas être « invalides » pour une propriété et valides pour l'autre.

**Cause réelle : throttling du endpoint de token Apaleo.** Le code demande un nouveau token à *chaque* synchro et à *chaque* opération petit-déjeuner (et plusieurs fois dans une même requête). Le cron interroge les deux hôtels à la suite chaque minute avec le même client → trop d'appels au endpoint `connect/token` → Apaleo répond `invalid_client`.

## Correctif

### 1. Mise en cache et réutilisation du token Apaleo (cœur du fix)
Dans `supabase/functions/breakfast-pms-sync/index.ts` et `supabase/functions/pms-sync/index.ts` (et `pms-sync-queue-process` s'il demande un token) :
- Ajouter un cache mémoire au niveau module (`Map` clé = `clientId`) stockant `{ token, expiresAt }`.
- `getApaleoToken` renvoie le token en cache tant qu'il reste valide (avec une marge de sécurité ~60 s avant expiration) ; sinon il en demande un nouveau et le met en cache.
- Conséquence : un seul token par client est réutilisé pour les deux hôtels et pour tous les appels d'une même requête, ce qui supprime le throttling.

### 2. Tolérance au throttling
- Si Apaleo renvoie tout de même `400 invalid_client` ou `429`, refaire une tentative après un court délai (1 petit backoff), puis remonter une erreur claire.

### 3. Messages d'erreur plus clairs (onglet Petit-déjeuner)
Dans `breakfast-pms-sync` (modes `fetch_products`, `fetch_rooms`, `test`) et l'UI `BreakfastTab.tsx` / `breakfastConfigService.ts`, distinguer explicitement :
- **Aucune configuration PMS** pour l'hôtel.
- **Configuration présente mais désactivée** (`is_active = false`) → inviter à l'activer dans Configuration PMS. (C'est le cas actuel de l'hôtel BER : sa config existe mais est désactivée, d'où « Aucune configuration PMS active ».)
- **Identifiants refusés / quota Apaleo** (échec d'authentification réel).

## Étapes après déploiement
1. Réactiver la configuration PMS de l'hôtel concerné (interrupteur `is_active`) dans le panneau Configuration PMS, si elle est désactivée.
2. Cliquer sur « Tester la connexion PMS » : avec le token mis en cache, l'authentification ne doit plus tomber en `invalid_client`.
3. « Importer depuis le PMS » dans l'onglet Petit-déjeuner doit alors récupérer les prestations.

## Détails techniques
- Le cache token est volontairement en mémoire (par instance edge) ; il réduit massivement les appels sans persistance ni stockage de secret. Les tokens Apaleo durent ~1 h.
- Aucune modification de schéma de base de données n'est nécessaire.
- Fichiers touchés : `supabase/functions/breakfast-pms-sync/index.ts`, `supabase/functions/pms-sync/index.ts`, éventuellement `supabase/functions/pms-sync-queue-process/index.ts`, `src/components/dashboard/BreakfastTab.tsx`, `src/services/breakfastConfigService.ts`.
