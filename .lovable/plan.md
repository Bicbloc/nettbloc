
# Correction du parsing MisterBooking et amelioration de la precision

## Probleme identifie

Le PDF vient de **MisterBooking** (`new.misterbooking.com`), un PMS non reconnu par le systeme. Il tombe dans le parser `generic_table`, qui utilise un regex trop permissif : `^(\d{2,4}[A-Z]?)\b`. Cela fait que des numeros parasites comme "01" et "14" (numeros de page, compteurs, indices de tableau) sont detectes comme des chambres.

## Cause racine

1. **Pas de signature MisterBooking** dans `FORMAT_SIGNATURES` du `ReportFormatDetector.ts`
2. Le parser generique accepte n'importe quel nombre de 2+ chiffres en debut de ligne comme numero de chambre
3. Pas de validation contextuelle : le systeme ne verifie pas si la ligne contient aussi des mots-cles de statut/nettoyage avant de considerer qu'il s'agit d'une chambre

## Plan de correction

### Etape 1 - Ajouter la signature MisterBooking

Ajouter un nouveau format `misterbooking_housekeeping` dans `ReportFormatDetector.ts` :
- Signatures : `misterbooking.com`, `femme de chambre`, patterns specifiques au format MisterBooking
- Parser dedie qui comprend la structure du rapport MisterBooking (colonnes, statuts)

### Etape 2 - Renforcer le parser generique

Modifier `parseGenericReport()` pour ne pas accepter un numero seul en debut de ligne :
- Exiger qu'un numero de chambre soit suivi d'au moins un indicateur de contexte (statut, type de chambre, nom de client, date)
- Ajouter des filtres d'exclusion : ignorer les lignes qui ressemblent a des en-tetes, numeros de page, ou texte libre
- Verifier que le nombre n'est pas isole (il doit etre accompagne d'autres colonnes)

### Etape 3 - Ameliorer isHeaderLine()

Ajouter des patterns de detection d'en-tetes MisterBooking et generiques :
- `femme de chambre`, `intendance`, `misterbooking`
- Numeros isoles en debut ou fin de page (pagination)
- Lignes trop courtes (moins de 10 caracteres utiles) ne contenant qu'un nombre

### Etape 4 - Validation post-extraction

Ajouter un filtre dans `processPdf()` apres l'extraction :
- Eliminer les chambres dont le numero ne correspond pas au pattern attendu de l'hotel (si le registre des chambres `hotel_rooms_registry` existe)
- Eliminer les chambres sans aucun indicateur de statut/nettoyage et avec une confiance inferieure a 40%
- Logger les chambres rejetees pour transparence

## Details techniques

### Fichiers modifies

- `src/services/training/ReportFormatDetector.ts` : ajout signature MisterBooking + parser dedie + renforcement `isHeaderLine()`
- `src/services/pdfService.ts` : ajout filtre post-extraction avec validation contre le registre des chambres
- `src/services/pms/RoomLineParser.ts` : renforcement de la validation contextuelle dans `parseSection()` (rejeter les numeros isoles sans statut ni type)

### Logique du parser MisterBooking

Le parser analysera la structure specifique des rapports MisterBooking :
- Detecter les colonnes par position (numero, type chambre, statut, client, dates)
- Utiliser les mots-cles MisterBooking pour le cleaning type
- Ignorer les en-tetes et pieds de page propres a ce PMS

### Filtre post-extraction

```text
Pour chaque chambre detectee :
  SI hotel_rooms_registry existe ET contient des chambres :
    SI la chambre n'est PAS dans le registre :
      Marquer avec confiance basse (flag de verification)
  SI aucun statut/mot-cle detecte ET confiance < 40% :
    Rejeter la chambre (faux positif probable)
```

### Impact

- Les chambres "01" et "14" seront rejetees car elles n'ont pas de contexte de nettoyage
- Les vrais numeros de chambre du rapport MisterBooking seront correctement detectes
- Les autres formats (Mews, Apaleo, etc.) ne sont pas affectes
