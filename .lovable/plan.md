

# Plan : Amélioration Interface Admin Inventaire Linge

## Objectif

Refondre l'interface "Saisie & Validation" pour :
1. **Afficher les images** prises lors du scan pour chaque type de linge
2. **Organiser par date** avec une vue calendrier/liste de dates
3. **Vue détaillée par date** : cliquer sur une date affiche tous les inventaires du jour
4. **Télécharger un rapport PDF** de la journée complète

## Analyse Technique

### Données Existantes
- Table `linen_inventory_entries` contient déjà `photo_url` 
- Bucket `linen-images` est configuré et public
- Les images sont déjà uploadées lors du scan mais non affichées

### Architecture Actuelle
L'interface liste simplement toutes les tâches sans regroupement par date.

## Nouvelle Architecture UI

```text
┌─────────────────────────────────────────────────────────────────┐
│  NIVEAU 1: LISTE DES DATES                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📅 Lundi 3 Février 2026                                 │    │
│  │ • 3 tâches | 156 pièces comptées | ✅ Validé            │    │
│  │                                   [Voir] [📥 Rapport]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📅 Dimanche 2 Février 2026                              │    │
│  │ • 2 tâches | 98 pièces comptées | ⏳ En attente         │    │
│  │                                   [Voir] [📥 Rapport]   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  NIVEAU 2: DÉTAIL D'UNE JOURNÉE (Clic sur "Voir")               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📅 Lundi 3 Février 2026                   [📥 Télécharger PDF] │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🧻 Serviettes de bain                                   │    │
│  │ ┌──────────┐                                            │    │
│  │ │  [IMAGE] │  Propre: 45 | Sale: 12 | Abîmé: 2          │    │
│  │ │          │  Confiance IA: 94%                         │    │
│  │ └──────────┘  Par: Marie • 10:32                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🛏️ Draps                                                │    │
│  │ ┌──────────┐                                            │    │
│  │ │  [IMAGE] │  Propre: 23 | Sale: 5 | Abîmé: 1           │    │
│  │ │          │  Confiance IA: 87%                         │    │
│  │ └──────────┘  Par: Sophie • 11:15                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Modifications à Effectuer

### 1. Refonte `AdminLinenInventory.tsx`

| Section | Modification |
|---------|-------------|
| Structure principale | Ajouter un état `selectedDate` pour la navigation par date |
| Liste des tâches | Regrouper par `task_date` au lieu de lister individuellement |
| Vue date | Nouvelle vue en tableau avec images et détails |
| Dialogue détail | Afficher les photos pour chaque type de linge |

**Composants UI à ajouter :**
- `DateGroupCard` : Carte résumant une journée d'inventaire
- `DailyInventoryTable` : Tableau détaillé avec images par type de linge
- `LinenEntryWithImage` : Ligne du tableau avec miniature cliquable

### 2. Nouveau Composant : `LinenDailyReportDownload.tsx`

Génération d'un rapport PDF pour une journée :
- En-tête avec date et nom de l'hôtel
- Tableau récapitulatif par type de linge
- Images miniatures intégrées
- Totaux et statistiques

### 3. Amélioration Affichage Images

Dans le dialogue de détail :
- Afficher la miniature de l'image (si `photo_url` existe)
- Clic sur l'image = modal plein écran
- Badge de confiance IA coloré
- Horodatage de la capture

## Structure des Données

Regroupement des tâches par date :

```typescript
interface DailyInventorySummary {
  date: string;                    // YYYY-MM-DD
  tasks: Task[];                   // Toutes les tâches du jour
  totalPieces: number;             // Total de pièces comptées
  entriesWithPhotos: number;       // Nombre d'entrées avec photos
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'validated';
}
```

## Fichiers à Modifier/Créer

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/components/linen/AdminLinenInventory.tsx` | Modifier | Refonte complète avec vue par dates |
| `src/components/linen/LinenDailyReport.tsx` | Créer | Composant rapport journalier avec images |
| `src/components/linen/LinenImageViewer.tsx` | Créer | Modal pour visualiser les images en plein écran |

## Détails d'Implémentation

### Regroupement par Date

```typescript
// Regrouper les tâches par date
const tasksByDate = useMemo(() => {
  const grouped: Record<string, Task[]> = {};
  tasks.forEach(task => {
    const date = task.task_date;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(task);
  });
  // Trier par date décroissante
  return Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, tasks]) => ({
      date,
      tasks,
      totalPieces: tasks.reduce((sum, t) => sum + getTotalForTask(t), 0),
      entriesWithPhotos: tasks.flatMap(t => t.linen_inventory_entries || [])
        .filter(e => e.photo_url).length
    }));
}, [tasks]);
```

### Affichage Image avec Fallback

```tsx
{entry.photo_url ? (
  <img 
    src={entry.photo_url} 
    alt={linenType.name}
    className="w-16 h-16 object-cover rounded cursor-pointer"
    onClick={() => openImageViewer(entry.photo_url)}
  />
) : (
  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
    <Camera className="h-6 w-6 text-muted-foreground" />
  </div>
)}
```

### Génération Rapport PDF

Utilisation de `html2pdf.js` (déjà installé) pour générer un rapport :
- Date et nom de l'hôtel en en-tête
- Tableau avec colonnes : Type, Image, Propre, Sale, Abîmé, Total, Opérateur, Heure
- Signature/footer avec horodatage de génération

## Résumé des Gains UX

| Avant | Après |
|-------|-------|
| Liste plate de toutes les tâches | Vue organisée par dates |
| Pas de visualisation d'images | Images miniatures + vue plein écran |
| Pas de rapport téléchargeable | Bouton "Télécharger PDF" par jour |
| Navigation confuse | Clic sur date → détail du jour |

## Étapes d'Implémentation

1. **Refonte AdminLinenInventory.tsx** : Ajouter regroupement par date et navigation
2. **Créer LinenImageViewer.tsx** : Modal pour visualiser images plein écran
3. **Créer LinenDailyReport.tsx** : Génération et téléchargement du rapport PDF
4. **Mise à jour des requêtes** : S'assurer que `photo_url` est bien récupéré dans les requêtes

