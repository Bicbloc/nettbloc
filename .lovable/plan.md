
# Plan : Système de Scan Linge Ultra-Précis (98-100%)

## Objectif
Améliorer la reconnaissance des piles de linge (serviettes, draps, etc.) pour atteindre une précision proche de 100%, en combinant IA avancée et indicateurs physiques optionnels.

---

## Phase 1 : Amélioration du Scan Vidéo Temps Réel

### 1.1 Optimisation du Mode Live
- Augmenter la fréquence d'analyse à 2 frames/seconde (actuellement ~1/sec)
- Utiliser un modèle plus puissant pour la capture finale (`gemini-2.5-pro` au lieu de `flash-lite`)
- Implémenter un **buffer de stabilisation** : moyenner les 3 dernières détections pour lisser les variations

### 1.2 Analyse Multi-Frame
- Capturer automatiquement plusieurs angles pendant le scan
- Demander à l'utilisateur de "tourner légèrement" autour de la pile
- Fusionner les comptages de différents angles pour réduire l'erreur

---

## Phase 2 : Indicateur Physique Imprimable (Règle Étalon)

### 2.1 Création d'une Règle Étalon
- Générer un PDF imprimable avec :
  - Règle graduée (0-30 cm) avec couleurs distinctes
  - Épaisseurs de référence par type de linge (1.5cm pour draps, 3cm pour serviettes)
  - QR code contenant l'ID de l'hôtel (pour calibration automatique)

### 2.2 Détection Automatique de la Règle
- L'IA détecte la règle colorée dans l'image
- Calcule l'échelle réelle (pixels → cm)
- Mesure la hauteur de la pile et divise par l'épaisseur connue

### 2.3 Mode "Calibration Précise"
- Bouton "📏 Mode Précision" dans l'interface
- Demande de placer la règle à côté de la pile
- Affiche des instructions visuelles (overlay avec zone de placement)

---

## Phase 3 : Amélioration du Système d'Apprentissage

### 3.1 Épaisseurs par Type de Linge
- Nouvelle colonne `average_thickness_cm` dans la table `linen_types`
- Permet à l'admin de configurer l'épaisseur moyenne de chaque type
- L'IA utilise cette donnée pour calculer : `count = height_cm / thickness_cm`

### 3.2 Corrections Contextuelles
- Stocker non seulement le compte corrigé, mais aussi :
  - La méthode (pile/étalé/vrac)
  - Les conditions (éclairage, angle)
  - La photo originale pour réentraînement futur
- Utiliser un score de confiance adaptatif basé sur l'historique de corrections

### 3.3 Alertes Proactives
- Si l'IA détecte une pile dense avec confiance < 70%, suggérer automatiquement :
  - "Utilisez la règle étalon pour plus de précision"
  - "Essayez de photographier le côté de la pile"

---

## Phase 4 : Interface Utilisateur Améliorée

### 4.1 Overlay de Guidage
- Afficher une zone cible sur la caméra (rectangle où placer la pile)
- Indicateur de qualité d'image (flou, éclairage, distance)
- Conseils en temps réel : "Rapprochez-vous", "Évitez les ombres"

### 4.2 Mode Multi-Scan
- Bouton "Scanner tout" : capturer automatiquement 3 photos sous différents angles
- Animation pour guider l'utilisateur à tourner autour de la pile
- Fusion des résultats avec affichage du meilleur comptage

### 4.3 Confirmation Rapide
- Après le scan, afficher le comptage avec boutons +/- directement visibles
- Si correction = 0 (comptage exact), renforcer le modèle
- Si correction > 2, marquer comme "échantillon prioritaire" pour analyse

---

## Architecture Technique

### Modifications Base de Données
```text
Table: linen_types
  + average_thickness_cm DECIMAL(3,1) -- Épaisseur moyenne en cm

Table: linen_training_samples
  + scan_method TEXT -- 'pile', 'spread', 'ruler'
  + lighting_conditions TEXT -- 'good', 'dim', 'bright'
  + ruler_detected BOOLEAN
```

### Edge Function count-linen (Améliorations)
- Nouveau paramètre `useRuler: boolean`
- Prompt spécifique quand la règle est détectée
- Calcul mathématique : `count = measured_height / type_thickness`
- Retourner `measurement_method: 'ai' | 'ruler_calculation'`

### Fichiers à Modifier/Créer
1. `supabase/functions/count-linen/index.ts` - Logique de détection de règle
2. `src/components/linen/LinenCameraScanner.tsx` - Mode précision avec règle
3. `src/components/linen/RulerGuide.tsx` - Nouveau composant overlay
4. `src/components/linen/PrintableRuler.tsx` - Génération PDF de la règle
5. `src/components/linen/LinenTypeManager.tsx` - Ajout épaisseur configurable

---

## Résumé des Améliorations

| Fonctionnalité | Impact Précision | Complexité |
|----------------|------------------|------------|
| Mode multi-frame (3 angles) | +10% | Moyenne |
| Règle étalon physique | +20-25% | Moyenne |
| Épaisseur par type | +15% | Faible |
| Buffer de stabilisation | +5% | Faible |
| Overlay de guidage | +5% | Faible |

**Résultat attendu** : Précision de 98-100% avec la règle étalon, 90-95% sans.

---

## Recommandation

Je recommande de commencer par les améliorations les plus rapides à implémenter :
1. **Ajouter l'épaisseur configurable par type de linge** (5 min)
2. **Améliorer le prompt IA avec calcul mathématique** (10 min)
3. **Créer la règle imprimable** (15 min)
4. **Implémenter la détection de règle** (20 min)

Cela permettra d'atteindre 95-100% de précision avec un effort modéré.
