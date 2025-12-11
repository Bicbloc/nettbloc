import { describe, it, expect } from 'vitest';
import {
  normalizeCleaningType,
  isFullCleaning,
  isQuickCleaning,
  getCleaningTypeLabel,
  getCleaningTypeShortLabel,
  getCleaningTime,
  getCleaningTypeBadgeVariant,
} from './cleaningTypeUtils';

describe('cleaningTypeUtils', () => {
  describe('normalizeCleaningType', () => {
    it('should normalize "full" to "a_blanc"', () => {
      expect(normalizeCleaningType('full')).toBe('a_blanc');
    });

    it('should normalize "quick" to "recouche"', () => {
      expect(normalizeCleaningType('quick')).toBe('recouche');
    });

    it('should keep "a_blanc" as is', () => {
      expect(normalizeCleaningType('a_blanc')).toBe('a_blanc');
    });

    it('should keep "recouche" as is', () => {
      expect(normalizeCleaningType('recouche')).toBe('recouche');
    });

    it('should keep "none" as is', () => {
      expect(normalizeCleaningType('none')).toBe('none');
    });

    it('should default to "a_blanc" for undefined', () => {
      expect(normalizeCleaningType(undefined)).toBe('a_blanc');
    });

    it('should default to "a_blanc" for null', () => {
      expect(normalizeCleaningType(null)).toBe('a_blanc');
    });

    it('should default to "a_blanc" for unknown values', () => {
      expect(normalizeCleaningType('unknown_type')).toBe('a_blanc');
    });
  });

  describe('isFullCleaning', () => {
    it('should return true for "full"', () => {
      expect(isFullCleaning('full')).toBe(true);
    });

    it('should return true for "a_blanc"', () => {
      expect(isFullCleaning('a_blanc')).toBe(true);
    });

    it('should return false for "quick"', () => {
      expect(isFullCleaning('quick')).toBe(false);
    });

    it('should return false for "recouche"', () => {
      expect(isFullCleaning('recouche')).toBe(false);
    });

    it('should return true for undefined (defaults to a_blanc)', () => {
      expect(isFullCleaning(undefined)).toBe(true);
    });
  });

  describe('isQuickCleaning', () => {
    it('should return true for "quick"', () => {
      expect(isQuickCleaning('quick')).toBe(true);
    });

    it('should return true for "recouche"', () => {
      expect(isQuickCleaning('recouche')).toBe(true);
    });

    it('should return false for "full"', () => {
      expect(isQuickCleaning('full')).toBe(false);
    });

    it('should return false for "a_blanc"', () => {
      expect(isQuickCleaning('a_blanc')).toBe(false);
    });
  });

  describe('getCleaningTypeLabel', () => {
    it('should return "À Blanc" for full cleaning types', () => {
      expect(getCleaningTypeLabel('full')).toBe('À Blanc');
      expect(getCleaningTypeLabel('a_blanc')).toBe('À Blanc');
    });

    it('should return "Recouche" for quick cleaning types', () => {
      expect(getCleaningTypeLabel('quick')).toBe('Recouche');
      expect(getCleaningTypeLabel('recouche')).toBe('Recouche');
    });

    it('should return "Aucun" for none', () => {
      expect(getCleaningTypeLabel('none')).toBe('Aucun');
    });

    it('should return "À Blanc" for undefined', () => {
      expect(getCleaningTypeLabel(undefined)).toBe('À Blanc');
    });
  });

  describe('getCleaningTypeShortLabel', () => {
    it('should return "Blanc" for full cleaning types', () => {
      expect(getCleaningTypeShortLabel('full')).toBe('Blanc');
      expect(getCleaningTypeShortLabel('a_blanc')).toBe('Blanc');
    });

    it('should return "Rec." for quick cleaning types', () => {
      expect(getCleaningTypeShortLabel('quick')).toBe('Rec.');
      expect(getCleaningTypeShortLabel('recouche')).toBe('Rec.');
    });

    it('should return "-" for none', () => {
      expect(getCleaningTypeShortLabel('none')).toBe('-');
    });
  });

  describe('getCleaningTime', () => {
    it('should return 30 minutes for full cleaning by default', () => {
      expect(getCleaningTime('full')).toBe(30);
      expect(getCleaningTime('a_blanc')).toBe(30);
    });

    it('should return 15 minutes for quick cleaning by default', () => {
      expect(getCleaningTime('quick')).toBe(15);
      expect(getCleaningTime('recouche')).toBe(15);
    });

    it('should use custom config values', () => {
      const config = { fullTime: 45, quickTime: 20 };
      expect(getCleaningTime('full', config)).toBe(45);
      expect(getCleaningTime('quick', config)).toBe(20);
    });

    it('should return fullTime for undefined type', () => {
      expect(getCleaningTime(undefined)).toBe(30);
    });
  });

  describe('getCleaningTypeBadgeVariant', () => {
    it('should return "default" for full cleaning', () => {
      expect(getCleaningTypeBadgeVariant('full')).toBe('default');
      expect(getCleaningTypeBadgeVariant('a_blanc')).toBe('default');
    });

    it('should return "secondary" for quick cleaning', () => {
      expect(getCleaningTypeBadgeVariant('quick')).toBe('secondary');
      expect(getCleaningTypeBadgeVariant('recouche')).toBe('secondary');
    });

    it('should return "outline" for none', () => {
      expect(getCleaningTypeBadgeVariant('none')).toBe('outline');
    });
  });
});
