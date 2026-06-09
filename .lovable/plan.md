# Webhook Mews — synchronisation temps réel

## Objectif
Permettre à Mews de notifier nettobloc en temps réel (au lieu du polling actuel) : quand un client fait check-in/check-out ou qu'une chambre change d'état côté Mews, l'information remonte immédiatement dans l'application — comme pour MisterBooking et Apaleo.

## Comment Mews envoie les événements (vérifié dans la doc)
Mews envoie un POST avec ce format (« General Webhook ») :
```json
{
  "EnterpriseId": "851df8c8-...",
  "IntegrationId": "c8bee838-...",
  "Events": [
    { "Discriminator": "ServiceOrderUpdated", "Value": { "Id": "..." } },
    { "Discriminator": "ResourceUpdated",     "Value": { "Id": "..." } }
  ]
}
```
Points clés :
- Le message identifie l'établissement via `EnterpriseId`.
- Chaque événement ne contient que l'ID de l'entité, **pas le détail** → il faut rappeler l'API Mews pour récupérer l'état réel.
- Mews attend une réponse **rapide** (sinon il renvoie le message en boucle) → on répond `200` tout de suite et on traite en arrière-plan.

## Ce qui sera construit

### 1. Nouvelle edge function `mews-webhook` (publique, sans JWT)
- Reçoit le POST de Mews, répond `200` immédiatement.
- Traite en arrière-plan (`EdgeRuntime.waitUntil`) :
  - Ne garde que les événements utiles : `ServiceOrderUpdated` (réservations → check-in/out) et `ResourceUpdated` (état chambre). Ignore le reste.
  - Identifie l'hôtel nettobloc correspondant à `EnterpriseId`.
  - Déclenche une re-synchronisation ciblée de cet hôtel via `pms-sync`.
- URL à renseigner côté Mews :
  ```
  https://rarhqnvvbjzfdevnghnz.supabase.co/functions/v1/mews-webhook
  ```

### 2. Association `EnterpriseId` → hôtel
- Lecture des configs PMS Mews actives.
- Si l'`EnterpriseId` n'est pas encore connu pour une config, appel unique à `configuration/get` (Mews) pour le récupérer, puis mémorisation dans `credentials.enterpriseId` afin d'éviter de refaire l'appel à chaque webhook.
- Correspondance ensuite instantanée.

### 3. Nouvelle action privilégiée `sync_hotel` dans `pms-sync`
- Action protégée (auth service-role / cron, jamais anonyme).
- Synchronise **un seul hôtel** en réutilisant tout le pipeline existant `performSync` (récupération chambres + réservations Mews, upsert `rooms`, logs, propositions de registre).
- Appelée par `mews-webhook`.

### 4. Configuration
- Déclaration de `mews-webhook` dans `supabase/config.toml` avec `verify_jwt = false` (endpoint public appelé par Mews).
- Mise à jour de la mémoire projet (intégration Mews : webhook temps réel).

## Comportement résultant
- **Check-out** détecté → chambre passe en « à blanc » immédiatement.
- **Check-in** détecté → chambre « occupée / recouche ».
- **Changement d'état housekeeping côté Mews** → reflété dans nettobloc.
- Le **polling existant** (cron `pms-sync` action `poll`) reste actif en repli, donc aucune régression même si un webhook est manqué.

## Détails techniques
- Pas de signature HMAC dans le General Webhook Mews (contrairement à MisterBooking) : la sécurité repose sur l'URL + la validation par `EnterpriseId` connu. Un événement dont l'`EnterpriseId` ne correspond à aucune config Mews active est ignoré.
- Dé-duplication : un seul `sync_hotel` par hôtel et par message webhook, même si plusieurs événements arrivent ensemble.
- Aucune migration de base de données nécessaire (l'`enterpriseId` est stocké dans le JSON `credentials` existant).

## Fichiers concernés
- `supabase/functions/mews-webhook/index.ts` (nouveau)
- `supabase/functions/pms-sync/index.ts` (ajout action `sync_hotel`)
- `supabase/config.toml` (déclaration de la fonction)
- Mémoire projet (intégration Mews)
