## Objectif
Ajouter une barre de défilement visible (avec curseur déplaçable) dans le panneau "Journal des Actions" (cloche de notifications) pour pouvoir monter et descendre facilement dans la liste.

## Problème actuel
Dans `src/components/ActionLogPanel.tsx`, la liste utilise un `ScrollArea` avec `max-h-[calc(70vh-60px)]` et une barre de défilement très discrète (`bg-muted/20`, pouce `bg-foreground/25`). Le résultat : la barre est peu visible et le défilement n'est pas évident.

## Modifications

1. **`src/components/ActionLogPanel.tsx`**
   - Donner une hauteur fixe à la zone scrollable (ex. `h-[60vh]` au lieu de `max-h-...`) afin que le défilement s'active toujours quand il y a beaucoup d'actions.
   - S'assurer que le `ScrollBar` est visible en permanence (`type="always"`, déjà par défaut) et lui donner un curseur plus contrasté/large pour être bien saisissable.

2. **`src/components/ui/scroll-area.tsx`** (optionnel, léger)
   - Rendre le pouce (thumb) un peu plus visible (couleur/contraste plus marqué) sans casser le reste de l'app, ou bien appliquer ce style uniquement via `className` dans `ActionLogPanel` pour ne pas impacter les autres écrans.

L'approche privilégiée est de garder le composant `scroll-area` global intact et d'appliquer le style renforcé localement dans `ActionLogPanel`, afin de limiter le changement à ce panneau précis.

## Résultat attendu
Le panneau de la cloche affiche une barre de défilement nette avec un curseur déplaçable, permettant de monter et descendre dans la liste des actions.