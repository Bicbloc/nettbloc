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

const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

// Build a per-first-character index of keys (sorted longest-first) so we can
// scan a string left-to-right and at each position try the LONGEST matching key.
// JS regex alternation returns the FIRST alternative, not the longest, which
// produced franglais output (e.g. "Commander chez BicBloc" -> "Order chez BicBloc"
// instead of using the full-phrase entry). This index fixes that.
let KEY_INDEX: Map<string, string[]> | null = null;
function getKeyIndex(): Map<string, string[]> {
  if (!KEY_INDEX) {
    const idx = new Map<string, string[]>();
    for (const k of getSortedKeys()) {
      const ch = k[0];
      const bucket = idx.get(ch);
      if (bucket) bucket.push(k);
      else idx.set(ch, [k]);
    }
    KEY_INDEX = idx;
  }
  return KEY_INDEX;
}

function translateString(input: string): string {
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
        break; // bucket is sorted longest-first -> this is the longest valid match
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
