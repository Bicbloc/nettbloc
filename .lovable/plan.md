

# Supprimer l'affichage des codes d'acces dans la liste des femmes de chambre

## Probleme
Les codes d'acces (ex: HTL904-SAL-6645) sont affiches a cote de chaque nom de femme de chambre dans le panneau "Femmes de chambre" de la vue d'ensemble. L'utilisateur ne veut plus les voir.

## Modifications

### `src/components/ActiveUsersPanel.tsx`
- **Ligne 230-232** : Supprimer le `Badge` qui affiche `{connection.accessCode}`

### `src/components/HousekeeperStatusDashboard.tsx`
- **Lignes 271-273** : Supprimer l'affichage conditionnel du code d'acces (`Code: {housekeeper.access_code}`)

### `src/components/HousekeeperTeamManager.tsx`
- **Lignes 236-237** : Supprimer la ligne `Code: {housekeeper.access_code}`

Ces trois composants sont les seuls endroits ou les codes apparaissent dans des listes de personnel. Les codes restent en base de donnees et dans les pages dediees de gestion des codes d'acces.

