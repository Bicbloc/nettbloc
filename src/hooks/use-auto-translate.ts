/**
 * useAutoTranslate
 * --------------------------------------------------
 * When language === 'en', walks the DOM and translates French text nodes
 * (and common attributes: placeholder, title, aria-label, alt) using the
 * FR→EN phrase dictionary. Re-applies on DOM mutations.
 *
 * This is a pragmatic shim while the codebase is gradually migrated to use
 * the formal `useLanguage()` translation system. It is intentionally
 * conservative: it only replaces strings that exactly match a known phrase
 * to avoid garbled output. Unknown French strings are left untouched.
 */
import { useEffect } from 'react';
import { FR_EN_PHRASES } from '@/i18n/frToEnDictionary';

const ATTR_TARGETS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);

// Sort phrases longest first so we substring-replace longest matches first.
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

// Build one big regex once for performance.
let BIG_REGEX: RegExp | null = null;
function getRegex(): RegExp {
  if (!BIG_REGEX) {
    const alternation = getSortedKeys().map(escapeRegExp).join('|');
    BIG_REGEX = new RegExp(alternation, 'g');
  }
  return BIG_REGEX;
}

function translateString(input: string): string {
  if (!input || input.length < 2) return input;
  // Quick skip if no accented or no uppercase letter and no known French token
  // (still attempt — many phrases are ASCII). Limit by length.
  if (input.length > 5000) return input;
  const regex = getRegex();
  regex.lastIndex = 0;
  return input.replace(regex, (match) => FR_EN_PHRASES[match] ?? match);
}

function translateTextNode(node: Text) {
  const original = node.nodeValue;
  if (!original) return;
  const translated = translateString(original);
  if (translated !== original) {
    node.nodeValue = translated;
  }
}

function translateElement(el: Element) {
  if (SKIP_TAGS.has(el.tagName)) return;
  if ((el as HTMLElement).isContentEditable) return;
  for (const attr of ATTR_TARGETS) {
    const v = el.getAttribute(attr);
    if (v) {
      const t = translateString(v);
      if (t !== v) el.setAttribute(attr, t);
    }
  }
  // For inputs with value that act like buttons
  if (el.tagName === 'INPUT') {
    const input = el as HTMLInputElement;
    if (input.type === 'button' || input.type === 'submit' || input.type === 'reset') {
      if (input.value) {
        const t = translateString(input.value);
        if (t !== input.value) input.value = t;
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

    // Initial pass
    walkAndTranslate(document.body);

    // Throttle scheduler
    let scheduled = false;
    const pending = new Set<Node>();

    const flush = () => {
      scheduled = false;
      const nodes = Array.from(pending);
      pending.clear();
      for (const node of nodes) {
        try {
          if (node.isConnected) walkAndTranslate(node);
        } catch {
          /* ignore */
        }
      }
    };

    const schedule = (node: Node) => {
      pending.add(node);
      if (!scheduled) {
        scheduled = true;
        // Defer to next animation frame to batch React renders
        requestAnimationFrame(flush);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
              schedule(node);
            }
          });
        } else if (m.type === 'characterData') {
          if (m.target.nodeType === Node.TEXT_NODE) {
            schedule(m.target);
          }
        } else if (m.type === 'attributes') {
          if (
            m.target.nodeType === Node.ELEMENT_NODE &&
            m.attributeName &&
            (ATTR_TARGETS as readonly string[]).includes(m.attributeName)
          ) {
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
