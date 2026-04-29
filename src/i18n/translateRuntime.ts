/**
 * Runtime FR→EN translation utility for dynamic strings (toasts, dialog
 * descriptions, alerts, etc.) that are produced imperatively in code and
 * therefore not always reachable by the DOM-based useAutoTranslate observer
 * (e.g. content rendered into React portals before the observer scans it,
 * or text passed to native browser dialogs).
 *
 * Reuses the same FR_EN_PHRASES dictionary as useAutoTranslate so behavior
 * stays consistent between static DOM content and dynamic strings.
 */
import { FR_EN_PHRASES } from '@/i18n/frToEnDictionary';

const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

let KEY_INDEX: Map<string, string[]> | null = null;
function getKeyIndex(): Map<string, string[]> {
  if (!KEY_INDEX) {
    const sorted = Object.keys(FR_EN_PHRASES).sort((a, b) => b.length - a.length);
    const idx = new Map<string, string[]>();
    for (const k of sorted) {
      const ch = k[0];
      const bucket = idx.get(ch);
      if (bucket) bucket.push(k);
      else idx.set(ch, [k]);
    }
    KEY_INDEX = idx;
  }
  return KEY_INDEX;
}

export function translateFrToEn(input: string): string {
  if (!input || input.length < 2) return input;
  if (input.length > 5000) return input;
  const idx = getKeyIndex();
  const len = input.length;
  let out = '';
  let i = 0;
  while (i < len) {
    const bucket = idx.get(input[i]);
    let matched: string | null = null;
    if (bucket) {
      for (const key of bucket) {
        const klen = key.length;
        if (i + klen > len) continue;
        if (input.substr(i, klen) !== key) continue;
        if (LETTER.test(key[0])) {
          const before = input[i - 1];
          if (before && LETTER.test(before)) continue;
        }
        if (LETTER.test(key[klen - 1])) {
          const after = input[i + klen];
          if (after && LETTER.test(after)) continue;
        }
        matched = key;
        break;
      }
    }
    if (matched) {
      out += FR_EN_PHRASES[matched];
      i += matched.length;
    } else {
      out += input[i];
      i++;
    }
  }
  return out;
}

/**
 * Reads the user's preferred language from localStorage (synced by
 * LanguageContext / useProfileLanguageSync). Safe to call from non-React
 * code paths.
 */
export function getRuntimeLanguage(): 'fr' | 'en' {
  try {
    const v = typeof localStorage !== 'undefined'
      ? localStorage.getItem('preferred_language')
      : null;
    return v === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

/**
 * Translate a value if and only if the active language is English. Pass
 * through React nodes / non-strings unchanged.
 */
export function maybeTranslate<T>(value: T): T {
  if (typeof value !== 'string') return value;
  if (getRuntimeLanguage() !== 'en') return value;
  return translateFrToEn(value) as unknown as T;
}
