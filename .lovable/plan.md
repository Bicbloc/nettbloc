

## Analyse des flux d'inscription par type d'utilisateur

### Problemes identifies

**1. Technician Signup: pas de validation d'email cross-role**
- `TechnicianSignup.tsx` utilise `useTechnicianAuth().signUp()` qui appelle directement `supabase.auth.signUp` SANS appeler `validateEmailForUserType()`.
- Consequence: un email deja utilise comme etablissement/gouvernante/femme de chambre peut etre reutilise pour un compte technicien, creant un conflit.

**2. Technician Signup: pas de creation de profil explicite**
- Le code commente dit "profile is created automatically via database trigger (handle_technician_signup)" mais il faut verifier que ce trigger existe et fonctionne. Si le trigger ne cree pas le profil, le technicien se connectera mais `loadTechnicianProfile` ne trouvera rien.

**3. Governess Signup: creation profil sans lier l'ID auth**
- Dans `GovernessAuth.tsx` ligne 255-261, le profil est insere avec `email` et `name` mais SANS `id: authData.user.id`. Cela signifie que le profil governess n'est pas lie a l'utilisateur auth, ce qui peut causer des problemes de correspondance.

**4. HousekeeperAuthContext depend de AuthContext**
- `HousekeeperAuthContext.tsx` ligne 67: `const { user, session, loading: authLoading } = useAuth();`
- Cela signifie que `HousekeeperAuthProvider` DOIT etre imbrique dans `AuthProvider`. C'est le cas dans `App.tsx` (ligne 69 est dans ligne 67), donc pas de probleme structurel ici.

**5. Technician Signup: pas de validation email dans le contexte**
- `TechnicianAuthContext.tsx` signUp (ligne 171-193) ne valide pas l'email avec `validateEmailForUserType` avant l'inscription.

**6. Conflit potentiel: Auth.tsx contient aussi un flow housekeeper signup**
- `Auth.tsx` a un mode `housekeeper-signup` (ligne 159-170) qui utilise `housekeeperSignUp` de `HousekeeperAuthContext`, en parallele de `HousekeeperSignup.tsx` qui fait sa propre inscription. Deux chemins differents pour la meme action.

### Plan de corrections

#### A. Ajouter la validation cross-role au signup Technician
- Fichier: `src/contexts/TechnicianAuthContext.tsx`
- Dans la methode `signUp` (ligne 171), ajouter un appel a `validateEmailForUserType(email, 'technician')` AVANT `supabase.auth.signUp`.
- Si la validation echoue, retourner l'erreur.

#### B. Corriger la creation du profil Governess
- Fichier: `src/pages/GovernessAuth.tsx`
- Ligne 255-261: Ajouter `id: data.user?.id` lors de l'insertion dans `governess_profiles` pour lier le profil a l'utilisateur auth (comme c'est fait pour housekeeper dans `HousekeeperSignup.tsx` ligne 96).

#### C. Verifier/ajouter la validation cross-role dans HousekeeperAuthContext.signUp
- Fichier: `src/contexts/HousekeeperAuthContext.tsx`
- Verifier que le `signUp` de ce contexte (utilise par `Auth.tsx` mode housekeeper-signup) inclut bien `validateEmailForUserType`.

#### D. Ajouter la validation cross-role dans Auth.tsx flow hotel-signup
- Le flow `hotel-signup` dans `Auth.tsx` (ligne 129-151) utilise `signUp` de `AuthContext` qui ne fait PAS de validation cross-role. Il faut ajouter `validateEmailForUserType(email, 'establishment')` avant l'appel.

### Details techniques

Fichiers a modifier:
1. `src/contexts/TechnicianAuthContext.tsx` - Ajouter import + appel `validateEmailForUserType`
2. `src/pages/GovernessAuth.tsx` - Ajouter `id: data.user?.id` a l'insert governess_profiles
3. `src/pages/Auth.tsx` - Ajouter validation cross-role pour les modes hotel-signup et housekeeper-signup
4. Verifier `src/contexts/HousekeeperAuthContext.tsx` signUp pour la validation

Aucune modification de base de donnees requise.

