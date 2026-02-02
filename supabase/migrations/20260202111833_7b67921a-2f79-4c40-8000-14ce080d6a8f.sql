-- Table pour stocker les pages légales éditables
CREATE TABLE public.legal_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique (tout le monde peut lire les CGV)
CREATE POLICY "Public can view legal pages"
ON public.legal_pages
FOR SELECT
USING (true);

-- Politique d'écriture pour super_admin uniquement
CREATE POLICY "Super admins can update legal pages"
ON public.legal_pages
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Insérer les CGV initiales pour Bicbloc
INSERT INTO public.legal_pages (slug, title, content) VALUES 
('cgv', 'Conditions Générales de Vente', E'# Conditions Générales de Vente - BICBLOC

**Dernière mise à jour : 2 février 2026**

## Article 1 - Objet et champ d''application

Les présentes Conditions Générales de Vente (ci-après "CGV") régissent les relations contractuelles entre :

**BICBLOC**
Société par actions simplifiée (SAS)
Siège social : 15 Rue de la République, 75001 Paris, France
SIRET : 123 456 789 00012
RCS Paris B 123 456 789
Email : contact@bicbloc.fr
Téléphone : +33 1 23 45 67 89

Ci-après dénommée "BICBLOC" ou "le Prestataire"

Et toute personne physique ou morale, particulier ou professionnel, souscrivant aux services proposés sur la plateforme Nettobloc.

Ci-après dénommée "le Client"

## Article 2 - Services proposés

BICBLOC propose via sa plateforme Nettobloc les services suivants :
- Gestion des chambres d''hôtel et de leur statut de nettoyage
- Planification et suivi des tâches de ménage
- Gestion des équipes de femmes/valets de chambre
- Module de signalement d''incidents
- Gestion du linge
- Tableau de bord et rapports d''activité

## Article 3 - Modalités de souscription

### 3.1 Période d''essai
Tout nouveau Client bénéficie d''une période d''essai gratuite de trois (3) mois à compter de la création de son compte. Durant cette période, l''ensemble des fonctionnalités sont accessibles sans restriction.

### 3.2 Abonnements
À l''issue de la période d''essai, le Client peut souscrire à l''un des plans suivants :
- **Plan Gratuit** : Limité à 10 chambres, fonctionnalités de base
- **Plan Essentiel** : 29€ HT/mois, jusqu''à 30 chambres
- **Plan Standard** : 49€ HT/mois, jusqu''à 60 chambres
- **Plan Premium** : 99€ HT/mois, chambres illimitées et toutes fonctionnalités

## Article 4 - Tarifs et paiement

### 4.1 Prix
Les prix sont indiqués en euros hors taxes (HT). La TVA applicable (20%) sera ajoutée au montant HT.

### 4.2 Modalités de paiement
Le paiement s''effectue par prélèvement automatique via GoCardless. En souscrivant à un abonnement, le Client autorise BICBLOC à prélever automatiquement le montant de l''abonnement chaque mois.

### 4.3 Facturation
Une facture est émise et envoyée par email au Client à chaque prélèvement. Les factures sont également accessibles dans l''espace client.

## Article 5 - Durée et résiliation

### 5.1 Durée
L''abonnement est souscrit pour une durée indéterminée, avec facturation mensuelle.

### 5.2 Résiliation
Le Client peut résilier son abonnement à tout moment depuis son espace client. La résiliation prend effet à la fin de la période de facturation en cours. Aucun remboursement n''est effectué pour la période en cours.

### 5.3 Suspension
BICBLOC se réserve le droit de suspendre l''accès au service en cas de :
- Non-paiement après deux tentatives de prélèvement
- Utilisation contraire aux présentes CGV
- Activité frauduleuse détectée

## Article 6 - Obligations du Client

Le Client s''engage à :
- Fournir des informations exactes lors de son inscription
- Maintenir la confidentialité de ses identifiants de connexion
- Ne pas utiliser le service à des fins illicites
- Respecter la législation en vigueur, notamment en matière de protection des données personnelles de ses employés

## Article 7 - Obligations du Prestataire

BICBLOC s''engage à :
- Assurer la disponibilité du service (objectif de 99,5% de disponibilité mensuelle)
- Sécuriser les données conformément aux standards de l''industrie
- Fournir un support technique par email dans un délai de 48 heures ouvrées
- Informer le Client des évolutions majeures du service

## Article 8 - Propriété intellectuelle

La plateforme Nettobloc, son code source, son design, et tous les contenus associés sont la propriété exclusive de BICBLOC. Toute reproduction, représentation ou exploitation non autorisée est interdite.

## Article 9 - Protection des données personnelles

### 9.1 Responsable du traitement
BICBLOC agit en qualité de sous-traitant au sens du RGPD pour les données saisies par le Client concernant ses employés.

### 9.2 Finalités
Les données sont traitées pour :
- La fourniture du service
- La gestion de la relation client
- La facturation
- L''amélioration du service

### 9.3 Droits des personnes
Conformément au RGPD, toute personne dispose d''un droit d''accès, de rectification, d''effacement, de portabilité et d''opposition concernant ses données personnelles. Ces droits peuvent être exercés par email à : dpo@bicbloc.fr

## Article 10 - Responsabilité

### 10.1 Limitation
La responsabilité de BICBLOC est limitée au montant des sommes versées par le Client au cours des douze (12) derniers mois.

### 10.2 Exclusions
BICBLOC ne saurait être tenue responsable :
- Des interruptions de service dues à des cas de force majeure
- Des dommages indirects
- De l''utilisation faite par le Client des données exportées

## Article 11 - Droit applicable et juridiction

Les présentes CGV sont soumises au droit français. Tout litige sera soumis aux tribunaux compétents de Paris.

## Article 12 - Modification des CGV

BICBLOC se réserve le droit de modifier les présentes CGV. Le Client sera informé par email au moins trente (30) jours avant l''entrée en vigueur des modifications. L''utilisation continue du service après cette date vaut acceptation des nouvelles conditions.

---

**BICBLOC SAS**
15 Rue de la République
75001 Paris, France
contact@bicbloc.fr
');

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_legal_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_legal_pages_updated_at
BEFORE UPDATE ON public.legal_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_legal_pages_updated_at();