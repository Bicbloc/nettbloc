/**
 * UniversalParser v1.0
 * Parser universel qui détecte automatiquement le format (délimiteur, colonnes, statuts)
 * et parse n'importe quel rapport PMS en données structurées.
 */

import { ParsedRow, ParsedReportData, ColumnType, ColumnValue } from './ReportFormatDetector';

export interface UniversalParseResult {
  rows: ParsedRow[];
  detectedDelimiter: string;
  detectedColumns: DetectedColumn[];
  headerLine: string | null;
  rawLines: RawParsedLine[];
}

export interface DetectedColumn {
  index: number;
  name: string;
  type: ColumnType;
  sampleValues: string[];
}

export interface RawParsedLine {
  lineNumber: number;
  text: string;
  columns: string[];
  isRoom: boolean;
  roomNumber?: string;
  statusValue?: string;
}

// Expanded multilingual status dictionary
const STATUS_DICTIONARY: Record<string, { type: 'full' | 'quick' | 'none' | 'out_of_service'; lang: string }> = {
  // French
  'DEPART': { type: 'full', lang: 'fr' },
  'DÉPART': { type: 'full', lang: 'fr' },
  'PARTI': { type: 'full', lang: 'fr' },
  'A BLANC': { type: 'full', lang: 'fr' },
  'À BLANC': { type: 'full', lang: 'fr' },
  'BLANC': { type: 'full', lang: 'fr' },
  'LIBÉRÉ': { type: 'full', lang: 'fr' },
  'LIBRE': { type: 'full', lang: 'fr' },
  'VACANT': { type: 'full', lang: 'fr' },
  'RECOUCHE': { type: 'quick', lang: 'fr' },
  'DRAPS': { type: 'quick', lang: 'fr' },
  'OCCUPÉ': { type: 'quick', lang: 'fr' },
  'EN SÉJOUR': { type: 'quick', lang: 'fr' },
  'PROPRE': { type: 'none', lang: 'fr' },
  'INSPECTÉ': { type: 'none', lang: 'fr' },
  'INSPECTÉE': { type: 'none', lang: 'fr' },
  'HORS SERVICE': { type: 'out_of_service', lang: 'fr' },
  'EN ARRIVÉE': { type: 'full', lang: 'fr' },
  'ARRIVÉ': { type: 'quick', lang: 'fr' },
  'ARRIVÉE': { type: 'full', lang: 'fr' },
  'SALE': { type: 'full', lang: 'fr' },

  // English
  'CHECKOUT': { type: 'full', lang: 'en' },
  'CHECK-OUT': { type: 'full', lang: 'en' },
  'DEPARTURE': { type: 'full', lang: 'en' },
  'DEPARTED': { type: 'full', lang: 'en' },
  'STAYOVER': { type: 'quick', lang: 'en' },
  'STAY-OVER': { type: 'quick', lang: 'en' },
  'OCCUPIED': { type: 'quick', lang: 'en' },
  'CLEAN': { type: 'none', lang: 'en' },
  'INSPECTED': { type: 'none', lang: 'en' },
  'READY': { type: 'none', lang: 'en' },
  'DIRTY': { type: 'full', lang: 'en' },
  'OUT OF ORDER': { type: 'out_of_service', lang: 'en' },
  'MAINTENANCE': { type: 'out_of_service', lang: 'en' },
  'ARRIVAL': { type: 'full', lang: 'en' },
  'CHECKIN': { type: 'full', lang: 'en' },
  'CHECK-IN': { type: 'full', lang: 'en' },
  'VACANT': { type: 'full', lang: 'en' },

  // German
  'SAUBER': { type: 'none', lang: 'de' },
  'SCHMUTZIG': { type: 'full', lang: 'de' },
  'BELEGT': { type: 'quick', lang: 'de' },
  'FREI': { type: 'full', lang: 'de' },
  'ABREISE': { type: 'full', lang: 'de' },
  'ANREISE': { type: 'full', lang: 'de' },
  'BLEIBEND': { type: 'quick', lang: 'de' },

  // Spanish
  'LIMPIO': { type: 'none', lang: 'es' },
  'SUCIO': { type: 'full', lang: 'es' },
  'OCUPADO': { type: 'quick', lang: 'es' },
  'SALIDA': { type: 'full', lang: 'es' },
  'LLEGADA': { type: 'full', lang: 'es' },

  // PMS codes
  'DIR': { type: 'full', lang: 'pms' },
  'SAL': { type: 'full', lang: 'pms' },
  'INS': { type: 'none', lang: 'pms' },
  'PRO': { type: 'none', lang: 'pms' },
  'OCC': { type: 'quick', lang: 'pms' },
  'OOO': { type: 'out_of_service', lang: 'pms' },
  'OOS': { type: 'out_of_service', lang: 'pms' },
  // Opera codes
  'VD': { type: 'full', lang: 'pms' },   // Vacant Dirty
  'OD': { type: 'quick', lang: 'pms' },  // Occupied Dirty
  'VC': { type: 'none', lang: 'pms' },   // Vacant Clean
  'OC': { type: 'quick', lang: 'pms' },  // Occupied Clean
  'VR': { type: 'none', lang: 'pms' },   // Vacant Ready
  'DI': { type: 'full', lang: 'pms' },   // Dirty Inspected
  // Protel
  'C/O': { type: 'full', lang: 'pms' },
  'C/I': { type: 'full', lang: 'pms' },
  'S/O': { type: 'quick', lang: 'pms' },
};

/**
 * Detect the delimiter used in the text
 */
function detectDelimiter(text: string): string {
  const lines = text.split('\n').filter(l => l.trim().length > 5).slice(0, 20);
  
  const delimiters = [
    { char: '\t', name: 'tab' },
    { char: ';', name: 'semicolon' },
    { char: ',', name: 'comma' },
  ];
  
  for (const d of delimiters) {
    const counts = lines.map(l => (l.match(new RegExp(d.char === '\t' ? '\t' : `\\${d.char}`, 'g')) || []).length);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const consistent = counts.filter(c => Math.abs(c - avgCount) <= 1).length / counts.length;
    
    if (avgCount >= 2 && consistent > 0.6) {
      return d.char;
    }
  }
  
  // Check for multi-space delimiter
  const spaceConsistency = lines.filter(l => /\s{2,}/.test(l)).length / lines.length;
  if (spaceConsistency > 0.5) {
    return '  '; // multi-space
  }
  
  return ' '; // fallback: single space
}

/**
 * Detect header line using multilingual keywords
 */
function detectHeader(lines: string[]): { index: number; columns: string[]; delimiter: string } | null {
  const HEADER_KEYWORDS = [
    'chambre', 'room', 'zimmer', 'habitación',
    'statut', 'status', 'état', 'etat', 'estado',
    'type', 'typ', 'tipo',
    'client', 'guest', 'gast', 'huésped',
    'arrivée', 'arrival', 'anreise', 'llegada',
    'départ', 'departure', 'abreise', 'salida',
    'date', 'datum', 'fecha',
    'nuit', 'night', 'nacht', 'noche',
    'assigné', 'assigned', 'zugewiesen',
  ];
  
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim().toLowerCase();
    if (!line) continue;
    
    const matchCount = HEADER_KEYWORDS.filter(kw => line.includes(kw)).length;
    if (matchCount < 2) continue;
    
    // Try delimiters
    for (const delim of ['\t', ';', '  ']) {
      const cols = delim === '  ' 
        ? lines[i].split(/\s{2,}/).map(c => c.trim()).filter(Boolean)
        : lines[i].split(delim).map(c => c.trim()).filter(Boolean);
      
      if (cols.length >= 2) {
        return { index: i, columns: cols, delimiter: delim };
      }
    }
  }
  
  return null;
}

/**
 * Check if a value looks like a room number
 */
function isRoomNumber(value: string): boolean {
  const cleaned = value.trim();
  return /^\d{1,4}[A-Z]?$/.test(cleaned) && cleaned.length >= 1 && cleaned.length <= 5;
}

/**
 * Match a status value against the dictionary + custom mappings
 */
function matchStatus(value: string, customMappings?: Record<string, string>): { type: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown'; matched: string } {
  const upper = value.trim().toUpperCase();
  
  // Check custom mappings first
  if (customMappings && customMappings[upper]) {
    return { type: customMappings[upper] as any, matched: upper };
  }
  
  // Direct match
  if (STATUS_DICTIONARY[upper]) {
    return { type: STATUS_DICTIONARY[upper].type, matched: upper };
  }
  
  // Partial match (for compound statuses like "Départ + Arrivée")
  for (const [key, val] of Object.entries(STATUS_DICTIONARY)) {
    if (upper.includes(key)) {
      return { type: val.type, matched: key };
    }
  }
  
  return { type: 'unknown', matched: '' };
}

/**
 * Universal parse function - works with any text format
 */
export function universalParse(
  text: string,
  customStatusMappings?: Record<string, string>
): UniversalParseResult {
  const lines = text.split('\n');
  const delimiter = detectDelimiter(text);
  const header = detectHeader(lines);
  
  const rawLines: RawParsedLine[] = [];
  const rows: ParsedRow[] = [];
  const detectedColumns: DetectedColumn[] = [];
  
  // Determine room column and status column indices
  let roomColIdx = 0;
  let statusColIdx = -1;
  const startLine = header ? header.index + 1 : 0;
  
  if (header) {
    // Find room and status columns from header
    for (let i = 0; i < header.columns.length; i++) {
      const col = header.columns[i].toLowerCase();
      if (/chambre|room|zimmer|habitación|n°|ch\./i.test(col)) {
        roomColIdx = i;
      }
      if (/statut|status|état|etat|estado/i.test(col)) {
        statusColIdx = i;
      }
    }
    
    // Build detected columns from header
    header.columns.forEach((name, idx) => {
      detectedColumns.push({
        index: idx,
        name,
        type: detectColumnType(name),
        sampleValues: [],
      });
    });
  }
  
  // Parse each line
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue;
    if (isHeaderOrFooter(line)) continue;
    
    // Split into columns
    let columns: string[];
    if (delimiter === '  ') {
      columns = line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
    } else if (delimiter === ' ') {
      // Single space: try to intelligently split
      columns = line.split(/\s+/).filter(Boolean);
    } else {
      columns = line.split(delimiter).map(c => c.trim());
    }
    
    if (columns.length < 1) continue;
    
    // Try to find room number
    let roomNumber = '';
    let isRoom = false;
    
    if (header && columns.length > roomColIdx) {
      const candidate = columns[roomColIdx];
      if (isRoomNumber(candidate)) {
        roomNumber = candidate.trim();
        isRoom = true;
      }
    } else {
      // No header: try first column, then scan
      for (const col of columns) {
        if (isRoomNumber(col)) {
          roomNumber = col.trim();
          isRoom = true;
          break;
        }
      }
    }
    
    // Find status
    let statusValue = '';
    let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
    
    if (isRoom) {
      if (statusColIdx >= 0 && columns.length > statusColIdx) {
        const result = matchStatus(columns[statusColIdx], customStatusMappings);
        statusValue = columns[statusColIdx];
        detectedType = result.type;
      }
      
      // If no status from column, scan entire line
      if (detectedType === 'unknown') {
        const lineUpper = line.toUpperCase();
        for (const [key, val] of Object.entries(STATUS_DICTIONARY)) {
          if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lineUpper)) {
            statusValue = key;
            detectedType = val.type;
            break;
          }
        }
        // Also check custom mappings on full line
        if (detectedType === 'unknown' && customStatusMappings) {
          for (const [key, val] of Object.entries(customStatusMappings)) {
            if (lineUpper.includes(key.toUpperCase())) {
              statusValue = key;
              detectedType = val as any;
              break;
            }
          }
        }
      }
    }
    
    const rawParsedLine: RawParsedLine = {
      lineNumber: i,
      text: line,
      columns,
      isRoom,
      roomNumber: isRoom ? roomNumber : undefined,
      statusValue: statusValue || undefined,
    };
    rawLines.push(rawParsedLine);
    
    // Add detected column samples
    if (isRoom && detectedColumns.length > 0) {
      columns.forEach((val, idx) => {
        if (detectedColumns[idx] && detectedColumns[idx].sampleValues.length < 5) {
          if (!detectedColumns[idx].sampleValues.includes(val)) {
            detectedColumns[idx].sampleValues.push(val);
          }
        }
      });
    }
    
    if (isRoom && roomNumber) {
      const parsedRow: ParsedRow = {
        rawLine: line,
        roomNumber,
        roomType: '',
        cleaningStatus: statusValue,
        columns: columns.map((val, idx) => ({
          value: val,
          type: (detectedColumns[idx]?.type || 'other') as ColumnType,
          confidence: 0.5,
        })),
        detectedCleaningType: detectedType,
        confidence: detectedType !== 'unknown' ? 0.7 : 0.3,
        statusIndicator: statusValue,
        guestName: '',
        arrivalDate: '',
        departureDate: '',
        arrivalTime: '',
        departureTime: '',
        nightInfo: '',
        hasCurrentGuest: detectedType === 'quick',
        hasDepartingGuest: detectedType === 'full',
        hasArrivingGuest: false,
        isOutOfOrder: detectedType === 'out_of_service',
        assignee: '',
      };
      rows.push(parsedRow);
    }
  }
  
  return {
    rows,
    detectedDelimiter: delimiter,
    detectedColumns: detectedColumns.length > 0 ? detectedColumns : inferColumns(rawLines),
    headerLine: header ? lines[header.index] : null,
    rawLines,
  };
}

function detectColumnType(name: string): ColumnType {
  const lower = name.toLowerCase();
  if (/chambre|room|zimmer|n°|ch\./i.test(lower)) return 'room_number';
  if (/statut|status|état|etat/i.test(lower)) return 'status';
  if (/type/i.test(lower)) return 'room_type';
  if (/arrivée|arrival|anreise/i.test(lower)) return 'arrival_date';
  if (/départ|departure|abreise/i.test(lower)) return 'departure_date';
  if (/client|guest|gast|nom/i.test(lower)) return 'guest_name';
  if (/assigné|assigned|zugewiesen/i.test(lower)) return 'assignee';
  if (/nuit|night|nacht/i.test(lower)) return 'night_info';
  if (/étage|floor|stock/i.test(lower)) return 'floor';
  return 'other';
}

function isHeaderOrFooter(line: string): boolean {
  return /^(page|imprimé|total|résumé|summary|printed|\d+\s*\/\s*\d+\s*$|^[-=_|]{5,}$)/i.test(line);
}

function inferColumns(rawLines: RawParsedLine[]): DetectedColumn[] {
  // Infer from data if no header found
  const roomLines = rawLines.filter(l => l.isRoom);
  if (roomLines.length === 0) return [];
  
  const maxCols = Math.max(...roomLines.map(l => l.columns.length));
  const columns: DetectedColumn[] = [];
  
  for (let i = 0; i < maxCols; i++) {
    const values = roomLines.map(l => l.columns[i] || '').filter(Boolean);
    const uniqueValues = [...new Set(values)].slice(0, 5);
    
    // Heuristic type detection
    let type: ColumnType = 'other';
    const allNumeric = values.every(v => /^\d{1,4}[A-Z]?$/.test(v));
    const hasStatusWords = values.some(v => matchStatus(v).type !== 'unknown');
    const hasDates = values.some(v => /\d{2}[\/\.\-]\d{2}/.test(v));
    
    if (i === 0 && allNumeric) type = 'room_number';
    else if (hasStatusWords) type = 'status';
    else if (hasDates) type = 'arrival_date';
    
    columns.push({
      index: i,
      name: `Colonne ${i + 1}`,
      type,
      sampleValues: uniqueValues,
    });
  }
  
  return columns;
}

export { STATUS_DICTIONARY };
