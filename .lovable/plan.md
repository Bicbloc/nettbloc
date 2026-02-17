

# Integration API PMS - Plan d'implementation

## Situation actuelle

Le systeme dispose deja d'une architecture d'adapters PMS solide pour le **parsing de rapports PDF** (Mews, Apaleo, Opera, Protel, Medialog, Fidelio). Cependant, l'acces API direct aux PMS n'est pas encore implemente -- la methode `fetchRoomsFromApi()` existe dans le code mais aucun adapter ne l'implemente.

## Comment ca va marcher

Chaque PMS a sa propre API avec son propre systeme d'authentification. Voici le fonctionnement prevu :

```text
+-------------------+       +-------------------+       +------------------+
|  Frontend         |       |  Edge Function    |       |  API PMS         |
|  (Dashboard)      | ----> |  pms-sync         | ----> |  (Mews, Apaleo,  |
|                   |       |  (Supabase)       |       |   Opera, etc.)   |
+-------------------+       +-------------------+       +------------------+
        |                          |
        |                          v
        |                   +------------------+
        +-----------------> |  Base de donnees |
                            |  (rooms, config) |
                            +------------------+
```

### Flux de donnees

1. L'hotel configure ses identifiants API PMS dans son profil (cle API, ID propriete, etc.)
2. Les identifiants sont stockes de facon securisee dans la base de donnees (chiffres)
3. Une **Edge Function** `pms-sync` appelle l'API du PMS avec les identifiants
4. Les donnees des chambres sont synchronisees automatiquement dans la base de donnees
5. Le dashboard affiche les donnees en temps reel

### Authentification par PMS

| PMS | Type d'auth | Ce dont l'hotel a besoin |
|-----|-------------|--------------------------|
| **Mews** | OAuth2 / API Key | Client Token + Access Token |
| **Apaleo** | OAuth2 | Client ID + Client Secret |
| **Opera Cloud** | OAuth2 + OHIP | Client ID + Secret + Property ID |
| **Mister Booking** | API Key | Cle API + ID Etablissement |
| **Protel** | API Key | URL serveur + Token |
| **Medialog** | API Key | Cle API proprietaire |

## Plan d'implementation

### Etape 1 - Table de configuration PMS API
Creer une table `hotel_pms_configs` pour stocker les identifiants API de chaque hotel :
- `hotel_id`, `pms_type`, `credentials` (JSONB chiffre), `is_active`, `sync_frequency`
- Securisee par RLS (seul le proprietaire peut voir/modifier)

### Etape 2 - Edge Function `pms-sync`
Creer une edge function qui :
- Recoit le `hotel_id` et le `pms_type`
- Recupere les identifiants depuis la base
- Appelle l'API du PMS correspondant
- Transforme les donnees au format unifie `ExtractedRoom[]`
- Met a jour la table `rooms` avec les donnees fraiches

### Etape 3 - Implementer les connecteurs API par PMS
Commencer par les 2 PMS les plus demandes :

**Mews Connector API** :
- Endpoint : `https://api.mews.com/api/connector/v1/`
- Appels : `spaces/getAll`, `reservations/getAll`
- Retourne les chambres avec statut de menage en temps reel

**Apaleo API** :
- Endpoint : `https://api.apaleo.com/`
- OAuth2 avec Client Credentials
- Appels : `inventory/v1/properties/{id}/units`, `housekeeping/v1/properties/{id}`

### Etape 4 - Interface de configuration
Ajouter dans le dashboard (onglet Parametres) :
- Un formulaire pour choisir son PMS et entrer ses identifiants API
- Un bouton "Tester la connexion" pour valider les identifiants
- Un toggle pour activer/desactiver la synchronisation automatique
- Un choix de frequence de synchro (toutes les 15min, 30min, 1h)

### Etape 5 - Synchronisation automatique
- Utiliser un **cron Supabase** (pg_cron) pour declencher la synchro periodiquement
- Ou un webhook depuis le PMS (si supporte) pour du temps reel
- Journaliser chaque synchro dans une table `pms_sync_logs`

## Details techniques

### Structure de la table `hotel_pms_configs`

```text
hotel_pms_configs
  - id (uuid, PK)
  - hotel_id (uuid, FK hotels)
  - pms_type (text) : mews, apaleo, opera, mister_booking...
  - credentials (jsonb) : identifiants chiffres
  - base_url (text) : URL API personnalisee si necessaire
  - property_id (text) : ID propriete dans le PMS
  - is_active (boolean)
  - sync_frequency (integer) : en minutes
  - last_sync_at (timestamptz)
  - last_sync_status (text) : success, error, pending
  - last_sync_error (text)
  - created_at, updated_at
```

### Extension des adapters existants

Chaque adapter PMS existant (MewsAdapter, ApaleoAdapter, etc.) sera etendu avec l'implementation concrete de `fetchRoomsFromApi()`. L'architecture actuelle supporte deja cette methode optionnelle -- il suffit de l'implementer dans chaque adapter.

### Restriction au plan Entreprise

L'acces API est reserve au plan `entreprise`. Le guard existant `FeatureGuard` sera utilise pour controler l'acces a cette fonctionnalite, avec le feature flag `apiAccess` deja defini dans `planFeatures`.

### Securite

- Les identifiants API ne transitent jamais par le frontend
- Stockage chiffre en base (pgcrypto)
- L'edge function est la seule a acceder aux identifiants
- RLS strict : seul le proprietaire de l'hotel peut configurer ses identifiants

## Ordre de priorite

1. **Phase 1** : Table + Edge Function + Mews API (le plus utilise)
2. **Phase 2** : Apaleo API + Opera Cloud API
3. **Phase 3** : Mister Booking + autres PMS
4. **Phase 4** : Synchronisation automatique (cron) + webhooks

