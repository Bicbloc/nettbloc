

## Plan: Ajouter le DailyInstructionsBanner sur les interfaces Gouvernante et Technicien

### Analyse

Le composant `DailyInstructionsBanner` existe deja et fonctionne avec un simple prop `hotelId`. Il suffit de l'importer et de le placer dans les deux dashboards.

### Modifications

#### 1. `src/pages/GovernessDashboard.tsx`

- Ajouter l'import de `DailyInstructionsBanner` depuis `@/components/housekeeper/DailyInstructionsBanner`
- Placer le composant juste apres les stats cards et avant le `StaffTasksList` (ligne ~508), conditionne par `selectedHotel`
- Code: `<DailyInstructionsBanner hotelId={selectedHotel.id} />`

#### 2. `src/pages/TechnicianDashboard.tsx`

- Ajouter l'import de `DailyInstructionsBanner`
- Placer le composant juste apres le header Card et avant le `StaffTasksList` (ligne ~126), en utilisant `currentHotelSession.hotel_id`
- Code: `<DailyInstructionsBanner hotelId={currentHotelSession.hotel_id} />`

### Impact

Aucune modification de base de donnees. Les deux interfaces afficheront les memes consignes du jour que les femmes de chambre, avec le meme systeme de dismiss quotidien via localStorage.

