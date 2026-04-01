
## Fonctionnalité : Commande de téléphones dédiés (200€/unité)

### 1. Base de données
- Créer une table `phone_orders` avec : hotel_id, nombre de femmes de chambre, nombre de téléphones commandés, prix total, statut de suivi (5 statuts), numéro de tracking, adresse de livraison, dates

### 2. Image produit
- Générer une image de smartphone avec coque rigide professionnelle

### 3. Page Plan/Abonnement — Section téléphones
- Ajouter une section dans la page de sélection de plan
- Champ : nombre de femmes de chambre actives par jour
- Calcul automatique : nb téléphones = nb femmes de chambre + 1 (urgence)
- Affichage du prix total (nb × 200€)
- Bouton commander (enregistre en base, facturé sur abonnement)
- Affichage visuel du téléphone avec coque

### 4. Suivi client
- Section "Mes commandes" visible côté client
- 5 statuts : En attente de paiement → Confirmé → En préparation → Expédié → Livré

### 5. Admin — Gestion des commandes
- Nouvelle section dans le panel admin pour voir toutes les commandes
- Possibilité de changer le statut de suivi
- Vue d'ensemble des commandes par hôtel
