
# Plan de Correction - Workflow d'Approbation des Femmes de Chambre

## Contexte du Problème

L'analyse a révélé **2 problèmes critiques** dans le workflow d'approbation des demandes d'accès des femmes de chambre :

1. **Vidi n'apparaît pas dans la liste des femmes de chambre de l'établissement** car la fonction d'approbation ne crée pas d'entrée dans la table `housekeepers`
2. **L'hôtel n'apparaît pas dans l'interface de Vidi** car la politique RLS sur la table `hotels` bloque l'accès (elle n'est pas propriétaire de l'hôtel)

---

## Données Vérifiées en Base

| Table | Vidi Présente ? | Commentaire |
|-------|-----------------|-------------|
| `housekeeper_profiles` | ✅ Oui | ID: `5846b4fa...`, email: `aminekhellas2+4@gmail.com` |
| `housekeeper_access_requests` | ✅ Oui | Status: `approved`, hotel: HTL904 |
| `housekeeper_hotel_history` | ✅ Oui | Lien actif avec Hotel ARTOIS |
| `housekeepers` | ❌ Non | **C'est le problème #1** |

---

## Solution en 2 Parties

### Partie 1 : Créer automatiquement l'entrée dans `housekeepers` lors de l'approbation

**Fichier à modifier :** `src/components/HousekeeperAccessRequests.tsx`

**Changement :** Après l'approbation, insérer également une entrée dans la table `housekeepers` avec un code d'accès généré.

```text
Flux actuel :
1. approve_housekeeper_access_request RPC
2. INSERT housekeeper_hotel_history
3. ❌ Fin (manque housekeepers)

Flux corrigé :
1. approve_housekeeper_access_request RPC
2. INSERT housekeeper_hotel_history  
3. ✅ INSERT housekeepers (nouveau)
```

**Détail technique :**
- Récupérer le `hotel_code` et le nom de la femme de chambre
- Générer un code d'accès unique : `{HOTEL_CODE}-{INITIALES}-{4 chiffres}`
- Insérer dans `housekeepers` avec `user_id` = l'ID du profil housekeeper

---

### Partie 2 : Permettre aux femmes de chambre de voir les hôtels approuvés

**Problème RLS :** La table `hotels` a une politique `Users can view their own hotels` qui vérifie `auth.uid() = user_id`. Les femmes de chambre ne sont pas propriétaires, donc elles ne peuvent pas voir les détails de l'hôtel via le JOIN.

**Solution :** Créer une fonction RPC `SECURITY DEFINER` qui récupère les hôtels approuvés pour une femme de chambre.

**Migration SQL :**
```sql
CREATE OR REPLACE FUNCTION get_approved_hotels_for_housekeeper(p_housekeeper_profile_id UUID)
RETURNS TABLE (
  hotel_id UUID,
  hotel_name TEXT,
  hotel_code TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    h.id as hotel_id,
    h.name as hotel_name,
    h.hotel_code
  FROM housekeeper_access_requests har
  JOIN hotels h ON h.id = har.hotel_id
  WHERE har.housekeeper_profile_id = p_housekeeper_profile_id
  AND har.status = 'approved'
  ORDER BY h.name;
$$;
```

**Fichier à modifier :** `src/pages/HousekeeperHotels.tsx`

**Changement :** Remplacer la requête directe par l'appel RPC :
```typescript
// Avant
const { data: approvedHotels } = await supabase
  .from('housekeeper_access_requests')
  .select('hotel_id, hotels(id, name, hotel_code)')
  ...

// Après  
const { data: approvedHotels } = await supabase
  .rpc('get_approved_hotels_for_housekeeper', { 
    p_housekeeper_profile_id: profileData.id 
  });
```

---

## Correction Immédiate des Données Existantes

Pour corriger Vidi immédiatement, une migration SQL ajoutera son entrée dans `housekeepers` :

```sql
-- Ajouter les femmes de chambre approuvées manquantes dans housekeepers
INSERT INTO housekeepers (hotel_id, name, access_code, user_id, is_active)
SELECT 
  har.hotel_id,
  hp.name,
  har.hotel_code || '-' || UPPER(LEFT(hp.name, 3)) || '-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT,
  hp.id,
  true
FROM housekeeper_access_requests har
JOIN housekeeper_profiles hp ON hp.id = har.housekeeper_profile_id
WHERE har.status = 'approved'
AND NOT EXISTS (
  SELECT 1 FROM housekeepers h 
  WHERE h.hotel_id = har.hotel_id 
  AND h.user_id = hp.id
);
```

---

## Fichiers à Modifier

| Fichier | Type de Modification |
|---------|---------------------|
| `supabase/migrations/xxx.sql` | Fonction RPC + correction données |
| `src/components/HousekeeperAccessRequests.tsx` | Ajouter insertion dans `housekeepers` |
| `src/pages/HousekeeperHotels.tsx` | Utiliser la nouvelle fonction RPC |

---

## Résultat Attendu

Après ces corrections :

1. **Pour l'établissement :** Vidi apparaîtra dans la liste des femmes de chambre et pourra recevoir des assignations
2. **Pour Vidi :** L'hôtel HTL904 apparaîtra dans sa liste et elle pourra voir ses chambres à nettoyer
3. **Pour le futur :** Toute nouvelle approbation créera automatiquement l'entrée dans `housekeepers`

---

## Détails Techniques

### Structure de la table `housekeepers`

```text
housekeepers
├── id (UUID, PK)
├── hotel_id (UUID, FK → hotels)
├── name (TEXT)
├── access_code (TEXT, unique)
├── user_id (UUID) → lien vers housekeeper_profiles.id
├── is_active (BOOLEAN)
└── created_at, updated_at
```

### Génération du code d'accès

Format : `{HOTEL_CODE}-{INITIALES}-{4 chiffres aléatoires}`
Exemple pour Vidi à HTL904 : `HTL904-VID-5289`
