// Utility functions for cleaning type compatibility and conversion

export type CleaningType = 'a_blanc' | 'recouche' | 'none';

// Map old values to new values
const CLEANING_TYPE_MAP: Record<string, CleaningType> = {
  'full': 'a_blanc',
  'quick': 'recouche',
  'none': 'none',
  'a_blanc': 'a_blanc',
  'recouche': 'recouche',
};

/**
 * Normalizes cleaning type from any format to the new standard format
 */
export function normalizeCleaningType(type: string | undefined | null): CleaningType {
  if (!type) return 'a_blanc';
  const normalized = CLEANING_TYPE_MAP[type.toLowerCase()];
  return normalized || 'a_blanc';
}

/**
 * Get display label for cleaning type
 */
export function getCleaningTypeLabel(type: string | undefined): string {
  const normalized = normalizeCleaningType(type);
  switch (normalized) {
    case 'a_blanc': return 'À Blanc';
    case 'recouche': return 'Recouche';
    case 'none': return 'Aucun';
    default: return 'À Blanc';
  }
}

/**
 * Get short label for cleaning type
 */
export function getCleaningTypeShortLabel(type: string | undefined): string {
  const normalized = normalizeCleaningType(type);
  switch (normalized) {
    case 'a_blanc': return 'Blanc';
    case 'recouche': return 'Rec.';
    case 'none': return '-';
    default: return 'Blanc';
  }
}

/**
 * Check if cleaning type is "À Blanc" (full cleaning)
 */
export function isFullCleaning(type: string | undefined): boolean {
  return normalizeCleaningType(type) === 'a_blanc';
}

/**
 * Check if cleaning type is "Recouche" (quick cleaning)
 */
export function isQuickCleaning(type: string | undefined): boolean {
  return normalizeCleaningType(type) === 'recouche';
}

/**
 * Get estimated time for cleaning type in minutes
 */
export function getCleaningTime(type: string | undefined, config?: { fullTime?: number; quickTime?: number }): number {
  const normalized = normalizeCleaningType(type);
  const fullTime = config?.fullTime || 30;
  const quickTime = config?.quickTime || 15;
  
  switch (normalized) {
    case 'a_blanc': return fullTime;
    case 'recouche': return quickTime;
    case 'none': return 0;
    default: return fullTime;
  }
}

/**
 * Get badge variant for cleaning type
 */
export function getCleaningTypeBadgeVariant(type: string | undefined): 'default' | 'secondary' | 'outline' {
  const normalized = normalizeCleaningType(type);
  switch (normalized) {
    case 'a_blanc': return 'default';
    case 'recouche': return 'secondary';
    case 'none': return 'outline';
    default: return 'default';
  }
}