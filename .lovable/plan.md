# Détection fiable des types de nettoyage Apaleo

## Objectif
Aujourd'hui, le type de nettoyage (À blanc / Recouche / Arrivée) est déduit **uniquement** des dates `arrival` / `departure` des réservations. C'est fragile : une chambre sans réservation trouvée est mise « À blanc » par défaut, et on ignore l'état réel du ménage. On va croiser cette logique avec le **statut de ménage natif d'Apaleo** (champ `condition`: `Clean`, `Dirty`, `CleanToBeInspected`, `OutOfService`, `OutOfOrder`).

## Logique cible (dans `pms-sync`)

Pour chaque chambre, on combine deux sources :

1. **`condition`** Apaleo (état physique de la chambre) — récupéré via l'API Inventory (les units exposent `condition`).
2. **Réservation du jour** (dates arrivée/départ) — déjà récupérée.

Règles de décision :

```text
Si condition = OutOfService / OutOfOrder  -> chambre HORS SERVICE (pas de ménage)
Sinon, selon la réservation du jour :
  - départ aujourd'hui                     -> À BLANC (a_blanc)
  - arrivée aujourd'hui (sans départ)      -> ARRIVÉE (arrivee)
  - séjour en cours (ni l'un ni l'autre)   -> RECOUCHE (recouche)
  - aucune réservation :
        condition = Dirty                  -> À BLANC (a_blanc)
        condition = Clean / CleanToInspect -> RIEN À FAIRE (none / clean)
```

Le statut affiché en base reste cohérent avec le registre existant (`needs-cleaning`, etc.), et les chambres déjà propres / hors service ne sont plus systématiquement marquées « À blanc ».

## Détails techniques

- Modifier `fetchApaleoRooms()` dans `supabase/functions/pms-sync/index.ts` :
  - Lire le champ `condition` retourné par l'endpoint `inventory/v1/units` (ajouter `expand=condition` ou utiliser `operations/v1/maintenances` si le champ n'est pas présent ; vérifier via un appel test).
  - Ajouter `condition` à l'objet chambre retourné (pour l'affichage dans l'aperçu).
  - Mettre à jour la logique `cleaningType` / `status` selon les règles ci-dessus.
- Adapter le mapping `toDbCleaningType()` pour gérer le cas « propre / rien à faire » et « hors service ».
- Afficher la colonne « État ménage » (Clean/Dirty) dans le tableau d'aperçu de `PmsApiConfigPanel.tsx` pour que l'utilisateur voie d'où vient la décision.

## Validation
- Déployer `pms-sync`, relancer « Tester la connexion » sur le compte démo.
- Vérifier que les chambres propres ne sont plus toutes en « À blanc » et que `condition` remonte bien.
- Contrôler les logs de la fonction en cas de réponse vide.

## Note
Si l'API du compte Apaleo n'expose pas le champ `condition` (selon les scopes accordés), on conserve la logique actuelle basée sur les dates comme repli automatique, sans casser la synchro.