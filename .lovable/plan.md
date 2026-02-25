

## Plan: Corrections d'inscription et refonte UX des pages d'authentification

### Etat actuel des corrections d'inscription

Les corrections techniques suivantes sont deja en place :
- Validation cross-role dans TechnicianAuthContext.tsx (deja appliquee)
- Validation cross-role dans HousekeeperAuthContext.tsx (deja appliquee)
- Validation cross-role dans Auth.tsx pour hotel-signup et housekeeper-signup (deja appliquee)
- ID auth lie au profil governess dans GovernessAuth.tsx (deja appliquee)

Aucune correction d'inscription supplementaire n'est necessaire.

### Refonte UX des pages d'authentification

#### Problemes identifies

1. **HousekeeperSignup.tsx** : Design basique (fond violet uni, card simple sans glassmorphism, pas de decorations). Manque les elements visuels presents sur les autres pages (blur effects, backdrop-blur, shadow-2xl, border-0).

2. **Auth.tsx (page de selection)** : Design minimaliste mais correct. Pourrait etre ameliore avec des couleurs de role plus marquees et un meilleur feedback visuel sur mobile.

3. **Incoherence de responsive** : Certaines pages utilisent `max-w-md`, d'autres `max-w-sm`. Les tailles d'input varient entre `h-11` et `h-12`.

#### Fichiers a modifier

**1. `src/pages/HousekeeperSignup.tsx`** - Refonte complete du design
- Ajouter le fond gradient violet/purple/indigo coherent avec HousekeeperAuth
- Ajouter les elements decoratifs (blur circles)
- Appliquer le glassmorphism sur la card (bg-white/95 backdrop-blur-sm shadow-2xl border-0)
- Header externe avec icone dans un cercle glassmorphique
- Inputs h-12 avec bg-muted/50
- Bouton gradient from-violet-600 to-purple-600
- Texte d'aide pour le mot de passe
- Responsiveness: padding adaptatif, tailles de texte adaptees

**2. `src/pages/TechnicianSignup.tsx`** - Ajustements mineurs
- Ajouter un header externe au-dessus de la card (comme Governess et Housekeeper)
- Harmoniser la structure avec icone + titre + sous-titre en blanc au-dessus de la card
- Ajouter des icones aux labels (Mail, Lock, User, Phone)

**3. `src/pages/TechnicianLogin.tsx`** - Ajustements mineurs
- Ajouter un header externe au-dessus de la card (comme les autres pages)
- Harmoniser avec la meme structure

**4. `src/pages/Auth.tsx` (page de selection)** - Ameliorations mobile
- Ajouter des badges de couleur plus forts sur chaque option de role
- Ameliorer le spacing et padding pour smartphone
- Ajouter une animation subtile d'entree

**5. `src/pages/EstablishmentAuth.tsx`** - Ajustements mineurs
- Harmoniser les tailles d'input (h-12 partout)
- Ajouter des icones Mail et Lock aux labels

### Details techniques

Conventions de design par role :
```text
Etablissement : emerald/teal/cyan
Femme de chambre : violet/purple/indigo  
Gouvernante : amber/orange/red
Technicien : blue/indigo/slate
```

Pattern commun a appliquer :
```text
1. Fond: bg-gradient-to-br from-{color1} via-{color2} to-{color3}
2. Decorations: 3 cercles blur (top-right, bottom-left, center)
3. Header externe: icone dans cercle glassmorphique + titre blanc + sous-titre blanc/80
4. Card: bg-white/95 backdrop-blur-sm shadow-2xl border-0
5. Inputs: h-12 text-base
6. Bouton: gradient matching, h-12, shadow-lg
7. Back button: top-left, bg-white/20 ou bg-white/90
```

Aucune modification de base de donnees requise.

