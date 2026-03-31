

## Probleme

La femme de chambre ne voit pas le plan car la fonction SQL `can_access_hotel()` ne reconnaît pas correctement les femmes de chambre.

**Cause racine** : dans `can_access_hotel()`, le check housekeeper fait `hp.id = auth.uid()`, mais `housekeeper_profiles.id` est un UUID aléatoire (pas lié à `auth.uid()`). La bonne méthode est de passer par l'email, comme le fait déjà `get_housekeeper_profile_id()`.

Le code actuel (incorrect) :
```sql
EXISTS (
  SELECT 1 FROM hotel_access_sessions has
  JOIN housekeeper_profiles hp ON hp.id = has.housekeeper_profile_id
  WHERE has.hotel_id = p_hotel_id
  AND has.is_active = true
  AND has.expires_at > now()
  AND hp.id = auth.uid()  -- ❌ hp.id ≠ auth.uid()
)
```

## Correction

Mettre a jour la fonction `can_access_hotel()` pour utiliser la jointure email comme `get_housekeeper_profile_id()` :

```sql
-- User is a housekeeper with active access session
EXISTS (
  SELECT 1 FROM hotel_access_sessions has
  JOIN housekeeper_profiles hp ON hp.id = has.housekeeper_profile_id
  JOIN auth.users u ON u.email = hp.email
  WHERE has.hotel_id = p_hotel_id
  AND has.is_active = true
  AND has.expires_at > now()
  AND u.id = auth.uid()
)
```

### Fichier modifie

**1 nouvelle migration SQL** — `can_access_hotel` mise a jour avec la jointure correcte par email pour les housekeepers. Aucun changement frontend necessaire.

