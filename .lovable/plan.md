

# Plan d'Optimisation : Scanner Linge Ultra-Performant

## Analyse du Système Actuel

Le système actuel effectue les opérations suivantes en boucle :
1. Capture frame vidéo → compression JPEG (50%)
2. Appel API Edge Function (~1.5s par détection)
3. Traitement IA Gemini (variable selon le modèle)
4. Analyse de stabilité (3 frames = ~4.5 secondes)

**Problèmes identifiés :**
- Latence API trop élevée entre chaque détection (~1.5s)
- Compression image à 50% réduit les détails
- Modèle `gemini-2.5-flash-lite` en mode détection peut manquer de précision
- 3 frames stables = 4.5s d'attente minimum
- Pas de pré-traitement d'image côté client

## Optimisations Proposées

### 1. Architecture Bi-Phase (Détection Rapide + Validation Précise)

```text
┌─────────────────────────────────────────────────────────────────┐
│                    NOUVELLE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 1: DÉTECTION RAPIDE (Local + IA Lite)                    │
│  ┌─────────────────┐      ┌─────────────────┐                   │
│  │ Pré-traitement  │─────▶│ Gemini Flash    │                   │
│  │ Client (WebGL)  │      │ Lite (300ms)    │                   │
│  └─────────────────┘      └─────────────────┘                   │
│         │                         │                             │
│         ▼                         ▼                             │
│  • Détection bords          • Présence pile?                    │
│  • Estimation taille        • Estimation count                  │
│  • Qualité image            • Type probable                     │
│                                                                 │
│  PHASE 2: VALIDATION PRÉCISE (IA Pro)                           │
│  ┌─────────────────┐      ┌─────────────────┐                   │
│  │ Capture HD      │─────▶│ Gemini Pro      │                   │
│  │ (85% quality)   │      │ (précis)        │                   │
│  └─────────────────┘      └─────────────────┘                   │
│                                   │                             │
│                                   ▼                             │
│                           Résultat final                        │
│                           Confiance 95%+                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Optimisations Techniques Détaillées

| Optimisation | Avant | Après | Impact |
|--------------|-------|-------|--------|
| Intervalle détection | 1.5s | 0.8s | -47% latence |
| Frames stables requis | 3 | 2 | -33% temps stabilisation |
| Compression capture | 50% | 70% live / 90% final | +qualité |
| Modèle détection | flash-lite | flash-lite optimisé | idem |
| Modèle validation | flash | flash (pro si règle) | +précision |
| Pré-traitement client | Non | Oui (Canvas API) | +qualité image |

### 3. Améliorations Edge Function

**Nouvelle logique de sélection de modèle :**
- `quickDetect` mode : `gemini-2.5-flash-lite` avec prompt minimaliste
- Validation standard : `gemini-2.5-flash` avec prompt complet
- Mode règle : `gemini-2.5-pro` pour calcul précis

**Réduction des tokens :**
- Live detection prompt : 50 tokens max
- Validation prompt : 300 tokens max (vs 500 actuellement)

### 4. Pré-traitement Image Côté Client

Avant envoi à l'API :
1. **Contraste automatique** : Améliore la distinction des couches
2. **Détection de bords** : Estime le contour de la pile
3. **Correction luminosité** : Compense les conditions d'éclairage
4. **Recadrage intelligent** : Focus sur la zone d'intérêt

### 5. Mode "Snap Instant"

Pour les utilisateurs pressés :
- 1 seule détection rapide (pas de stabilisation)
- Validation manuelle du résultat
- Option "+1/-1" pour correction rapide

## Fichiers à Modifier

| Fichier | Modifications |
|---------|---------------|
| `supabase/functions/count-linen/index.ts` | Nouveau mode `quickDetect`, prompts optimisés, timeouts réduits |
| `src/components/linen/LinenCameraScanner.tsx` | Intervalle 800ms, 2 frames stables, pré-traitement canvas |
| `src/components/linen/LinenDetectionOverlay.tsx` | Affichage temps restant, indicateur qualité image |
| `src/utils/imageProcessing.ts` (nouveau) | Fonctions pré-traitement (contraste, luminosité, crop) |

## Paramètres de Stabilisation Optimisés

```text
AVANT:
- Intervalle détection: 1500ms
- Frames stables: 3
- Temps total minimum: 4.5 secondes

APRÈS:
- Intervalle détection: 800ms
- Frames stables: 2
- Tolérance confiance: 0.12 (vs 0.15)
- Temps total minimum: 1.6 secondes
```

## Prompts IA Optimisés

**Prompt Détection Rapide (quickDetect) - 30 tokens :**
```
Pile de linge visible? JSON: {"pile":bool,"count":N,"confidence":0-1}
```

**Prompt Validation - 150 tokens :**
Focus sur le comptage précis des strates avec les règles d'or existantes mais format condensé.

## Indicateurs de Qualité Image (Nouveau)

Le système évaluera en temps réel :
- **Netteté** : Détection flou de bougé
- **Luminosité** : Trop sombre / surexposé
- **Cadrage** : Pile centrée dans le cadre

Affichage de conseils contextuels :
- "🔆 Ajoutez de la lumière"
- "📷 Rapprochez-vous"
- "✋ Stabilisez le téléphone"

## Résumé des Gains Attendus

| Métrique | Actuel | Objectif |
|----------|--------|----------|
| Temps stabilisation | 4.5s | 1.6s |
| Temps total (scan → résultat) | 6-8s | 2-3s |
| Précision comptage | ~85% | 95%+ |
| Consommation API | 100% | 70% |

## Implémentation par Priorité

1. **Haute** : Réduire intervalle détection + frames stables
2. **Haute** : Optimiser prompts Edge Function
3. **Moyenne** : Pré-traitement image client
4. **Moyenne** : Indicateurs qualité image
5. **Basse** : Mode "Snap Instant"

