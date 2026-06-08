# Ajustements interface établissement

## 1. Bannière hero uniquement sur « Vue d'ensemble »
`src/pages/Index.tsx` (ligne 897) : la bannière `<HeroHeader>` (Premium / nom hôtel / « Gérez votre établissement… » / Temps réel / Solution complète) est actuellement affichée sur tous les onglets. La conditionner pour qu'elle ne s'affiche que lorsque `activeTab === 'overview'`.

## 2. Nom de l'établissement et code hôtel plus visibles
`src/components/layout/DashboardHeader.tsx` (lignes 85-89) : actuellement le nom de l'hôtel et le code apparaissent en tout petit (`text-[10px]`, masqués hors grand écran) à côté du badge.
- Agrandir le **nom de l'établissement** sous le logo (taille lisible, ex. `text-sm`/`text-base` semi-gras), visible aussi sur écrans plus petits.
- Afficher le **code hôtel** plus grand, **en gras** et bien visible (style mis en avant, ex. badge/texte `font-bold`).

## 3. Élargir la page Petit-déjeuner
`src/components/dashboard/BreakfastTab.tsx` (ligne 316) : le conteneur principal est limité par `max-w-2xl`, ce qui laisse beaucoup d'espace vide à droite. Élargir (retirer la contrainte `max-w-2xl` ou la passer à pleine largeur) pour occuper l'espace disponible. Le panneau de configuration étant dans un `Sheet` latéral, il n'est pas impacté.

## Hors périmètre
Aucune modification de logique métier ni de base de données — uniquement de l'affichage.
