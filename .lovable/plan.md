# Améliorer l'onglet « Paramètres » du compte (Notifications & Préférences)

Refonte de l'onglet `settings` dans `src/pages/Profile.tsx`. Aujourd'hui il n'y a que deux cartes quasi vides (un `NotificationBell` et un texte « accessibles depuis le tableau de bord »). On le remplace par de vrais réglages, en réutilisant les briques existantes.

## 1. Carte « Notifications »
Basée sur le hook existant `useUserPreferences` (persisté par utilisateur).
- Interrupteur **Activer les notifications** (in-app / push) → `notifications.push`
- Interrupteur **Notifications par e-mail** → `notifications.email`
- Interrupteur **Son des notifications** → `notifications.sound`
- Champ **Adresse e-mail de réception des notifications** (nouveau champ `notifications.email_address` ajouté au hook) avec validation du format.

## 2. Carte « Types d'e-mails »
Sélection des catégories d'e-mails à recevoir, stockées dans `useUserPreferences` (nouvel objet `emails`) avec interrupteurs :
- Récapitulatif de clôture
- Rapports quotidiens
- Incidents
- Demandes d'accès du personnel
Désactivés/grisés si « Notifications par e-mail » est coupé.

## 3. Carte « Clôture & archives »
Réutiliser le composant **`AutoCloseSettingsDialog`** (déjà fonctionnel, écrit dans la table `hotels`) via un bouton « Configurer la clôture automatique », en lui passant `hotelId` depuis `useHotel()`. Cette carte regroupe :
- activation de la clôture automatique, heure et jours,
- **adresse e-mail de réception des archives** (`auto_close_recap_email`).
Un court texte explique que le récapitulatif d'archivage est envoyé à cette adresse à chaque clôture.

## 4. Carte « Préférences générales »
Réglages issus de `useUserPreferences`, déjà appliqués dans l'app :
- Rafraîchissement automatique (on/off) + intervalle
- Disposition (grille / liste)
- Taille de police, animations, contraste élevé

## 5. Carte « Déconnexion »
Conservée telle quelle en bas.

## Détails techniques
- Étendre l'interface `UserPreferences` et `defaultPreferences` dans `src/hooks/use-user-preferences.ts` : ajouter `notifications.email_address: string` et un bloc `emails: { closureRecap, dailyReports, incidents, accessRequests: boolean }`.
- Les interrupteurs utilisent le composant `Switch` et `updatePreference(section, updates)` (sauvegarde immédiate + toast).
- La clôture/archives reste pilotée par `AutoCloseSettingsDialog` (source de vérité backend), aucune duplication de logique.
- Design cohérent avec les `Card` existantes, icônes lucide, espacement `space-y-6`.

## Hors périmètre
Les types d'e-mails et l'adresse de notification sont des préférences stockées côté utilisateur ; l'application effective lors de l'envoi des e-mails côté serveur n'est pas modifiée dans cette tâche. La clôture et l'e-mail d'archives, eux, sont pleinement fonctionnels (déjà branchés au backend).
