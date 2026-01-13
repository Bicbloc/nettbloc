/**
 * Détecteur de format de rapport PMS
 * Analyse le texte brut pour identifier le format et les indicateurs de nettoyage
 */

export interface FormatDetection {
  format: ReportFormat;
  confidence: number;
  indicators: CleaningIndicator[];
  structure: ReportStructure;
}

export interface CleaningIndicator {
  value: string;
  suggestedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude' | 'unknown';
  occurrences: number;
  context: string[];
}

export interface ReportStructure {
  hasTable: boolean;
  columnCount: number;
  suggestedColumns: ColumnDefinition[];
  roomNumberPattern: string;
  lineParseStrategy: 'table' | 'fixed-width' | 'delimiter' | 'complex';
}

export interface ColumnDefinition {
  index: number;
  name: string;
  type: 'room_number' | 'status' | 'room_type' | 'date' | 'time' | 'guest' | 'assignee' | 'notes' | 'other';
  isRelevantForCleaning: boolean;
  sampleValues: string[];
}

export type ReportFormat = 
  | 'mews_space_status'     // INS/PRO/SAL/DIR codes
  | 'apaleo_housekeeping'   // Recouche/Parti/En arrivée
  | 'medialog_etat'         // PARTI/RECOUCHE/DEPART/DRAPS
  | 'opera_housekeeping'    // Various Opera formats
  | 'generic_table'         // Generic tabular format
  | 'unknown';

// Patterns de détection pour chaque format
const FORMAT_SIGNATURES: Record<ReportFormat, { patterns: RegExp[]; weight: number }[]> = {
  mews_space_status: [
    { patterns: [/Space\s+status/i, /Statut\s+des\s+espaces/i], weight: 10 },
    { patterns: [/\b(INS|PRO|SAL|DIR)\b/], weight: 5 },
    { patterns: [/Floor\s+Spaces/i, /Étage\s+Espaces/i], weight: 8 },
    { patterns: [/×\s*Adult/i, /×\s*Adulte/i], weight: 3 },
  ],
  apaleo_housekeeping: [
    { patterns: [/Rapport\s+Housekeeping/i], weight: 10 },
    { patterns: [/\b(Recouche|Parti|En\s+arrivée)\b/i], weight: 5 },
    { patterns: [/A\s+contrôler/i], weight: 3 },
    { patterns: [/Type\s+de\s+chambre/i], weight: 3 },
  ],
  medialog_etat: [
    { patterns: [/L'état\s+des\s+chambres/i, /état\s+des\s+chambres/i], weight: 10 },
    { patterns: [/\b(PARTI|RECOUCHE|DEPART|DRAPS)\b/], weight: 8 },
    { patterns: [/Medialog/i], weight: 10 },
    { patterns: [/MEMO\s+GOUVERNANTE/i], weight: 5 },
    { patterns: [/S\s*=\s*Sale/i], weight: 5 },
  ],
  opera_housekeeping: [
    { patterns: [/Opera/i, /Oracle/i], weight: 8 },
    { patterns: [/Housekeeping\s+Report/i], weight: 5 },
    { patterns: [/\b(VD|OD|VC|OC)\b/], weight: 5 }, // Vacant Dirty, Occupied Dirty, etc.
  ],
  generic_table: [
    { patterns: [/chambre|room/i], weight: 2 },
    { patterns: [/\d{2,4}\s+[A-Z]{2,}/], weight: 1 },
  ],
  unknown: [],
};

// Indicateurs de type de nettoyage par format
const CLEANING_INDICATORS: Record<string, { type: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude', keywords: string[] }> = {
  // À blanc (nettoyage complet)
  full_departure: { type: 'full', keywords: ['départ', 'depart', 'parti', 'checkout', 'check-out', 'due out', 'departure'] },
  full_dirty: { type: 'full', keywords: ['sal', 'sale', 'dirty', 'dir'] },
  full_vacant: { type: 'full', keywords: ['vac', 'vacant', 'libre'] },
  
  // Recouche (nettoyage rapide)
  quick_stay: { type: 'quick', keywords: ['recouche', 'stayover', 'stay', 'occupied', 'occupé', 'occ'] },
  quick_pro: { type: 'quick', keywords: ['pro', 'propre'] },
  quick_draps: { type: 'quick', keywords: ['draps', 'linge'] },
  quick_ins: { type: 'quick', keywords: ['ins', 'inspected', 'inspecté'] },
  
  // Aucun nettoyage
  none_clean: { type: 'none', keywords: ['clean', 'no service', 'refus ménage', 'dnd', 'do not disturb'] },
  
  // Hors service
  oos: { type: 'out_of_service', keywords: ['ooo', 'out of order', 'hors service', 'maintenance', 'fermé', 'blocked'] },
  
  // Exclusions (pas des chambres)
  exclude_lines: { type: 'exclude', keywords: ['total', 'page', 'imprimé', 'literie', 'fermé à la vente', 'lit double', 'lits simple'] },
};

/**
 * Détecte le format d'un rapport PMS
 */
export function detectReportFormat(text: string): FormatDetection {
  const formatScores = new Map<ReportFormat, number>();
  
  // Calculer les scores pour chaque format
  for (const [format, signatures] of Object.entries(FORMAT_SIGNATURES)) {
    let score = 0;
    for (const sig of signatures) {
      for (const pattern of sig.patterns) {
        if (pattern.test(text)) {
          score += sig.weight;
        }
      }
    }
    formatScores.set(format as ReportFormat, score);
  }
  
  // Trouver le meilleur format
  let bestFormat: ReportFormat = 'unknown';
  let bestScore = 0;
  
  for (const [format, score] of formatScores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestFormat = format;
    }
  }
  
  // Calculer la confiance (0-100)
  const maxPossibleScore = Object.values(FORMAT_SIGNATURES)
    .flat()
    .reduce((sum, sig) => sum + sig.weight, 0);
  const confidence = Math.min(100, Math.round((bestScore / 30) * 100));
  
  // Détecter les indicateurs de nettoyage présents
  const indicators = detectCleaningIndicators(text);
  
  // Analyser la structure
  const structure = analyzeStructure(text, bestFormat);
  
  return {
    format: bestFormat,
    confidence,
    indicators,
    structure,
  };
}

/**
 * Détecte tous les indicateurs de nettoyage dans le texte
 */
function detectCleaningIndicators(text: string): CleaningIndicator[] {
  const indicators: CleaningIndicator[] = [];
  const lines = text.split('\n');
  
  // Trouver tous les mots/codes uniques qui ressemblent à des statuts
  const potentialStatuses = new Map<string, { count: number; contexts: string[]; type: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude' | 'unknown' }>();
  
  // Patterns à extraire
  const statusPatterns = [
    /\b(INS|PRO|SAL|DIR|OCC|VAC|DEP|ARR)\b/gi,
    /\b(PARTI|RECOUCHE|DEPART|DRAPS|ARRIVÉE?|LIBRE)\b/gi,
    /\b(Dirty|Clean|Inspected|Vacant|Occupied)\b/gi,
    /\b(Check-?out|Check-?in|Stayover|Due\s+out)\b/gi,
    /\b(A\s+contrôler|A\s+nettoyer|Propre|Sale)\b/gi,
  ];
  
  for (const line of lines) {
    for (const pattern of statusPatterns) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const value = match[0].toUpperCase().trim();
        
        if (!potentialStatuses.has(value)) {
          // Déterminer le type suggéré
          let suggestedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude' | 'unknown' = 'unknown';
          
          for (const [, config] of Object.entries(CLEANING_INDICATORS)) {
            if (config.keywords.some(k => value.toLowerCase().includes(k.toLowerCase()))) {
              suggestedType = config.type;
              break;
            }
          }
          
          potentialStatuses.set(value, { count: 0, contexts: [], type: suggestedType });
        }
        
        const entry = potentialStatuses.get(value)!;
        entry.count++;
        if (entry.contexts.length < 3) {
          entry.contexts.push(line.substring(0, 100).trim());
        }
      }
    }
  }
  
  // Convertir en tableau
  for (const [value, data] of potentialStatuses.entries()) {
    indicators.push({
      value,
      suggestedType: data.type,
      occurrences: data.count,
      context: data.contexts,
    });
  }
  
  // Trier par occurrences
  indicators.sort((a, b) => b.occurrences - a.occurrences);
  
  return indicators;
}

/**
 * Analyse la structure du rapport
 */
function analyzeStructure(text: string, format: ReportFormat): ReportStructure {
  const lines = text.split('\n').filter(l => l.trim());
  
  // Détecter le pattern de numéro de chambre
  const roomPatterns = [
    /^(\d{3,4}[A-Z]?)\s/,           // 101, 102A
    /^(\d{1,2})\s+(\d{3})/,          // Floor + Room: 1 101
    /^\s*(\d{3,4})\s+/,              // With leading space
    /Room\s+(\d+)/i,                  // Room 101
    /Ch\.?\s*(\d+)/i,                 // Ch. 101
  ];
  
  let detectedPattern = '';
  let roomNumberPattern = /^\d{2,4}[A-Z]?/;
  
  for (const pattern of roomPatterns) {
    const matches = lines.filter(l => pattern.test(l));
    if (matches.length >= 3) {
      detectedPattern = pattern.source;
      roomNumberPattern = pattern;
      break;
    }
  }
  
  // Analyser la structure des colonnes
  const columnAnalysis = analyzeColumns(lines, format);
  
  // Déterminer la stratégie de parsing
  let lineParseStrategy: 'table' | 'fixed-width' | 'delimiter' | 'complex' = 'complex';
  
  // Vérifier si c'est un tableau avec délimiteurs
  const tabDelimited = lines.filter(l => l.includes('\t')).length > lines.length * 0.3;
  const pipeDelimited = lines.filter(l => l.includes('|')).length > lines.length * 0.3;
  const multiSpace = lines.filter(l => /\s{3,}/.test(l)).length > lines.length * 0.5;
  
  if (tabDelimited) {
    lineParseStrategy = 'delimiter';
  } else if (pipeDelimited) {
    lineParseStrategy = 'table';
  } else if (multiSpace) {
    lineParseStrategy = 'fixed-width';
  }
  
  return {
    hasTable: tabDelimited || pipeDelimited || multiSpace,
    columnCount: columnAnalysis.length,
    suggestedColumns: columnAnalysis,
    roomNumberPattern: detectedPattern,
    lineParseStrategy,
  };
}

/**
 * Analyse les colonnes probables
 */
function analyzeColumns(lines: string[], format: ReportFormat): ColumnDefinition[] {
  const columns: ColumnDefinition[] = [];
  
  // Prendre des lignes de données (ignorer headers)
  const dataLines = lines.slice(2, 20).filter(l => /^\s*\d/.test(l));
  
  if (dataLines.length === 0) return columns;
  
  // Split par espaces multiples ou tabs
  const splitLines = dataLines.map(l => l.split(/\s{2,}|\t/).filter(c => c.trim()));
  const maxCols = Math.max(...splitLines.map(l => l.length));
  
  for (let i = 0; i < maxCols; i++) {
    const values = splitLines.map(l => l[i] || '').filter(v => v.trim());
    const uniqueValues = [...new Set(values.map(v => v.trim()))].slice(0, 10);
    
    // Déterminer le type de colonne
    const colType = detectColumnType(uniqueValues, i);
    
    columns.push({
      index: i,
      name: getColumnName(colType, i),
      type: colType,
      isRelevantForCleaning: ['status', 'room_number'].includes(colType),
      sampleValues: uniqueValues.slice(0, 5),
    });
  }
  
  return columns;
}

/**
 * Détecte le type d'une colonne basé sur ses valeurs
 */
function detectColumnType(values: string[], index: number): ColumnDefinition['type'] {
  if (values.length === 0) return 'other';
  
  // Numéro de chambre (première colonne souvent)
  if (index === 0) {
    const roomNumbers = values.filter(v => /^\d{2,4}[A-Z]?/.test(v));
    if (roomNumbers.length >= values.length * 0.5) return 'room_number';
  }
  
  // Statuts PMS
  const statusKeywords = ['ins', 'pro', 'sal', 'dir', 'occ', 'vac', 'dep', 'arr', 'dirty', 'clean', 'depart', 'recouche', 'parti', 'draps', 'arrivée'];
  const statusMatches = values.filter(v => statusKeywords.some(k => v.toLowerCase().includes(k)));
  if (statusMatches.length >= values.length * 0.3) return 'status';
  
  // Types de chambre
  const roomTypes = ['dbl', 'sgl', 'twn', 'twin', 'triple', 'quad', 'suite', 'fam', 'deluxe', 'standard', 'sup', 'pmr'];
  const typeMatches = values.filter(v => roomTypes.some(t => v.toLowerCase().includes(t)));
  if (typeMatches.length >= values.length * 0.3) return 'room_type';
  
  // Dates
  const dateMatches = values.filter(v => /\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?/.test(v));
  if (dateMatches.length >= values.length * 0.4) return 'date';
  
  // Horaires
  const timeMatches = values.filter(v => /^\d{1,2}[hH:]\d{2}/.test(v.trim()));
  if (timeMatches.length >= values.length * 0.3) return 'time';
  
  // Noms (prénom + nom)
  const nameMatches = values.filter(v => /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][a-zàâäéèêëïîôùûü]+/.test(v) && v.length > 3);
  if (nameMatches.length >= values.length * 0.3) return 'guest';
  
  // Email = assignee
  const emailMatches = values.filter(v => v.includes('@'));
  if (emailMatches.length >= values.length * 0.2) return 'assignee';
  
  return 'other';
}

/**
 * Génère un nom lisible pour le type de colonne
 */
function getColumnName(type: ColumnDefinition['type'], index: number): string {
  const names: Record<ColumnDefinition['type'], string> = {
    room_number: 'N° Chambre',
    status: 'Statut',
    room_type: 'Type',
    date: 'Date',
    time: 'Heure',
    guest: 'Client',
    assignee: 'Assigné',
    notes: 'Notes',
    other: `Col. ${index + 1}`,
  };
  return names[type];
}

/**
 * Obtient une description utilisateur du format détecté
 */
export function getFormatDescription(format: ReportFormat): { name: string; description: string } {
  const descriptions: Record<ReportFormat, { name: string; description: string }> = {
    mews_space_status: {
      name: 'Mews Space Status',
      description: 'Rapport avec codes INS/PRO/SAL/DIR pour les statuts',
    },
    apaleo_housekeeping: {
      name: 'Apaleo Housekeeping',
      description: 'Rapport avec Recouche/Parti/En arrivée',
    },
    medialog_etat: {
      name: 'Medialog État des chambres',
      description: 'Format français avec PARTI/RECOUCHE/DEPART/DRAPS',
    },
    opera_housekeeping: {
      name: 'Opera Housekeeping',
      description: 'Format Oracle Opera avec codes VD/OD/VC/OC',
    },
    generic_table: {
      name: 'Tableau générique',
      description: 'Format tabulaire standard',
    },
    unknown: {
      name: 'Format inconnu',
      description: 'Format non reconnu automatiquement',
    },
  };
  return descriptions[format];
}
