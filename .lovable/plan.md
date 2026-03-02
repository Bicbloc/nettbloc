

# Correction de l'affichage des notifications

## Probleme
Le panneau de notifications s'affiche comme un overlay plein ecran (modal centree ou bottom sheet). L'utilisateur veut qu'il s'affiche comme un **dropdown/popover** qui descend directement sous le bouton de notification.

## Solution
Transformer le `ActionLogPanel` d'un overlay modal en un **Popover** positionne sous le bouton cloche, en utilisant le composant `Popover` de Radix UI deja installe.

### Modifications

**`src/components/NotificationBell.tsx`** :
- Envelopper le bouton dans un `Popover` + `PopoverTrigger`
- Remplacer `ActionLogPanel` par un `PopoverContent` contenant le contenu des notifications
- Supprimer l'etat `isActionLogOpen` (gere par Popover)

**`src/components/ActionLogPanel.tsx`** :
- Transformer en composant qui rend directement le contenu (sans overlay/modal)
- Supprimer le `fixed inset-0`, le backdrop, la Card wrapper
- Garder le ScrollArea avec une hauteur max (`max-h-[70vh]`)
- Largeur fixe adaptee (`w-[380px]` sur desktop, pleine largeur sur mobile)

Le panneau apparaitra immediatement sous le bouton cloche, aligne a droite, comme un menu deroulant classique.

