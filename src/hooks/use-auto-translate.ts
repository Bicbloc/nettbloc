/**
 * useAutoTranslate
 * --------------------------------------------------
 * When language === 'en', walks the DOM and translates French text nodes
 * (and common attributes: placeholder, title, aria-label, alt) using the
 * FR→EN phrase dictionary. Re-applies on DOM mutations.
 *
 * Anti-loop strategy:
 *  - Uses word boundaries so "Profil" doesn't match inside "Profile".
 *  - Caches last-translated value per text node via WeakMap.
 *  - Suppresses observation while we mutate the DOM ourselves.
 */
import { useEffect } from 'react';
import { FR_EN_PHRASES } from '@/i18n/frToEnDictionary';

const ATTR_TARGETS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);

let SORTED_KEYS: string[] | null = null;
function getSortedKeys(): string[] {
  if (!SORTED_KEYS) {
    SORTED_KEYS = Object.keys(FR_EN_PHRASES).sort((a, b) => b.length - a.length);
  }
  return SORTED_KEYS;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Detect if a string starts/ends with a letter (incl. accented) for word-boundary logic.
const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

let BIG_REGEX: RegExp | null = null;
function getRegex(): RegExp {
  if (!BIG_REGEX) {
    // Build alternation. We'll handle word boundaries manually after match
    // because \b doesn't play well with accented chars.
    const alternation = getSortedKeys().map(escapeRegExp).join('|');
    BIG_REGEX = new RegExp(alternation, 'g');
  }
  return BIG_REGEX;
}

function translateString(input: string): string {
  if (!input || input.length < 2) return input;
  if (input.length > 5000) return input;
  const regex = getRegex();
  regex.lastIndex = 0;
  return input.replace(regex, (match, offset: number, full: string) => {
    // Word-boundary check: char before must not be a letter, char after must not be a letter
    const before = full[offset - 1];
    const after = full[offset + match.length];
    const matchStartsWithLetter = LETTER.test(match[0]);
    const matchEndsWithLetter = LETTER.test(match[match.length - 1]);
    if (matchStartsWithLetter && before && LETTER.test(before)) return match;
    if (matchEndsWithLetter && after && LETTER.test(after)) return match;
    return FR_EN_PHRASES[match] ?? match;
  });
}

// Cache: remember the last value we set, so observer mutations on our own
// writes are no-ops.
const lastSetText = new WeakMap<Text, string>();
const lastSetAttr = new WeakMap<Element, Map<string, string>>();

let suppressObserver = 0;

function translateTextNode(node: Text) {
  const original = node.nodeValue;
  if (!original) return;
  if (lastSetText.get(node) === original) return;
  const translated = translateString(original);
  if (translated !== original) {
    suppressObserver++;
    node.nodeValue = translated;
    suppressObserver--;
    lastSetText.set(node, translated);
  } else {
    lastSetText.set(node, original);
  }
}

function translateElement(el: Element) {
  if (SKIP_TAGS.has(el.tagName)) return;
  if ((el as HTMLElement).isContentEditable) return;
  let map = lastSetAttr.get(el);
  for (const attr of ATTR_TARGETS) {
    const v = el.getAttribute(attr);
    if (v) {
      if (map && map.get(attr) === v) continue;
      const t = translateString(v);
      if (t !== v) {
        suppressObserver++;
        el.setAttribute(attr, t);
        suppressObserver--;
        if (!map) { map = new Map(); lastSetAttr.set(el, map); }
        map.set(attr, t);
      } else {
        if (!map) { map = new Map(); lastSetAttr.set(el, map); }
        map.set(attr, v);
      }
    }
  }
  if (el.tagName === 'INPUT') {
    const input = el as HTMLInputElement;
    if (input.type === 'button' || input.type === 'submit' || input.type === 'reset') {
      if (input.value) {
        const t = translateString(input.value);
        if (t !== input.value) {
          suppressObserver++;
          input.value = t;
          suppressObserver--;
        }
      }
    }
  }
}

function walkAndTranslate(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateElement(root as Element);
    if (SKIP_TAGS.has((root as Element).tagName)) return;
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (SKIP_TAGS.has((node as Element).tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      translateTextNode(n as Text);
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      translateElement(n as Element);
    }
  }
}

export function useAutoTranslate(language: string) {
  useEffect(() => {
    if (language !== 'en') return;

    walkAndTranslate(document.body);

    let scheduled = false;
    const pending = new Set<Node>();

    const flush = () => {
      scheduled = false;
      const nodes = Array.from(pending);
      pending.clear();
      for (const node of nodes) {
        try {
          if (node.isConnected) walkAndTranslate(node);
        } catch { /* ignore */ }
      }
    };

    const schedule = (node: Node) => {
      pending.add(node);
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    };

    const observer = new MutationObserver((mutations) => {
      if (suppressObserver > 0) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
              schedule(node);
            }
          });
        } else if (m.type === 'characterData') {
          if (m.target.nodeType === Node.TEXT_NODE) {
            // Invalidate cache because external code changed it
            lastSetText.delete(m.target as Text);
            schedule(m.target);
          }
        } else if (m.type === 'attributes') {
          if (
            m.target.nodeType === Node.ELEMENT_NODE &&
            m.attributeName &&
            (ATTR_TARGETS as readonly string[]).includes(m.attributeName)
          ) {
            const map = lastSetAttr.get(m.target as Element);
            if (map) map.delete(m.attributeName);
            schedule(m.target);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTR_TARGETS],
    });

    return () => {
      observer.disconnect();
    };
  }, [language]);
}
