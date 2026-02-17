

# Correction du parsing generique pour rapports tabulaires

## Probleme identifie

Le texte extrait du PDF MisterBooking est en format tabulaire (colonnes separees par des tabulations). Exemple d'une ligne extraite:

```
101\t2\tX\t\tnon\tPropre\t\t16/02/2026\t20/02/2026
```

Le parser generique actuel traite chaque ligne avec un simple regex `(?:^|\t)(\d{2,4}[A-Z]?)\b` qui matche N'IMPORTE QUEL nombre de 2+ chiffres sur la ligne, y compris:
- "16" et "17" provenant de dates "16/02/2026"
- "15" provenant de la colonne "Nb pers" ou de dates
- "13", "14" qui sont aussi des fragments de dates

De plus, certaines chambres comme 203 sont manquees a cause d'un mauvais decoupage de ligne dans l'extraction PDF (colonnes decalees).

## Solution en 3 etapes

### Etape 1 -- Detection intelligente de l'en-tete du tableau

Avant de parser les lignes, le parser generique doit detecter la ligne d'en-tete du tableau (ex: `Chambre\tNb pers\tRECOUCHE\tBLANC\tDayuse\tAssignee...`). En identifiant quelle colonne (index) contient "Chambre" ou "Room", on sait exactement OU chercher le numero de chambre au lieu de prendre le premier nombre venu.

Concretement, dans `parseGenericReport()`:
- Chercher une ligne contenant des mots-cles d'en-tete: "chambre", "room", "zimmer", "nb pers", "statut", "etat"
- Si trouvee: identifier l'index de la colonne "chambre" et ne prendre le numero QUE dans cette colonne
- Si pas trouvee: fallback sur le comportement actuel (premier nombre de la ligne)

### Etape 2 -- Filtrage contextuel des faux positifs

Ajouter des regles anti-faux-positifs plus intelligentes:
- Si un nombre de 2 chiffres (10-31) apparait juste avant un pattern de date (`/\d{2}\/\d{4}/`), c'est un jour et non une chambre -- le rejeter
- Coherence d'etage: si la majorite des chambres detectees ont 3 chiffres (101-606), rejeter les nombres a 2 chiffres qui n'ont pas de statut associe
- Dedoublonnage: si le meme numero apparait plusieurs fois (ex: 104, 204, 303, 403, 503), ne garder que la premiere occurrence avec le meilleur contexte

### Etape 3 -- Fallback pour l'entrainement

Dans `TrainingStep1bColumnMapping.tsx`, si `analysis.parsedData.rows.length === 0`, re-parser le texte brut en mode "split par lignes" sans aucun filtre, et laisser l'utilisateur mapper manuellement les colonnes. Cela garantit que l'ecran d'entrainement n'est JAMAIS vide.

## Details techniques

### Fichiers modifies

1. **`src/services/training/ReportFormatDetector.ts`** -- dans `parseGenericReport()`:
   - Ajouter une phase de detection d'en-tete tabulaire avant la boucle de parsing
   - Quand un en-tete est detecte, extraire le numero de chambre uniquement depuis la colonne identifiee
   - Ajouter un filtre "date context": rejeter les nombres qui font partie d'un pattern de date
   - Ajouter un filtre "coherence d'etage": si >70% des chambres ont 3 chiffres, rejeter les 2 chiffres sans contexte fort
   - Dedoublonner les chambres en gardant l'entree avec le meilleur `confidence`

2. **`src/services/pdfService.ts`** -- dans le filtre post-extraction:
   - Ajouter la meme logique de coherence d'etage (si majorite 3 chiffres, rejeter les 2 chiffres suspects)

3. **`src/components/training/TrainingStep1bColumnMapping.tsx`** -- dans le `useMemo`:
   - Si 0 lignes detectees: parser le texte brut ligne par ligne en mode "raw split" pour afficher QUELQUE CHOSE
   - Afficher un avertissement invitant l'utilisateur a mapper manuellement les colonnes

### Logique de detection d'en-tete

```text
parseGenericReport(text):
  1. Chercher une ligne qui contient >= 3 mots-cles d'en-tete
     (chambre, room, nb pers, statut, etat, date, client, type, assignee)
  2. SI trouvee:
     a. Splitter la ligne par tabulations
     b. Trouver l'index de la colonne "chambre/room"
     c. Pour chaque ligne suivante: splitter par tabs, prendre la valeur a cet index
     d. Verifier que c'est un nombre de 2-4 chiffres
  3. SINON: utiliser le comportement actuel (regex sur toute la ligne)
  4. Appliquer les filtres anti-faux-positifs
  5. Dedoublonner par numero de chambre
```

### Logique de coherence d'etage

```text
Apres le premier passage de detection:
  1. Compter les chambres par longueur de numero (2 chiffres vs 3 chiffres)
  2. Si > 70% ont 3 chiffres:
     -> Rejeter les chambres a 2 chiffres SAUF si elles ont un statut explicite
        (Libre, Recouche, Depart, etc.)
```

### Impact attendu

- Les nombres 15, 16, 17, 13, 14 seront rejetes car:
  - Ils sont dans une colonne "date" ou "Nb pers" (si en-tete detecte)
  - Ils echouent au filtre de coherence d'etage (majorite de chambres a 3 chiffres)
- La chambre 203 sera correctement detectee car elle est dans la colonne "Chambre"
- Les chambres liees (104/105, 204/205, etc.) seront traitees comme des entrees valides
- L'entrainement affichera TOUJOURS des donnees, meme si le parser automatique echoue

