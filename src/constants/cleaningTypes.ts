// Constants unifiées pour les types de nettoyage
export const CLEANING_TYPES = {
  FULL: 'full',       // À blanc / Départ
  QUICK: 'quick',     // Recouche / Stayover
  NONE: 'none'        // Aucun nettoyage
} as const;

export type CleaningType = typeof CLEANING_TYPES[keyof typeof CLEANING_TYPES];

export const CLEANING_TYPE_LABELS = {
  full: { fr: 'À blanc', en: 'Full clean', short: 'Blanc' },
  quick: { fr: 'Recouche', en: 'Quick clean', short: 'Rec.' },
  none: { fr: 'Aucun', en: 'None', short: '-' }
} as const;

export const CLEANING_TYPE_COLORS = {
  full: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-500' },
  quick: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500' },
  none: { bg: 'bg-gray-400', text: 'text-gray-500', border: 'border-gray-400' }
} as const;

// Mapping depuis tous les anciens noms possibles
const CLEANING_TYPE_ALIASES: Record<string, CleaningType> = {
  'a_blanc': 'full',
  'recouche': 'quick',
  'full': 'full',
  'quick': 'quick',
  'none': 'none',
  // Variations courantes
  'checkout': 'full',
  'departure': 'full',
  'départ': 'full',
  'stayover': 'quick',
  'occupied': 'quick',
  'occupé': 'quick',
  'empty': 'none',
  'vacant': 'none',
  'vide': 'none'
};

/**
 * Normalise un type de nettoyage vers le format standard
 */
export function normalizeCleaningType(type: string | undefined | null): CleaningType {
  if (!type) return 'none';
  const normalized = CLEANING_TYPE_ALIASES[type.toLowerCase()];
  return normalized || 'none';
}

/**
 * Obtient le label français pour un type de nettoyage
 */
export function getCleaningTypeLabel(type: string | undefined | null): string {
  const normalized = normalizeCleaningType(type);
  return CLEANING_TYPE_LABELS[normalized].fr;
}

/**
 * Obtient le label court pour un type de nettoyage
 */
export function getCleaningTypeShortLabel(type: string | undefined | null): string {
  const normalized = normalizeCleaningType(type);
  return CLEANING_TYPE_LABELS[normalized].short;
}

/**
 * Obtient les couleurs CSS pour un type de nettoyage
 */
export function getCleaningTypeColors(type: string | undefined | null): { bg: string; text: string; border: string } {
  const normalized = normalizeCleaningType(type);
  return CLEANING_TYPE_COLORS[normalized];
}

/**
 * Vérifie si c'est un nettoyage complet (À blanc)
 */
export function isFullCleaning(type: string | undefined | null): boolean {
  return normalizeCleaningType(type) === 'full';
}

/**
 * Vérifie si c'est un nettoyage rapide (Recouche)
 */
export function isQuickCleaning(type: string | undefined | null): boolean {
  return normalizeCleaningType(type) === 'quick';
}

/**
 * Obtient le temps estimé pour un type de nettoyage
 */
export function getCleaningTime(
  type: string | undefined | null, 
  config?: { fullTime?: number; quickTime?: number }
): number {
  const fullTime = config?.fullTime || 30;
  const quickTime = config?.quickTime || 15;
  
  const normalized = normalizeCleaningType(type);
  if (normalized === 'full') return fullTime;
  if (normalized === 'quick') return quickTime;
  return fullTime;
}
