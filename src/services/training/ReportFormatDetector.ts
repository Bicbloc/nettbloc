/**
 * Détecteur de format de rapport PMS v2.0
 * Analyse avancée avec détection multi-colonnes et prévisualisation
 */

export interface FormatDetection {
  format: ReportFormat;
  confidence: number;
  indicators: CleaningIndicator[];
  structure: ReportStructure;
  parsedData: ParsedReportData;
}

export interface CleaningIndicator {
  value: string;
  suggestedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude' | 'unknown';
  occurrences: number;
  context: string[];
}

export interface ParsedReportData {
  headers: string[];
  rows: ParsedRow[];
  summary: {
    totalRooms: number;
    departures: number;
    stayovers: number;
    arrivals: number;
    vacant: number;
    outOfService: number;
    unknown: number;
  };
}

export interface ParsedRow {
  rawLine: string;
  roomNumber: string;
  columns: ColumnValue[];
  detectedCleaningType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown';
  confidence: number;
  statusIndicator: string;
}

export interface ColumnValue {
  value: string;
  type: ColumnType;
  confidence: number;
}

export type ColumnType = 
  | 'room_number' 
  | 'status' 
  | 'room_type' 
  | 'arrival_date'
  | 'departure_date'
  | 'arrival_time'
  | 'departure_time'
  | 'guest_name'
  | 'guest_count'
  | 'assignee' 
  | 'floor'
  | 'notes' 
  | 'other';

export interface ReportStructure {
  hasTable: boolean;
  columnCount: number;
  suggestedColumns: ColumnDefinition[];
  roomNumberPattern: string;
  lineParseStrategy: 'table' | 'fixed-width' | 'delimiter' | 'complex';
  delimiter: string | null;
}

export interface ColumnDefinition {
  index: number;
  name: string;
  type: ColumnType;
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

// =========== RÈGLES DE NETTOYAGE AVANCÉES ===========
// Ces règles sont utilisées pour mapper les indicateurs vers les types de nettoyage

interface CleaningRule {
  patterns: RegExp[];
  cleaningType: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude';
  priority: number;
  description: string;
}

const CLEANING_RULES: CleaningRule[] = [
  // À blanc / Départ (priorité haute)
  {
    patterns: [
      /\b(départ|depart|parti|checkout|check-out|due\s*out|departure|libéré)\b/i,
      /\bDIR\b/,  // Mews: Dirty
      /\bSAL\b/,  // Sale
      /\b(VC|VD)\b/, // Vacant Clean/Dirty
    ],
    cleaningType: 'full',
    priority: 10,
    description: 'Départ / À blanc'
  },
  // Recouche / Séjour
  {
    patterns: [
      /\b(recouche|stayover|stay-over|séjour|occupied|occupé|occ)\b/i,
      /\bPRO\b/,  // Mews: Propre
      /\bINS\b/,  // Mews: Inspecté
      /\b(OC|OD)\b/, // Occupied Clean/Dirty
      /\bdraps\b/i,
    ],
    cleaningType: 'quick',
    priority: 10,
    description: 'Recouche / Séjour'
  },
  // Arrivée (compte comme à blanc si départ le même jour, sinon aucun)
  {
    patterns: [
      /\b(arrivée|arrival|check-?in|due\s*in)\b/i,
      /\bARR\b/,
    ],
    cleaningType: 'full', // Par défaut à blanc pour une arrivée
    priority: 5,
    description: 'Arrivée'
  },
  // Aucun nettoyage
  {
    patterns: [
      /\b(no\s*service|refus|dnd|do\s*not\s*disturb|skip|propre)\b/i,
      /\b(libre|free|vacant\s*clean)\b/i,
    ],
    cleaningType: 'none',
    priority: 8,
    description: 'Pas de ménage'
  },
  // Hors service
  {
    patterns: [
      /\b(ooo|out\s*of\s*order|hors\s*service|h\.?s\.?|maintenance|blocked?|fermé)\b/i,
    ],
    cleaningType: 'out_of_service',
    priority: 15,
    description: 'Hors service'
  },
  // Exclusions (pas des chambres)
  {
    patterns: [
      /\b(total|page|imprimé|literie|ferme.*vente|lit\s*double|lits?\s*simple)\b/i,
      /^\s*\d+\s+chambre/i,
      /^(floor|étage)\s+spaces/i,
    ],
    cleaningType: 'exclude',
    priority: 20,
    description: 'Ligne à exclure'
  },
];

// =========== DÉTECTION DE FORMAT ===========

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
    { patterns: [/\b(VD|OD|VC|OC)\b/], weight: 5 },
  ],
  generic_table: [
    { patterns: [/chambre|room/i], weight: 2 },
    { patterns: [/\d{2,4}\s+[A-Z]{2,}/], weight: 1 },
  ],
  unknown: [],
};

/**
 * Détecte le format et parse complètement le rapport
 */
export function detectReportFormat(text: string): FormatDetection {
  // 1. Détecter le format global
  const format = detectFormat(text);
  
  // 2. Analyser la structure (colonnes, délimiteurs)
  const structure = analyzeStructure(text, format);
  
  // 3. Parser toutes les lignes avec détection intelligente
  const parsedData = parseAllLines(text, structure, format);
  
  // 4. Extraire les indicateurs uniques trouvés
  const indicators = extractIndicators(parsedData);
  
  // 5. Calculer la confiance
  const confidence = calculateConfidence(parsedData, format);
  
  return {
    format,
    confidence,
    indicators,
    structure,
    parsedData,
  };
}

function detectFormat(text: string): ReportFormat {
  const formatScores = new Map<ReportFormat, number>();
  
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
  
  let bestFormat: ReportFormat = 'unknown';
  let bestScore = 0;
  
  for (const [format, score] of formatScores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestFormat = format;
    }
  }
  
  return bestScore >= 5 ? bestFormat : 'generic_table';
}

function analyzeStructure(text: string, format: ReportFormat): ReportStructure {
  const lines = text.split('\n').filter(l => l.trim());
  
  // Détecter le délimiteur principal
  const tabCount = lines.filter(l => l.includes('\t')).length;
  const pipeCount = lines.filter(l => (l.match(/\|/g) || []).length >= 2).length;
  const multiSpaceCount = lines.filter(l => /\s{3,}/.test(l)).length;
  
  let delimiter: string | null = null;
  let lineParseStrategy: 'table' | 'fixed-width' | 'delimiter' | 'complex' = 'complex';
  
  if (tabCount > lines.length * 0.3) {
    delimiter = '\t';
    lineParseStrategy = 'delimiter';
  } else if (pipeCount > lines.length * 0.3) {
    delimiter = '|';
    lineParseStrategy = 'table';
  } else if (multiSpaceCount > lines.length * 0.3) {
    delimiter = '  '; // Double space
    lineParseStrategy = 'fixed-width';
  }
  
  // Analyser les colonnes sur les premières lignes de données
  const suggestedColumns = analyzeColumns(lines, delimiter);
  
  return {
    hasTable: delimiter !== null,
    columnCount: suggestedColumns.length,
    suggestedColumns,
    roomNumberPattern: detectRoomPattern(lines),
    lineParseStrategy,
    delimiter,
  };
}

function detectRoomPattern(lines: string[]): string {
  const patterns = [
    /^(\d{3,4}[A-Z]?)\b/,
    /^(\d{1,2})\s+(\d{3})/,
    /^\s*(\d{3,4})\s+/,
  ];
  
  for (const pattern of patterns) {
    const matches = lines.filter(l => pattern.test(l.trim()));
    if (matches.length >= 5) {
      return pattern.source;
    }
  }
  
  return '^\\d{2,4}';
}

function analyzeColumns(lines: string[], delimiter: string | null): ColumnDefinition[] {
  const columns: ColumnDefinition[] = [];
  
  // Prendre des lignes de données (skip les premières qui sont souvent headers)
  const dataLines = lines.slice(3, 25).filter(l => /\d{2,4}/.test(l));
  
  if (dataLines.length === 0) return columns;
  
  // Split les lignes selon le délimiteur
  const splitLines = dataLines.map(l => {
    if (delimiter === '|') {
      return l.split('|').map(c => c.trim()).filter(c => c);
    } else if (delimiter === '\t') {
      return l.split('\t').map(c => c.trim());
    } else {
      // Split par espaces multiples
      return l.split(/\s{2,}/).map(c => c.trim()).filter(c => c);
    }
  });
  
  const maxCols = Math.max(...splitLines.map(l => l.length));
  
  for (let i = 0; i < maxCols; i++) {
    const values = splitLines.map(l => l[i] || '').filter(v => v.trim());
    const uniqueValues = [...new Set(values.map(v => v.trim()))].slice(0, 15);
    
    const colType = detectColumnType(uniqueValues, i);
    
    columns.push({
      index: i,
      name: getColumnName(colType, i),
      type: colType,
      isRelevantForCleaning: ['status', 'room_number', 'arrival_date', 'departure_date'].includes(colType),
      sampleValues: uniqueValues.slice(0, 5),
    });
  }
  
  return columns;
}

function detectColumnType(values: string[], index: number): ColumnType {
  if (values.length === 0) return 'other';
  
  // Analyse statistique des valeurs
  const stats = {
    roomNumbers: values.filter(v => /^\d{2,4}[A-Z]?$/.test(v.trim())).length,
    dates: values.filter(v => /\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?/.test(v)).length,
    times: values.filter(v => /^\d{1,2}[hH:]\d{2}$/.test(v.trim())).length,
    names: values.filter(v => /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][a-zàâäéèêëïîôùûü]+(\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ])?/.test(v) && v.length > 2 && v.length < 40).length,
    numbers: values.filter(v => /^\d{1,2}$/.test(v.trim())).length,
    status: 0,
    roomType: 0,
  };
  
  // Vérifier les statuts
  const statusKeywords = /\b(ins|pro|sal|dir|occ|vac|dep|arr|dirty|clean|depart|recouche|parti|draps|arrivée|libre|occupé|checkout)\b/i;
  stats.status = values.filter(v => statusKeywords.test(v)).length;
  
  // Vérifier les types de chambre
  const roomTypeKeywords = /\b(dbl|sgl|twn|twin|triple|quad|suite|fam|deluxe|standard|sup|pmr|chambre|single|double)\b/i;
  stats.roomType = values.filter(v => roomTypeKeywords.test(v)).length;
  
  const threshold = values.length * 0.3;
  
  // Priorité de détection
  if (index === 0 && stats.roomNumbers >= threshold) return 'room_number';
  if (stats.status >= threshold) return 'status';
  if (stats.roomType >= threshold) return 'room_type';
  
  // Distinguer dates d'arrivée et de départ selon la position
  if (stats.dates >= threshold) {
    // Chercher dans les valeurs si on peut distinguer
    return index <= 3 ? 'arrival_date' : 'departure_date';
  }
  
  if (stats.times >= threshold) return index <= 4 ? 'arrival_time' : 'departure_time';
  if (stats.names >= threshold) return 'guest_name';
  if (stats.numbers >= threshold && index > 0) return 'guest_count';
  if (stats.roomNumbers >= threshold) return 'room_number';
  
  // Floor si c'est un chiffre unique en position 0
  if (index === 0 && values.every(v => /^\d{1,2}$/.test(v.trim()))) return 'floor';
  
  return 'other';
}

function getColumnName(type: ColumnType, index: number): string {
  const names: Record<ColumnType, string> = {
    room_number: 'N° Chambre',
    status: 'Statut',
    room_type: 'Type',
    arrival_date: 'Date arrivée',
    departure_date: 'Date départ',
    arrival_time: 'Heure arrivée',
    departure_time: 'Heure départ',
    guest_name: 'Client',
    guest_count: 'Nb personnes',
    assignee: 'Assigné',
    floor: 'Étage',
    notes: 'Notes',
    other: `Col. ${index + 1}`,
  };
  return names[type];
}

// =========== PARSING DES LIGNES ===========

function parseAllLines(text: string, structure: ReportStructure, format: ReportFormat): ParsedReportData {
  const lines = text.split('\n');
  const rows: ParsedRow[] = [];
  
  // Extraire les headers potentiels
  const headers = extractHeaders(lines, structure);
  
  // Parser chaque ligne
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip les lignes vides ou trop courtes
    if (!trimmed || trimmed.length < 3) continue;
    
    // Skip les headers et footers
    if (isHeaderOrFooter(trimmed)) continue;
    
    // Essayer de parser comme une chambre
    const parsed = parseLine(line, trimmed, structure, format);
    
    if (parsed && parsed.roomNumber) {
      rows.push(parsed);
    }
  }
  
  // Calculer le résumé
  const summary = calculateSummary(rows);
  
  return { headers, rows, summary };
}

function extractHeaders(lines: string[], structure: ReportStructure): string[] {
  // Chercher la première ligne avec des labels de colonnes
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    
    // Vérifier si c'est une ligne de headers
    const headerKeywords = /\b(room|chambre|statut|status|type|date|arrivée|départ|client|guest|assignee|floor|étage)\b/i;
    if (headerKeywords.test(line)) {
      // Split selon le délimiteur
      if (structure.delimiter === '|') {
        return line.split('|').map(h => h.trim()).filter(h => h);
      } else if (structure.delimiter === '\t') {
        return line.split('\t').map(h => h.trim());
      } else {
        return line.split(/\s{2,}/).map(h => h.trim()).filter(h => h);
      }
    }
  }
  
  return structure.suggestedColumns.map(c => c.name);
}

function isHeaderOrFooter(line: string): boolean {
  const patterns = [
    /^(page|imprimé|total|résumé|summary|printed)/i,
    /^\d+\s+chambre\(s\)/i,
    /^(floor|étage)\s+spaces/i,
    /fermé\s+à\s+la\s+vente/i,
    /^[-=_]{5,}$/,
    /^\|[-\s|]+\|$/,
    /literie\s+\d+\s*×/i,
    /\d+\s*×\s*lit/i,
    /^#\s+ETAT\s+MEMO/i, // Header Medialog
    /^Ch\.\s+Type\s+Arrivée/i, // Header Apaleo
  ];
  
  return patterns.some(p => p.test(line));
}

function parseLine(line: string, trimmed: string, structure: ReportStructure, format: ReportFormat): ParsedRow | null {
  // Extraire le numéro de chambre
  const roomMatch = trimmed.match(/^(\d{1,2}\s+)?(\d{2,4}[A-Z]?)/);
  if (!roomMatch) return null;
  
  const roomNumber = roomMatch[2] || roomMatch[1]?.trim();
  if (!roomNumber) return null;
  
  // Split la ligne en colonnes
  let parts: string[];
  if (structure.delimiter === '|') {
    parts = line.split('|').map(p => p.trim()).filter(p => p);
  } else if (structure.delimiter === '\t') {
    parts = line.split('\t').map(p => p.trim());
  } else {
    parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
  }
  
  // Mapper les colonnes avec leurs types
  const columns: ColumnValue[] = parts.map((value, idx) => {
    const colDef = structure.suggestedColumns[idx];
    return {
      value,
      type: colDef?.type || 'other',
      confidence: colDef ? 0.8 : 0.3,
    };
  });
  
  // Détecter le type de nettoyage
  const { cleaningType, statusIndicator, confidence } = detectCleaningType(line, columns);
  
  return {
    rawLine: line,
    roomNumber,
    columns,
    detectedCleaningType: cleaningType,
    confidence,
    statusIndicator,
  };
}

function detectCleaningType(line: string, columns: ColumnValue[]): { 
  cleaningType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown';
  statusIndicator: string;
  confidence: number;
} {
  // Chercher d'abord dans la colonne status
  const statusColumn = columns.find(c => c.type === 'status');
  const searchText = statusColumn?.value || line;
  
  let bestMatch: { type: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown'; indicator: string; priority: number } = {
    type: 'unknown',
    indicator: '',
    priority: -1,
  };
  
  for (const rule of CLEANING_RULES) {
    if (rule.cleaningType === 'exclude') continue; // Ne pas marquer comme excluded ici
    
    for (const pattern of rule.patterns) {
      const match = searchText.match(pattern);
      if (match && rule.priority > bestMatch.priority) {
        bestMatch = {
          type: rule.cleaningType as 'full' | 'quick' | 'none' | 'out_of_service',
          indicator: match[0],
          priority: rule.priority,
        };
      }
    }
  }
  
  // Si pas trouvé dans status, chercher dans toute la ligne
  if (bestMatch.type === 'unknown') {
    for (const rule of CLEANING_RULES) {
      if (rule.cleaningType === 'exclude') continue;
      
      for (const pattern of rule.patterns) {
        const match = line.match(pattern);
        if (match && rule.priority > bestMatch.priority) {
          bestMatch = {
            type: rule.cleaningType as 'full' | 'quick' | 'none' | 'out_of_service',
            indicator: match[0],
            priority: rule.priority,
          };
        }
      }
    }
  }
  
  return {
    cleaningType: bestMatch.type,
    statusIndicator: bestMatch.indicator,
    confidence: bestMatch.priority > 0 ? Math.min(0.95, 0.5 + bestMatch.priority * 0.05) : 0.3,
  };
}

function extractIndicators(parsedData: ParsedReportData): CleaningIndicator[] {
  const indicatorMap = new Map<string, { type: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude' | 'unknown'; count: number; contexts: string[] }>();
  
  for (const row of parsedData.rows) {
    if (!row.statusIndicator) continue;
    
    const key = row.statusIndicator.toUpperCase();
    const existing = indicatorMap.get(key);
    
    if (existing) {
      existing.count++;
      if (existing.contexts.length < 3) {
        existing.contexts.push(row.rawLine.substring(0, 80));
      }
    } else {
      indicatorMap.set(key, {
        type: row.detectedCleaningType === 'unknown' ? 'unknown' : row.detectedCleaningType,
        count: 1,
        contexts: [row.rawLine.substring(0, 80)],
      });
    }
  }
  
  const indicators: CleaningIndicator[] = [];
  for (const [value, data] of indicatorMap.entries()) {
    indicators.push({
      value,
      suggestedType: data.type,
      occurrences: data.count,
      context: data.contexts,
    });
  }
  
  return indicators.sort((a, b) => b.occurrences - a.occurrences);
}

function calculateSummary(rows: ParsedRow[]): ParsedReportData['summary'] {
  const summary = {
    totalRooms: rows.length,
    departures: 0,
    stayovers: 0,
    arrivals: 0,
    vacant: 0,
    outOfService: 0,
    unknown: 0,
  };
  
  for (const row of rows) {
    switch (row.detectedCleaningType) {
      case 'full':
        // Distinguer départs et arrivées si possible
        if (/arrivée|arrival|arr/i.test(row.statusIndicator)) {
          summary.arrivals++;
        } else {
          summary.departures++;
        }
        break;
      case 'quick':
        summary.stayovers++;
        break;
      case 'none':
        summary.vacant++;
        break;
      case 'out_of_service':
        summary.outOfService++;
        break;
      default:
        summary.unknown++;
    }
  }
  
  return summary;
}

function calculateConfidence(parsedData: ParsedReportData, format: ReportFormat): number {
  const total = parsedData.rows.length;
  if (total === 0) return 0;
  
  const known = total - parsedData.summary.unknown;
  const knownRatio = known / total;
  
  // Bonus si format reconnu
  const formatBonus = format !== 'unknown' && format !== 'generic_table' ? 0.1 : 0;
  
  return Math.min(100, Math.round((knownRatio + formatBonus) * 100));
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
      description: 'Format tabulaire standard détecté automatiquement',
    },
    unknown: {
      name: 'Format inconnu',
      description: 'Format non reconnu - utilisation du parsing générique',
    },
  };
  return descriptions[format];
}
