// Liste des 27 pays de l'UE (code ISO Alpha-2 + nom FR/EN)
export interface CountryOption {
  code: string;
  nameFr: string;
  nameEn: string;
  vatPrefix: string; // Préfixe TVA intracom
}

export const EU_COUNTRIES: CountryOption[] = [
  { code: 'AT', nameFr: 'Autriche', nameEn: 'Austria', vatPrefix: 'AT' },
  { code: 'BE', nameFr: 'Belgique', nameEn: 'Belgium', vatPrefix: 'BE' },
  { code: 'BG', nameFr: 'Bulgarie', nameEn: 'Bulgaria', vatPrefix: 'BG' },
  { code: 'CY', nameFr: 'Chypre', nameEn: 'Cyprus', vatPrefix: 'CY' },
  { code: 'CZ', nameFr: 'République tchèque', nameEn: 'Czech Republic', vatPrefix: 'CZ' },
  { code: 'DE', nameFr: 'Allemagne', nameEn: 'Germany', vatPrefix: 'DE' },
  { code: 'DK', nameFr: 'Danemark', nameEn: 'Denmark', vatPrefix: 'DK' },
  { code: 'EE', nameFr: 'Estonie', nameEn: 'Estonia', vatPrefix: 'EE' },
  { code: 'ES', nameFr: 'Espagne', nameEn: 'Spain', vatPrefix: 'ES' },
  { code: 'FI', nameFr: 'Finlande', nameEn: 'Finland', vatPrefix: 'FI' },
  { code: 'FR', nameFr: 'France', nameEn: 'France', vatPrefix: 'FR' },
  { code: 'GR', nameFr: 'Grèce', nameEn: 'Greece', vatPrefix: 'EL' },
  { code: 'HR', nameFr: 'Croatie', nameEn: 'Croatia', vatPrefix: 'HR' },
  { code: 'HU', nameFr: 'Hongrie', nameEn: 'Hungary', vatPrefix: 'HU' },
  { code: 'IE', nameFr: 'Irlande', nameEn: 'Ireland', vatPrefix: 'IE' },
  { code: 'IT', nameFr: 'Italie', nameEn: 'Italy', vatPrefix: 'IT' },
  { code: 'LT', nameFr: 'Lituanie', nameEn: 'Lithuania', vatPrefix: 'LT' },
  { code: 'LU', nameFr: 'Luxembourg', nameEn: 'Luxembourg', vatPrefix: 'LU' },
  { code: 'LV', nameFr: 'Lettonie', nameEn: 'Latvia', vatPrefix: 'LV' },
  { code: 'MT', nameFr: 'Malte', nameEn: 'Malta', vatPrefix: 'MT' },
  { code: 'NL', nameFr: 'Pays-Bas', nameEn: 'Netherlands', vatPrefix: 'NL' },
  { code: 'PL', nameFr: 'Pologne', nameEn: 'Poland', vatPrefix: 'PL' },
  { code: 'PT', nameFr: 'Portugal', nameEn: 'Portugal', vatPrefix: 'PT' },
  { code: 'RO', nameFr: 'Roumanie', nameEn: 'Romania', vatPrefix: 'RO' },
  { code: 'SE', nameFr: 'Suède', nameEn: 'Sweden', vatPrefix: 'SE' },
  { code: 'SI', nameFr: 'Slovénie', nameEn: 'Slovenia', vatPrefix: 'SI' },
  { code: 'SK', nameFr: 'Slovaquie', nameEn: 'Slovakia', vatPrefix: 'SK' },
];

export const isEUCountry = (code?: string | null): boolean => {
  if (!code) return false;
  return EU_COUNTRIES.some((c) => c.code === code.toUpperCase());
};

/**
 * Validation basique format n° TVA intracom (préfixe pays + chiffres/lettres).
 * Une vraie validation VIES doit être faite côté serveur (edge function).
 */
export const isValidVatNumberFormat = (vat?: string | null): boolean => {
  if (!vat) return false;
  const cleaned = vat.replace(/\s/g, '').toUpperCase();
  // Doit faire entre 8 et 14 caractères et commencer par 2 lettres ISO
  if (!/^[A-Z]{2}[A-Z0-9]{6,12}$/.test(cleaned)) return false;
  const prefix = cleaned.slice(0, 2);
  return EU_COUNTRIES.some((c) => c.vatPrefix === prefix);
};

/**
 * Calcule la TVA applicable selon les règles européennes B2B reverse-charge.
 * - Pays vendeur: France (FR)
 * - Hors UE: pas de TVA
 * - France: TVA française (20%)
 * - UE hors France avec n° TVA intracom valide: 0% (reverse-charge)
 * - UE hors France sans n° TVA: TVA française (20%)
 */
export const SELLER_COUNTRY = 'FR';
export const STANDARD_VAT_RATE = 20;

export interface VatComputation {
  rate: number;        // 0 ou 20
  reverseCharge: boolean;
  reason: 'domestic' | 'reverse_charge' | 'no_vat_outside_eu' | 'eu_no_vat_number';
}

export const computeVatRate = (
  customerCountry?: string | null,
  customerVatNumber?: string | null,
): VatComputation => {
  const country = (customerCountry || '').toUpperCase();

  if (!isEUCountry(country)) {
    return { rate: 0, reverseCharge: false, reason: 'no_vat_outside_eu' };
  }

  if (country === SELLER_COUNTRY) {
    return { rate: STANDARD_VAT_RATE, reverseCharge: false, reason: 'domestic' };
  }

  // UE hors France
  if (isValidVatNumberFormat(customerVatNumber)) {
    return { rate: 0, reverseCharge: true, reason: 'reverse_charge' };
  }

  return { rate: STANDARD_VAT_RATE, reverseCharge: false, reason: 'eu_no_vat_number' };
};
