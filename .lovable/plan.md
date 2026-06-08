# Ajouter les permissions Inspection et Petit-déjeuner

## Contexte
La liste des permissions de la section « Rôle et permissions » est définie dans le tableau `ALL_PERMISSIONS` de `src/components/SubAccountsManager.tsx`. Elle est rendue automatiquement par catégorie (`permissionsByCategory`), donc ajouter des entrées suffit à les faire apparaître dans le formulaire de création **et** d'édition d'un sous-compte.

## Modifications

### `src/components/SubAccountsManager.tsx` — tableau `ALL_PERMISSIONS`
Ajouter trois nouvelles catégories avec leurs permissions :

**Catégorie « Inspection »**
- `inspection.view` — Voir les inspections
- `inspection.manage` — Gérer les inspections

**Catégorie « Petit-déjeuner »**
- `breakfast.view` — Voir le petit-déjeuner
- `breakfast.manage` — Gérer le petit-déjeuner

**Catégorie « Configuration petit-déjeuner »**
- `breakfast.config` — Configurer le petit-déjeuner

Les clés suivent la convention existante (`ressource.action`). Comme le rendu se fait dynamiquement via `permissionsByCategory`, aucune autre modification d'affichage n'est nécessaire — les nouvelles cases à cocher apparaîtront automatiquement, sélectionnables et enregistrées dans `sub_account_permissions` comme les autres.

## Hors périmètre
Cette tâche ajoute uniquement les permissions dans l'écran « Rôle et permissions » (création/édition). L'application effective de ces permissions pour masquer/afficher réellement les pages Inspection et Petit-déjeuner dans la navigation pourra être faite dans un second temps si souhaité.
