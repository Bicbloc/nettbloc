# Facturation Petit-déjeuner

Objectif : permettre à la femme de chambre / cafetière de déclarer en un minimum de clics les petits-déjeuners consommés par chambre, éviter la double facturation des chambres déjà « inclus », et laisser l'admin configurer prix et type. L'envoi automatique vers le PMS sera branché dans une 2ᵉ étape (choix « Nettobloc d'abord »).

## 1. Base de données (migration)

**Nouvelle table `hotel_breakfast_configs`** (1 ligne par hôtel) :
- `hotel_id`, `is_active` (bool), `pricing_source` ('manual' | 'pms'), `price_per_person` (numeric), `currency` (text, défaut EUR)
- `breakfast_types` (jsonb : liste de `{ name, price }`, ex. Continental, Buffet)
- `default_included` (bool : nouvelles chambres considérées incluses par défaut)
- timestamps + trigger updated_at

**Nouvelle table `breakfast_logs`** (une déclaration par chambre / jour) :
- `hotel_id`, `room_number`, `log_date` (date)
- `people_count` (int), `breakfast_type` (text), `unit_price`, `total_amount`
- `included` (bool : marqué comme déjà inclus → 0 facturé)
- `source` ('manual' | 'pms'), `logged_by` (text), `pms_status` ('pending'|'sent'|'not_required')
- contrainte unique `(hotel_id, room_number, log_date)` → un toggle/édition par chambre par jour
- timestamps

**Colonne sur `rooms`** : `breakfast_included` (bool, défaut false) — alimenté manuellement et/ou depuis le PMS, sert à pré-cocher « inclus » dans l'interface.

GRANT + RLS sur les deux nouvelles tables (cohérent avec le modèle `auth.email()` / accès hôtel existant).

## 2. Configuration Admin (établissement)

Nouvel onglet **« Petit-déjeuner »** dans la sidebar (section *Opérations*) :
- Activer/désactiver la facturation petit-déjeuner
- Source du prix : **Configuré par le client** (saisie manuelle) ou **Récupéré du PMS** (choix par hôtel)
- Si manuel : prix par personne + gestion des types (nom + prix)
- Option « chambres incluses par défaut »
- Service `breakfastConfigService.ts` (pattern load/save de `reportConfigService.ts`)

## 3. Interface de saisie (femme de chambre / cafetière) — ultra simple

Nouvelle page `/breakfast/work` + intégration dans la vue femme de chambre :
- Grille de **toutes les chambres de l'hôtel** (pas seulement les assignées)
- Une chambre = une carte. Chambre « inclus » → badge vert « Inclus », pas de facturation.
- Clic sur une chambre → mini-feuille : **− / nombre / +** pour le nb de personnes, choix du type si plusieurs, et un bouton **Inclus** (bascule sans facturer). Validation auto à la fermeture. Aucun bouton superflu.
- Carte affiche le nb déclaré + montant. Re-clic pour modifier.
- Temps réel : les déclarations se synchronisent (Supabase Realtime) comme les chambres.

```text
┌───────── Chambre 204 ─────────┐
│   Petit-déjeuner               │
│     −     2 pers.     +        │
│   Type: [Continental ▾]        │
│   [ Inclus dans le séjour ]    │
│   Total: 18,00 €               │
└────────────────────────────────┘
```

## 4. PMS (préparé, phase 2)

- `breakfast_logs.pms_status` reste `pending`.
- Réutilisation du modèle existant (`hotel_pms_configs` + file `pms_sync_queue` + edge function) lors de la phase 2 pour pousser les charges et, à l'inverse, lire le statut « inclus » depuis le PMS.
- Aucun appel PMS réel dans cette première étape.

## Détails techniques
- i18n : nouvelles clés (`breakfast`, `breakfastBilling`, `peoplePerRoom`, `includedInStay`, etc.), pas de français en dur.
- Réutilise `getHotelId()` côté housekeeper et `useHotel()` côté admin.
- Lazy route ajoutée dans `App.tsx` ; nouvel onglet dans `AppSidebar.tsx` + rendu dans `Index.tsx`.
- Couleur d'identité violette pour la vue femme de chambre.
