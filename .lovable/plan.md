# MisterBooking — Push ménage + UI facturation petit-déjeuner

## Objectif
1. Fiabiliser la remontée « chambre propre/sale » vers MisterBooking (format de date attendu).
2. Afficher un message clair côté admin quand le PMS est MisterBooking, au lieu de listes vides pour les prestations (« charges ») et les plans tarifaires.

## Contexte (constats)
- L'API MisterBooking intégrée n'expose **ni catalogue de prestations facturables, ni plans tarifaires**. Dans `breakfast-pms-sync`, `fetch_products` et `fetch_rate_plans` renvoient donc volontairement des tableaux vides pour `mister_booking`. Ce n'est pas un bug : c'est une limite de l'API partenaire. → On ne peut pas « récupérer » ces données ; on doit l'expliquer à l'utilisateur.
- Le push « propre/sale » fonctionne déjà : `RoomSyncService.updateStatus` → `pms_sync_queue` → `pms-sync-queue-process` → `mbUpdateHousekeeping` (`houseKeeping/update`). Seul risque : la date envoyée est un ISO complet (`new Date().toISOString()`) alors que MisterBooking attend `YYYY-MM-DD`.

## Changements

### 1. Format de date du push ménage (fix fiabilité)
- Dans `supabase/functions/pms-sync-queue-process/index.ts`, à l'appel `mbUpdateHousekeeping`, envoyer la date au format `YYYY-MM-DD` (date du jour) au lieu de `new Date().toISOString()`.

### 2. UI facturation petit-déjeuner (clarté MisterBooking)
- Dans `src/components/dashboard/BreakfastTab.tsx`, détecter quand le PMS configuré est `mister_booking` (via la config déjà chargée / `pms` renvoyé par les fetch).
- Quand c'est MisterBooking :
  - Remplacer les listes vides « prestations » et « plans tarifaires inclus » par un message d'information clair indiquant que MisterBooking ne fournit pas le catalogue de prestations ni les plans tarifaires via son API, et que l'inclusion petit-déjeuner doit être gérée autrement (ex. manuellement).
  - Masquer ou désactiver les boutons « Importer les prestations » / « Récupérer les plans tarifaires » dans ce cas pour éviter les retours vides perçus comme une erreur.

## Détails techniques
- La détection du type PMS côté front peut s'appuyer sur le champ `pms` déjà retourné par `fetchPmsProducts` / `fetchPmsRatePlans` (`pms: 'mister_booking'`), ou sur la config PMS active de l'hôtel.
- Aucune migration de base de données nécessaire.
- Aucun secret supplémentaire requis.
- Les fonctions edge sont redéployées automatiquement.

## Hors périmètre
- Aucun nouvel endpoint MisterBooking (l'API ne les expose pas).
- Pas de modification de la logique de facturation Mews/Apaleo.
