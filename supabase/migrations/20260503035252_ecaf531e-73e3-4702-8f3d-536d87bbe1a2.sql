
ALTER TABLE public.legal_pages ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr';
UPDATE public.legal_pages SET language='fr' WHERE language IS NULL OR language='';
DO $$ BEGIN
  ALTER TABLE public.legal_pages DROP CONSTRAINT IF EXISTS legal_pages_slug_key;
EXCEPTION WHEN others THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS legal_pages_slug_lang_idx ON public.legal_pages(slug, language);

INSERT INTO public.legal_pages (slug, language, title, content) VALUES (
'cgv', 'en', 'Terms and Conditions of Sale',
$md$# Terms and Conditions of Sale - BICBLOC

**Last update: February 2, 2026**

## Article 1 - Purpose and scope

These Terms and Conditions of Sale (hereinafter "T&C") govern the contractual relationship between:

**BICBLOC**
Simplified joint-stock company (SAS)
Registered office: 97864605700015
SIRET: FR92978646057
RCS Paris B 123 456 789
Email: support@bicbloc.eu
Phone: +33 1 23 45 67 89

Hereinafter referred to as "BICBLOC" or "the Provider"

And any natural or legal person, individual or professional, subscribing to the services offered on the Nettobloc platform.

Hereinafter referred to as "the Client"

## Article 2 - Services offered

Through its Nettobloc platform, BICBLOC provides the following services:
- Hotel room management and cleaning status tracking
- Housekeeping task planning and follow-up
- Housekeeping team management
- Incident reporting module
- Linen management
- Dashboard and activity reports

## Article 3 - Subscription terms

### 3.1 Trial period
Every new Client benefits from a free three (3) month trial period starting from the creation of their account. During this period, all features are accessible without restriction.

### 3.2 Subscriptions
At the end of the trial period, the Client may subscribe to one of the following plans:
- **Free Plan**: Limited to 10 rooms, basic features
- **Essential Plan**: €29 excl. VAT/month, up to 30 rooms
- **Standard Plan**: €49 excl. VAT/month, up to 60 rooms
- **Premium Plan**: €99 excl. VAT/month, unlimited rooms and all features

## Article 4 - Pricing and payment

### 4.1 Prices
Prices are quoted in euros excluding tax (excl. VAT). Applicable VAT (20%) will be added to the net amount.

### 4.2 Payment terms
Payment is made by direct debit via GoCardless. By subscribing to a plan, the Client authorises BICBLOC to automatically debit the subscription amount each month.

### 4.3 Invoicing
An invoice is issued and sent by email to the Client at each debit. Invoices are also accessible from the client area.

## Article 5 - Term and termination

### 5.1 Term
The subscription is taken out for an indefinite period, with monthly billing.

### 5.2 Termination
The Client can cancel their subscription at any time from their client area. Cancellation takes effect at the end of the current billing period. No refund is made for the current period.

### 5.3 Suspension
BICBLOC reserves the right to suspend access to the service in the event of:
- Non-payment after two debit attempts
- Use contrary to these T&C
- Detected fraudulent activity

## Article 6 - Client obligations

The Client undertakes to:
- Provide accurate information when registering
- Maintain the confidentiality of their login credentials
- Not use the service for unlawful purposes
- Comply with applicable laws, particularly regarding the protection of their employees' personal data

## Article 7 - Provider obligations

BICBLOC undertakes to:
- Ensure service availability (target of 99.5% monthly uptime)
- Secure data in accordance with industry standards
- Provide technical support by email within 48 working hours
- Inform the Client of major service changes

## Article 8 - Intellectual property

The Nettobloc platform, its source code, design, and all associated content are the exclusive property of BICBLOC. Any unauthorised reproduction, representation or exploitation is prohibited.

## Article 9 - Personal data protection

### 9.1 Data controller
BICBLOC acts as a processor within the meaning of the GDPR for data entered by the Client concerning its employees.

### 9.2 Purposes
Data is processed for:
- Service provision
- Customer relationship management
- Invoicing
- Service improvement

### 9.3 Rights of individuals
In accordance with the GDPR, every person has a right of access, rectification, erasure, portability and objection regarding their personal data. These rights may be exercised by email to: dpo@bicbloc.fr

## Article 10 - Liability

### 10.1 Limitation
BICBLOC's liability is limited to the amounts paid by the Client during the last twelve (12) months.

### 10.2 Exclusions
BICBLOC cannot be held liable for:
- Service interruptions due to force majeure
- Indirect damages
- The use made by the Client of exported data

## Article 11 - Applicable law and jurisdiction

These T&C are governed by French law. Any dispute will be submitted to the competent courts of Paris.

## Article 12 - Modification of T&C

BICBLOC reserves the right to modify these T&C. The Client will be notified by email at least thirty (30) days before the changes take effect. Continued use of the service after this date constitutes acceptance of the new conditions.

---

**BICBLOC SAS**
15 Rue de la République
75001 Paris, France
contact@bicbloc.fr
$md$
) ON CONFLICT (slug, language) DO NOTHING;
