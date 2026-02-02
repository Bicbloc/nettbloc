
# Plan: Supprimer le système d'invitations et ajouter un bouton Technicien sur la page Auth

## Résumé

Ce plan supprime le système d'invitations inutilisé (StaffInvitationsTab + Edge Function) et ajoute un bouton d'accès Technicien sur la page d'authentification principale.

## Changements à effectuer

### 1. Supprimer les fichiers du système d'invitations

**Fichiers à supprimer:**
- `src/components/dashboard/StaffInvitationsTab.tsx` - Composant d'interface des invitations
- `supabase/functions/send-staff-invitation/` - Edge Function d'envoi d'emails

### 2. Modifier la page Auth.tsx

Ajouter un nouveau bouton dans l'écran de sélection (mode `'select'`) pour les techniciens:

```text
┌────────────────────────────────┐
│  🏢 Établissement              │  → /auth/establishment
│     Gérant, responsable        │
├────────────────────────────────┤
│  👥 Équipe                     │  → /housekeeper/auth
│     Femme/valet de chambre     │
├────────────────────────────────┤
│  👑 Gouvernante                │  → /governess/auth
│     Inspection & incidents     │
├────────────────────────────────┤
│  🔧 Technicien       (NOUVEAU) │  → /technician/login
│     Maintenance & incidents    │
└────────────────────────────────┘
```

### 3. Nettoyer Index.tsx

- Supprimer l'import de `StaffInvitationsTab`
- Supprimer le bloc de rendu conditionnel pour `activeTab === 'invitations'`

### 4. Base de données

La table `staff_invitations` restera en place pour l'instant (elle ne contient probablement pas de données critiques). Une migration pourra être effectuée ultérieurement pour la supprimer si souhaité.

---

## Détails techniques

### Fichier: `src/pages/Auth.tsx`

Ajouter dans la section des boutons (après le bouton Gouvernante, ligne ~290):

```tsx
<button
  type="button"
  onClick={() => navigate('/technician/login')}
  className="w-full p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        <Wrench className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium">{language === 'en' ? 'Technician' : 'Technicien'}</p>
        <p className="text-xs text-muted-foreground">
          {language === 'en' ? 'Maintenance & incidents' : 'Maintenance & incidents'}
        </p>
      </div>
    </div>
    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
  </div>
</button>
```

### Fichier: `src/pages/Index.tsx`

- Supprimer la ligne 52: `import { StaffInvitationsTab } from "@/components/dashboard/StaffInvitationsTab";`
- Supprimer les lignes 767-776 (bloc invitations)

### Edge Function à supprimer

Le dossier `supabase/functions/send-staff-invitation/` sera supprimé et la fonction déployée sera aussi supprimée de Supabase.

---

## Récapitulatif des actions

| Action | Fichier/Dossier |
|--------|-----------------|
| Supprimer | `src/components/dashboard/StaffInvitationsTab.tsx` |
| Supprimer | `supabase/functions/send-staff-invitation/` |
| Modifier | `src/pages/Auth.tsx` (ajouter bouton Technicien) |
| Modifier | `src/pages/Index.tsx` (supprimer import et bloc invitations) |

