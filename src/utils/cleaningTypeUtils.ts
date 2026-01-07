// Utility functions for cleaning type compatibility and conversion
// Re-export types from pms/types for consistency
import { normalizeCleaningType as normalize, NormalizedCleaningType } from '@/services/pms/types';

export type CleaningType = 'a_blanc' | 'recouche' | 'none' | 'full' | 'quick';

// Map old values to new values (kept for backward compatibility)
const CLEANING_TYPE_MAP: Record<string, NormalizedCleaningType> = {
  'full': 'a_blanc',
  'quick': 'recouche',
  'none': 'none',
  'a_blanc': 'a_blanc',
  'recouche': 'recouche',
};

/**
 * Normalizes cleaning type from any format to the new standard format
 */
export function normalizeCleaningType(type: string | undefined | null): NormalizedCleaningType {
  return normalize(type);
}

/**
 * Check if cleaning type is "À Blanc" (full cleaning) - supports both old and new formats
 */
export function isFullCleaning(type: string | undefined | null): boolean {
  return type === 'full' || type === 'a_blanc';
}

/**
 * Check if cleaning type is "Recouche" (quick cleaning) - supports both old and new formats
 */
export function isQuickCleaning(type: string | undefined | null): boolean {
  return type === 'quick' || type === 'recouche';
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
    case 'a_blanc': return 'B';
    case 'recouche': return 'R';
    case 'none': return '-';
    default: return 'B';
  }
}

/**
 * Get estimated time for cleaning type in minutes
 */
export function getCleaningTime(type: string | undefined, config?: { fullTime?: number; quickTime?: number }): number {
  const fullTime = config?.fullTime || 30;
  const quickTime = config?.quickTime || 15;
  
  if (isFullCleaning(type)) return fullTime;
  if (isQuickCleaning(type)) return quickTime;
  return fullTime; // Default
}

/**
 * Get badge variant for cleaning type
 */
export function getCleaningTypeBadgeVariant(type: string | undefined): 'default' | 'secondary' | 'outline' {
  if (isFullCleaning(type)) return 'default';
  if (isQuickCleaning(type)) return 'secondary';
  return 'outline';
}