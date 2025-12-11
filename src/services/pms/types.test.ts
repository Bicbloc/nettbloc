import { describe, it, expect } from 'vitest';
import {
  normalizeCleaningType,
  isFullCleaning,
  isQuickCleaning,
  normalizeRoomNumber,
  parseDate,
  inferCleaningFromDates,
  CLEANING_TYPE_LABELS,
  CLEANING_TYPE_SHORT_LABELS,
} from './types';

describe('PMS Types - normalizeCleaningType', () => {
  it('should normalize old format to new format', () => {
    expect(normalizeCleaningType('full')).toBe('a_blanc');
    expect(normalizeCleaningType('quick')).toBe('recouche');
  });

  it('should keep new format unchanged', () => {
    expect(normalizeCleaningType('a_blanc')).toBe('a_blanc');
    expect(normalizeCleaningType('recouche')).toBe('recouche');
    expect(normalizeCleaningType('none')).toBe('none');
  });

  it('should handle case insensitivity', () => {
    expect(normalizeCleaningType('FULL')).toBe('a_blanc');
    expect(normalizeCleaningType('Quick')).toBe('recouche');
    expect(normalizeCleaningType('A_BLANC')).toBe('a_blanc');
  });

  it('should default to a_blanc for null/undefined/unknown', () => {
    expect(normalizeCleaningType(null)).toBe('a_blanc');
    expect(normalizeCleaningType(undefined)).toBe('a_blanc');
    expect(normalizeCleaningType('')).toBe('a_blanc');
    expect(normalizeCleaningType('invalid')).toBe('a_blanc');
  });
});

describe('PMS Types - isFullCleaning', () => {
  it('should identify full cleaning types', () => {
    expect(isFullCleaning('full')).toBe(true);
    expect(isFullCleaning('a_blanc')).toBe(true);
  });

  it('should reject non-full cleaning types', () => {
    expect(isFullCleaning('quick')).toBe(false);
    expect(isFullCleaning('recouche')).toBe(false);
    expect(isFullCleaning('none')).toBe(false);
  });
});

describe('PMS Types - isQuickCleaning', () => {
  it('should identify quick cleaning types', () => {
    expect(isQuickCleaning('quick')).toBe(true);
    expect(isQuickCleaning('recouche')).toBe(true);
  });

  it('should reject non-quick cleaning types', () => {
    expect(isQuickCleaning('full')).toBe(false);
    expect(isQuickCleaning('a_blanc')).toBe(false);
    expect(isQuickCleaning('none')).toBe(false);
  });
});

describe('PMS Types - normalizeRoomNumber', () => {
  it('should remove leading zeros', () => {
    expect(normalizeRoomNumber('001')).toBe('1');
    expect(normalizeRoomNumber('0101')).toBe('101');
    expect(normalizeRoomNumber('00042')).toBe('42');
  });

  it('should keep numbers without leading zeros', () => {
    expect(normalizeRoomNumber('101')).toBe('101');
    expect(normalizeRoomNumber('42')).toBe('42');
  });

  it('should handle alphanumeric room numbers', () => {
    expect(normalizeRoomNumber('A101')).toBe('A101');
    expect(normalizeRoomNumber('0A101')).toBe('A101');
  });

  it('should not return empty string for zero', () => {
    expect(normalizeRoomNumber('0')).toBe('0');
    expect(normalizeRoomNumber('00')).toBe('00');
  });
});

describe('PMS Types - parseDate', () => {
  it('should parse DD/MM/YYYY format', () => {
    const date = parseDate('15/06/2024');
    expect(date).not.toBeNull();
    expect(date?.getDate()).toBe(15);
    expect(date?.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(date?.getFullYear()).toBe(2024);
  });

  it('should parse DD-MM-YYYY format', () => {
    const date = parseDate('15-06-2024');
    expect(date).not.toBeNull();
    expect(date?.getDate()).toBe(15);
    expect(date?.getMonth()).toBe(5);
  });

  it('should parse DD.MM.YYYY format', () => {
    const date = parseDate('15.06.2024');
    expect(date).not.toBeNull();
    expect(date?.getDate()).toBe(15);
    expect(date?.getMonth()).toBe(5);
  });

  it('should parse YYYY-MM-DD format', () => {
    const date = parseDate('2024-06-15');
    expect(date).not.toBeNull();
    expect(date?.getDate()).toBe(15);
    expect(date?.getMonth()).toBe(5);
    expect(date?.getFullYear()).toBe(2024);
  });

  it('should parse two-digit years', () => {
    const date = parseDate('15/06/24');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
  });

  it('should return null for invalid dates', () => {
    expect(parseDate('invalid')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('PMS Types - inferCleaningFromDates', () => {
  const today = new Date('2024-06-15');

  it('should return a_blanc for checkout today', () => {
    const result = inferCleaningFromDates(null, '15/06/2024', null, today);
    expect(result.cleaningType).toBe('a_blanc');
    expect(result.status).toBe('checkout');
  });

  it('should return a_blanc for arrival today', () => {
    const result = inferCleaningFromDates('15/06/2024', '20/06/2024', null, today);
    expect(result.cleaningType).toBe('a_blanc');
    expect(result.status).toBe('arrival');
  });

  it('should return recouche for stayover', () => {
    const result = inferCleaningFromDates('10/06/2024', '20/06/2024', null, today);
    expect(result.cleaningType).toBe('recouche');
    expect(result.status).toBe('stayover');
  });

  it('should return a_blanc for last night of stay', () => {
    const result = inferCleaningFromDates(null, null, '3/3', today);
    expect(result.cleaningType).toBe('a_blanc');
    expect(result.status).toBe('checkout');
  });

  it('should return recouche for middle of stay', () => {
    const result = inferCleaningFromDates(null, null, '2/4', today);
    expect(result.cleaningType).toBe('recouche');
    expect(result.status).toBe('stayover');
  });

  it('should handle single night stays', () => {
    const result = inferCleaningFromDates(null, null, '1/1', today);
    expect(result.cleaningType).toBe('a_blanc');
    expect(result.status).toBe('checkout');
  });
});

describe('PMS Types - Labels', () => {
  it('should have correct cleaning type labels', () => {
    expect(CLEANING_TYPE_LABELS['a_blanc']).toBe('À Blanc');
    expect(CLEANING_TYPE_LABELS['recouche']).toBe('Recouche');
    expect(CLEANING_TYPE_LABELS['none']).toBe('Aucun');
    expect(CLEANING_TYPE_LABELS['full']).toBe('À Blanc');
    expect(CLEANING_TYPE_LABELS['quick']).toBe('Recouche');
  });

  it('should have correct short labels', () => {
    expect(CLEANING_TYPE_SHORT_LABELS['a_blanc']).toBe('Blanc');
    expect(CLEANING_TYPE_SHORT_LABELS['recouche']).toBe('Rec.');
    expect(CLEANING_TYPE_SHORT_LABELS['none']).toBe('-');
  });
});
