
# Plan : Améliorer le flux de réinitialisation de mot de passe femme de chambre

## Résumé
Améliorer l'interface de réinitialisation de mot de passe pour les femmes de chambre en ajoutant un champ de confirmation et en s'assurant que les emails utilisent le bon domaine (sans Lovable visible).

---

## Problèmes identifiés

1. **Interface incomplète** : La page `/housekeeper/auth` n'a qu'un seul champ "nouveau mot de passe" sans confirmation
2. **Configuration Supabase** : Le Site URL doit être `https://nettobloc.bicbloc.eu` pour que les liens de réinitialisation pointent vers le bon domaine

---

## Modifications à effectuer

### 1. Ajouter le champ de confirmation du mot de passe

**Fichier** : `src/pages/HousekeeperAuth.tsx`

- Ajouter un état `confirmPassword` pour stocker la confirmation
- Ajouter un champ de saisie "Confirmer le nouveau mot de passe" 
- Valider que les deux mots de passe correspondent avant soumission
- Afficher une erreur si les mots de passe ne correspondent pas

### 2. Améliorer le handler de mise à jour

**Fichier** : `src/pages/HousekeeperAuth.tsx`

- Modifier `handleUpdatePassword` pour vérifier que `newPassword === confirmPassword`
- Afficher un message d'erreur explicite si les mots de passe diffèrent

---

## Détails techniques

### État à ajouter
```text
const [confirmPassword, setConfirmPassword] = useState('');
```

### Interface recovery mode mise à jour
La section "Recovery Mode" (lignes 201-261) sera modifiée pour inclure :
- Champ "Nouveau mot de passe" (existant)
- Champ "Confirmer le nouveau mot de passe" (nouveau)
- Bouton "Valider" (existant, renommé)

### Validation ajoutée
```text
if (newPassword !== confirmPassword) {
  toast({ variant: "destructive", ... });
  return;
}
```

---

## Configuration Supabase requise (action manuelle)

Pour que les emails de réinitialisation pointent vers `nettobloc.bicbloc.eu` au lieu de Lovable :

1. **Dashboard Supabase** → Authentication → URL Configuration
2. **Site URL** : `https://nettobloc.bicbloc.eu`
3. **Redirect URLs** : ajouter `https://nettobloc.bicbloc.eu/**`

Cette configuration détermine la base URL utilisée dans les emails de Supabase Auth.

---

## Résultat attendu

1. L'utilisateur clique sur "Mot de passe oublié"
2. Il reçoit un email de `support@bicbloc.eu` avec un lien vers `nettobloc.bicbloc.eu`
3. Le lien l'amène à une page avec :
   - Champ "Nouveau mot de passe"
   - Champ "Confirmer le nouveau mot de passe"  
   - Bouton "Valider"
4. Après validation, le mot de passe est changé et l'utilisateur peut se connecter
