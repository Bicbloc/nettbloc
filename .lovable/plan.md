## Objectif
Remplacer l'APK téléchargeable depuis la landing page par le nouvel APK fourni (`app-debug.apk`).

## Situation actuelle
- La landing page (`src/pages/Landing.tsx`, ligne 428) contient le lien :
  ```
  <a href="/downloads/nettbloc.apk" download>
  ```
- Le fichier servi est `public/downloads/nettbloc.apk` (~6,4 Mo, ancienne version).
- Le nouvel APK uploadé fait ~18,4 Mo.

## Étapes
1. Copier le nouvel APK uploadé (`app-debug.apk`) vers `public/downloads/nettbloc.apk` en écrasant l'ancien fichier.
2. Conserver le même nom de fichier (`nettbloc.apk`) afin de ne pas modifier le lien existant sur la landing page — aucun changement de code nécessaire.

## Détails techniques
- Le fichier est volumineux (18 Mo). Il sera placé dans `public/downloads/` pour être servi statiquement comme actuellement.
- Aucune modification de `Landing.tsx` n'est requise puisque le chemin reste identique.