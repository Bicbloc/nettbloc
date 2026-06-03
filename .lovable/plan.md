## Objectif

Créer une **Politique de confidentialité** complète en français et en anglais, stockée dans la table `legal_pages` (gérée depuis l'admin et affichée sur `/legal/<slug>`).

## Constat

- La table `legal_pages` contient déjà uniquement les CGV (`slug = cgv`, en FR et EN).
- Aucune page de confidentialité n'existe encore.
- Le format de contenu est du Markdown (titres `##`, listes `-`, gras `**`), rendu par `LegalPage.tsx`.

## Ce qui sera fait

1. **Insérer 2 lignes** dans `legal_pages` (opération de données, pas de migration) :
   - `slug = privacy`, `language = fr`, `title = Politique de confidentialité`
   - `slug = privacy`, `language = en`, `title = Privacy Policy`
2. **Contenu rédigé** adapté à nettobloc (RGPD), couvrant :
   - Responsable du traitement (bicbloc, contact `support@bicbloc.eu`)
   - Données collectées (compte établissement, personnel, chambres, données de paiement via GoCardless/Stripe)
   - Finalités du traitement et bases légales
   - Sous-traitants / services tiers (Supabase, GoCardless, Stripe, Resend)
   - Durée de conservation
   - Droits des utilisateurs (accès, rectification, suppression, portabilité, opposition)
   - Cookies et stockage local
   - Sécurité des données et transferts
   - Coordonnées de contact

## Détails techniques

- Insertion via le tool d'insertion de données (`INSERT INTO legal_pages ...`), pas de changement de schéma.
- La page sera accessible immédiatement sur `/legal/privacy` et éditable depuis le panneau admin « Pages légales ».
- Le contenu reprend la terminologie et le branding existants (nettobloc, domaine `nettobloc.bicbloc.eu`, contact `support@bicbloc.eu`).

## À confirmer éventuellement

- Le `slug` proposé est `privacy` ; je peux utiliser `privacy-policy` ou `confidentialite` si tu préfères.
