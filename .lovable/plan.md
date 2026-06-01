# Problème

L'interface femme de chambre perd parfois la connexion temps réel, et l'établissement met du temps à voir qu'une chambre a été commencée ou nettoyée. Aujourd'hui les données ne se chargent **qu'au montage** de la page (`loadRoomsFromDatabase` dans `Index.tsx`). Tout le reste passe par le temps réel Supabase (`RealtimeManager`). Donc dès qu'un événement temps réel est manqué (déconnexion Wi‑Fi, mise en veille du téléphone, canal `CLOSED`/`TIMED_OUT`), la mise à jour n'arrive jamais — il faut rafraîchir la page manuellement.

Il n'existe aucun **filet de sécurité (fallback)** qui recharge les chambres quand le temps réel est indisponible ou après une reconnexion.

# Solution

Ajouter un mécanisme de rechargement de secours côté établissement **et** côté femme de chambre, sans toucher à la logique métier :

```text
Temps réel OK ──────────────► mises à jour instantanées (inchangé)
       │
       │  perte de connexion / événement manqué
       ▼
Polling de secours (toutes ~20s) ─► recharge les chambres depuis la base
       │
Reconnexion détectée ───────────► rechargement immédiat (rattrapage)
```

## 1. Rendre le chargement réutilisable (établissement)
Dans `src/pages/Index.tsx`, extraire le contenu de `loadRoomsFromDatabase` (lignes ~491‑561) dans une fonction `refetchRooms` mémoïsée (`useCallback`) afin de pouvoir l'appeler à la demande, pas seulement au montage.

## 2. Polling de secours + rattrapage à la reconnexion
Ajouter un `useEffect` qui :
- déclenche `refetchRooms()` à intervalle régulier (~20 s) **uniquement** quand `isImporting`/`isAssigning` sont à `false` (pour ne pas écraser une opération en cours, comme déjà prévu dans le code).
- s'abonne à `realtimeManager.onConnectionStatusChange` : lorsqu'on repasse en `SUBSCRIBED` ou `ONLINE` après une coupure, appeler immédiatement `refetchRooms()` pour rattraper les événements manqués.
- se met en pause quand l'onglet est caché et relance un refetch au retour (`visibilitychange`), pour les téléphones mis en veille.

## 3. Même filet côté femme de chambre
Appliquer le même principe dans le composant de travail de la femme de chambre (`HousekeeperWorkSimple.tsx` / hook associé) : un refetch périodique léger de ses chambres + un refetch au retour de connexion, pour que son interface ne reste pas bloquée sur un état périmé quand elle perd le réseau.

## 4. Indicateur de connexion (léger)
Réutiliser l'état déjà exposé par `useRealtimeSync` (`isConnected`, `consecutiveFailures`) pour afficher un petit badge « Reconnexion… » lorsque le temps réel est coupé, afin que l'utilisateur sache que l'app rattrape les données. (Optionnel mais recommandé.)

# Détails techniques

- Aucune migration base de données nécessaire ; on réutilise les requêtes existantes sur `rooms` et `assignments`.
- Le polling utilise un intervalle de secours (≈20 s) volontairement plus lent que le temps réel pour limiter la charge ; le temps réel reste la voie principale et instantanée.
- Garde-fous conservés : pas de refetch pendant `isImporting`/`isAssigning` pour éviter les courses d'écriture (déjà documenté lignes 562‑565 d'`Index.tsx`).
- Le refetch fusionne `rooms` + `assignments` exactement comme `loadRoomsFromDatabase` actuel, en préservant `lastCleanedAt` et le tri « plus récente d'abord » déjà en place.
- Nettoyage systématique des `setInterval` et des abonnements `onConnectionStatusChange` au démontage.

# Fichiers concernés
- `src/pages/Index.tsx` — extraction `refetchRooms`, polling de secours, rattrapage à la reconnexion.
- `src/components/HousekeeperWorkSimple.tsx` (et/ou son hook) — même filet côté femme de chambre.
- (Optionnel) petit badge de statut de connexion réutilisant `useRealtimeSync`.
