/**
 * Service centralisé de prétraitement du texte PDF
 * Élimine la duplication entre pdfService, GenericAdapter et ApaleoAdapter
 */

export interface PreprocessingResult {
  text: string;
  stats: {
    originalLength: number;
    processedLength: number;
    linesAdded: number;
    patternsApplied: string[];
  };
}

// Patterns de prétraitement avec métadonnées
const PREPROCESSING_PATTERNS = [
  // Pattern 1: Numéro de chambre au début du texte
  {
    name: 'room_start',
    pattern: /^(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/im,
    replacement: '\n$1 $2'
  },
  // Pattern 2: Format tableau - numéro + "Chambre"
  {
    name: 'table_format',
    pattern: /(^|\n|\s)(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/gim,
    replacement: '\n$2 $3'
  },
  // Pattern 3: Après statut + numéro + "Chambre"
  {
    name: 'status_room',
    pattern: /(Sale|Parti|Recouche|Arrivé|Arrivée|En arrivée|A contrôler|Propre|A blanc|Dirty|Clean|Checkout|Arrival|Departure|Stayover)\s+(0?\d{1,3})\s+(Chambre)/gi,
    replacement: '$1\n$2 $3'
  },
  // Pattern 4: Pagination + numéro 01-09
  {
    name: 'pagination',
    pattern: /(\s)(\d)\s+(0[1-9])\s+(Chambre)/gi,
    replacement: '$1$2\n$3 $4'
  },
  // Pattern 5: Nombre + numéro chambre avec zéro
  {
    name: 'number_room',
    pattern: /(\d)\s+(0[1-9])\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/gi,
    replacement: '$1\n$2 $3'
  },
  // Pattern 6: Format "Ch. NN"
  {
    name: 'ch_format',
    pattern: /(Ch\.?\s*)(0?\d{1,3})(\s+(?:Chambre|Type))/gi,
    replacement: '\n$1$2$3'
  },
  // Pattern 7: Après parenthèse + numéro
  {
    name: 'after_paren',
    pattern: /(\))\s*(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/gi,
    replacement: '$1\n$2 $3'
  },
  // Pattern 8: Après code tarif + numéro
  {
    name: 'rate_code',
    pattern: /(NR|RO|BB|FLEX|HB|FB|AI)\s+(0?\d{1,2})\s+(Chambre)/gi,
    replacement: '$1\n$2 $3'
  },
  // Pattern 9: "Room" ou "R" + numéro
  {
    name: 'room_keyword',
    pattern: /(Room|R)\s*#?\s*(\d{1,4})\b/gi,
    replacement: '\n$1 $2'
  },
  // Pattern 10: Après statut Opera/Mews
  {
    name: 'pms_status',
    pattern: /(VD|VC|OD|OC|DUE OUT|DUE IN|INSPECTED|DIRTY|CLEAN)\s+(\d{1,4})\b/gi,
    replacement: '$1\n$2'
  }
];

// Patterns de dates à nettoyer
const DATE_PATTERNS = [
  /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
  /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,
  /\b\d{1,2}:\d{2}(:\d{2})?\b/g,
  /\b(19|20)\d{2}\b/g,
];

class TextPreprocessor {
  private cache = new Map<string, PreprocessingResult>();
  private maxCacheSize = 50;

  /**
   * Prétraite le texte pour séparer les chambres concaténées
   */
  preprocess(text: string, options?: { cleanDates?: boolean }): PreprocessingResult {
    // Vérifier le cache
    const cacheKey = `${text.substring(0, 100)}_${text.length}_${options?.cleanDates}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    let processed = text;
    const patternsApplied: string[] = [];
    let linesAdded = 0;

    // Appliquer les patterns de séparation
    for (const { name, pattern, replacement } of PREPROCESSING_PATTERNS) {
      const before = processed;
      processed = processed.replace(pattern, replacement);
      if (before !== processed) {
        patternsApplied.push(name);
        linesAdded += (processed.match(/\n/g) || []).length - (before.match(/\n/g) || []).length;
      }
    }

    // Optionnel: nettoyer les dates
    if (options?.cleanDates) {
      for (const pattern of DATE_PATTERNS) {
        processed = processed.replace(pattern, ' ');
      }
    }

    const result: PreprocessingResult = {
      text: processed,
      stats: {
        originalLength: text.length,
        processedLength: processed.length,
        linesAdded,
        patternsApplied
      }
    };

    // Mettre en cache avec gestion de taille
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Nettoie une ligne en retirant les dates/heures
   */
  cleanLine(line: string): string {
    let cleaned = line;
    for (const pattern of DATE_PATTERNS) {
      cleaned = cleaned.replace(pattern, ' ');
    }
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  /**
   * Vérifie si une ligne est un en-tête ou métadonnée
   */
  isHeaderLine(line: string): boolean {
    const lowerLine = line.toLowerCase();
    
    const headerKeywords = [
      'date', 'rapport', 'report', 'hôtel', 'hotel', 'page', 
      'total', 'généré', 'generated', 'imprimé', 'printed',
      'housekeeping', 'cleaning list', 'room list', 'summary',
      'résumé', 'statistics', 'statistiques'
    ];
    
    if (headerKeywords.some(kw => lowerLine.includes(kw))) {
      const digitCount = (line.match(/\d/g) || []).length;
      const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
      if (letterCount > digitCount * 2) return true;
    }
    
    // Patterns d'en-tête explicites
    const headerPatterns = [
      /^(date|room|chambre|status|statut|type|floor|étage|guest|client|name|nom)/i,
      /page\s*\d+\s*(of|de|\/)?\s*\d*/i,
      /^\s*total\s*:/i,
    ];
    
    return headerPatterns.some(p => p.test(line));
  }

  /**
   * Vide le cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton
export const textPreprocessor = new TextPreprocessor();
