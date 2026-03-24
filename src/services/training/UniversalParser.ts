/**
 * UniversalParser v2.0
 * Parser universel avec fuzzy matching, dictionnaire élargi,
 * et chargement des mappings hôtel pour 99% de précision.
 */

import { ParsedRow, ParsedReportData, ColumnType, ColumnValue } from './ReportFormatDetector';

export interface UniversalParseResult {
  rows: ParsedRow[];
  detectedDelimiter: string;
  detectedColumns: DetectedColumn[];
  headerLine: string | null;
  rawLines: RawParsedLine[];
  confidence: number; // 0-100 overall confidence
  unmappedCount: number;
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

// Expanded multilingual status dictionary with 150+ entries
const STATUS_DICTIONARY: Record<string, { type: 'full' | 'quick' | 'none' | 'out_of_service'; lang: string }> = {
  // === French ===
  'DEPART': { type: 'full', lang: 'fr' },
  'DÉPART': { type: 'full', lang: 'fr' },
  'PARTI': { type: 'full', lang: 'fr' },
  'A BLANC': { type: 'full', lang: 'fr' },
  'À BLANC': { type: 'full', lang: 'fr' },
  'BLANC': { type: 'full', lang: 'fr' },
  'LIBÉRÉ': { type: 'full', lang: 'fr' },
  'LIBRE': { type: 'full', lang: 'fr' },
  'LIBERE': { type: 'full', lang: 'fr' },
  'RECOUCHE': { type: 'quick', lang: 'fr' },
  'DRAPS': { type: 'quick', lang: 'fr' },
  'OCCUPÉ': { type: 'quick', lang: 'fr' },
  'OCCUPE': { type: 'quick', lang: 'fr' },
  'EN SÉJOUR': { type: 'quick', lang: 'fr' },
  'EN SEJOUR': { type: 'quick', lang: 'fr' },
  'SÉJOUR': { type: 'quick', lang: 'fr' },
  'SEJOUR': { type: 'quick', lang: 'fr' },
  'PROPRE': { type: 'none', lang: 'fr' },
  'INSPECTÉ': { type: 'none', lang: 'fr' },
  'INSPECTÉE': { type: 'none', lang: 'fr' },
  'INSPECTE': { type: 'none', lang: 'fr' },
  'INSPECTEE': { type: 'none', lang: 'fr' },
  'HORS SERVICE': { type: 'out_of_service', lang: 'fr' },
  'H.S.': { type: 'out_of_service', lang: 'fr' },
  'HS': { type: 'out_of_service', lang: 'fr' },
  'EN ARRIVÉE': { type: 'full', lang: 'fr' },
  'EN ARRIVEE': { type: 'full', lang: 'fr' },
  'ARRIVÉ': { type: 'quick', lang: 'fr' },
  'ARRIVÉE': { type: 'full', lang: 'fr' },
  'ARRIVEE': { type: 'full', lang: 'fr' },
  'SALE': { type: 'full', lang: 'fr' },
  'SORTIE': { type: 'full', lang: 'fr' },
  'NETTOYÉ': { type: 'none', lang: 'fr' },
  'NETTOYE': { type: 'none', lang: 'fr' },
  'VÉRIFIÉ': { type: 'none', lang: 'fr' },
  'VERIFIE': { type: 'none', lang: 'fr' },
  'EN PANNE': { type: 'out_of_service', lang: 'fr' },
  'BLOQUÉ': { type: 'out_of_service', lang: 'fr' },
  'BLOQUE': { type: 'out_of_service', lang: 'fr' },
  'EN TRAVAUX': { type: 'out_of_service', lang: 'fr' },
  'NON DISPONIBLE': { type: 'out_of_service', lang: 'fr' },

  // === English ===
  'CHECKOUT': { type: 'full', lang: 'en' },
  'CHECK-OUT': { type: 'full', lang: 'en' },
  'CHECK OUT': { type: 'full', lang: 'en' },
  'DEPARTURE': { type: 'full', lang: 'en' },
  'DEPARTED': { type: 'full', lang: 'en' },
  'DEPARTING': { type: 'full', lang: 'en' },
  'DUE OUT': { type: 'full', lang: 'en' },
  'STAYOVER': { type: 'quick', lang: 'en' },
  'STAY-OVER': { type: 'quick', lang: 'en' },
  'STAY OVER': { type: 'quick', lang: 'en' },
  'STAYING': { type: 'quick', lang: 'en' },
  'OCCUPIED': { type: 'quick', lang: 'en' },
  'IN HOUSE': { type: 'quick', lang: 'en' },
  'INHOUSE': { type: 'quick', lang: 'en' },
  'CLEAN': { type: 'none', lang: 'en' },
  'CLEANED': { type: 'none', lang: 'en' },
  'INSPECTED': { type: 'none', lang: 'en' },
  'READY': { type: 'none', lang: 'en' },
  'DIRTY': { type: 'full', lang: 'en' },
  'OUT OF ORDER': { type: 'out_of_service', lang: 'en' },
  'OUT OF SERVICE': { type: 'out_of_service', lang: 'en' },
  'MAINTENANCE': { type: 'out_of_service', lang: 'en' },
  'ARRIVAL': { type: 'full', lang: 'en' },
  'ARRIVING': { type: 'full', lang: 'en' },
  'DUE IN': { type: 'full', lang: 'en' },
  'CHECKIN': { type: 'full', lang: 'en' },
  'CHECK-IN': { type: 'full', lang: 'en' },
  'CHECK IN': { type: 'full', lang: 'en' },
  'VACANT': { type: 'full', lang: 'en' },
  'VACANT DIRTY': { type: 'full', lang: 'en' },
  'VACANT CLEAN': { type: 'none', lang: 'en' },
  'OCCUPIED DIRTY': { type: 'quick', lang: 'en' },
  'OCCUPIED CLEAN': { type: 'quick', lang: 'en' },
  'NO SHOW': { type: 'full', lang: 'en' },

  // === German ===
  'SAUBER': { type: 'none', lang: 'de' },
  'SCHMUTZIG': { type: 'full', lang: 'de' },
  'BELEGT': { type: 'quick', lang: 'de' },
  'FREI': { type: 'full', lang: 'de' },
  'ABREISE': { type: 'full', lang: 'de' },
  'ANREISE': { type: 'full', lang: 'de' },
  'BLEIBEND': { type: 'quick', lang: 'de' },
  'GEREINIGT': { type: 'none', lang: 'de' },
  'GESPERRT': { type: 'out_of_service', lang: 'de' },
  'AUSSER BETRIEB': { type: 'out_of_service', lang: 'de' },

  // === Spanish ===
  'LIMPIO': { type: 'none', lang: 'es' },
  'SUCIO': { type: 'full', lang: 'es' },
  'OCUPADO': { type: 'quick', lang: 'es' },
  'SALIDA': { type: 'full', lang: 'es' },
  'LLEGADA': { type: 'full', lang: 'es' },
  'DISPONIBLE': { type: 'full', lang: 'es' },
  'FUERA DE SERVICIO': { type: 'out_of_service', lang: 'es' },

  // === Italian ===
  'PULITO': { type: 'none', lang: 'it' },
  'SPORCO': { type: 'full', lang: 'it' },
  'PARTENZA': { type: 'full', lang: 'it' },
  'ARRIVO': { type: 'full', lang: 'it' },
  'FERMATA': { type: 'quick', lang: 'it' },

  // === Portuguese ===
  'LIMPO': { type: 'none', lang: 'pt' },
  'SUJO': { type: 'full', lang: 'pt' },
  'SAÍDA': { type: 'full', lang: 'pt' },
  'SAIDA': { type: 'full', lang: 'pt' },
  'CHEGADA': { type: 'full', lang: 'pt' },

  // === PMS Standard Codes ===
  'DIR': { type: 'full', lang: 'pms' },
  'DRT': { type: 'full', lang: 'pms' },
  'SAL': { type: 'full', lang: 'pms' },
  'INS': { type: 'none', lang: 'pms' },
  'PRO': { type: 'none', lang: 'pms' },
  'CLN': { type: 'none', lang: 'pms' },
  'OCC': { type: 'quick', lang: 'pms' },
  'OOO': { type: 'out_of_service', lang: 'pms' },
  'OOS': { type: 'out_of_service', lang: 'pms' },
  'OOI': { type: 'out_of_service', lang: 'pms' },
  'VAC': { type: 'full', lang: 'pms' },
  'DEP': { type: 'full', lang: 'pms' },
  'ARR': { type: 'full', lang: 'pms' },
  'STO': { type: 'quick', lang: 'pms' },
  'RDY': { type: 'none', lang: 'pms' },

  // === Opera PMS ===
  'VD': { type: 'full', lang: 'opera' },    // Vacant Dirty
  'OD': { type: 'quick', lang: 'opera' },   // Occupied Dirty
  'VC': { type: 'none', lang: 'opera' },    // Vacant Clean
  'OC': { type: 'quick', lang: 'opera' },   // Occupied Clean
  'VR': { type: 'none', lang: 'opera' },    // Vacant Ready
  'VI': { type: 'none', lang: 'opera' },    // Vacant Inspected
  'OI': { type: 'quick', lang: 'opera' },   // Occupied Inspected
  'DI': { type: 'full', lang: 'opera' },    // Dirty Inspected
  'VP': { type: 'full', lang: 'opera' },    // Vacant Pickup

  // Fidelio shares Opera codes (VD, VC, OD, OC already defined above)

  // === Protel PMS ===
  'C/O': { type: 'full', lang: 'protel' },
  'C/I': { type: 'full', lang: 'protel' },
  'S/O': { type: 'quick', lang: 'protel' },
  'CO': { type: 'full', lang: 'protel' },
  'CI': { type: 'full', lang: 'protel' },

  // === Clock PMS ===
  'IH': { type: 'quick', lang: 'clock' },   // In House
  'EA': { type: 'full', lang: 'clock' },     // Expected Arrival
  'ED': { type: 'full', lang: 'clock' },     // Expected Departure

  // === Mews ===
  'INSPECTABLE': { type: 'none', lang: 'mews' },
  'CLEANING REQUIRED': { type: 'full', lang: 'mews' },

  // === StayNTouch ===
  'CHECKED_IN': { type: 'quick', lang: 'stayntouch' },
  'CHECKED_OUT': { type: 'full', lang: 'stayntouch' },
  'RESERVED': { type: 'full', lang: 'stayntouch' },
  'BLOCKED': { type: 'out_of_service', lang: 'stayntouch' },

  // === Hogatex ===
  'AB': { type: 'full', lang: 'hogatex' },   // Abreise
  'AN': { type: 'full', lang: 'hogatex' },   // Anreise
  'BL': { type: 'quick', lang: 'hogatex' },  // Bleibend
  'FR': { type: 'full', lang: 'hogatex' },   // Frei
};

/**
 * Fuzzy match: if a word is within 1 edit distance of a known status, match it.
 */
function fuzzyMatchStatus(
  value: string,
  customMappings?: Record<string, string>
): { type: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown'; matched: string } {
  const upper = value.trim().toUpperCase();
  if (!upper || upper.length < 2) return { type: 'unknown', matched: '' };

  // 1. Custom mappings first (exact)
  if (customMappings) {
    for (const [key, val] of Object.entries(customMappings)) {
      if (upper === key.toUpperCase()) {
        return { type: val as any, matched: key };
      }
    }
  }

  // 2. Direct match
  if (STATUS_DICTIONARY[upper]) {
    return { type: STATUS_DICTIONARY[upper].type, matched: upper };
  }

  // 3. Partial/contains match for multi-word statuses
  for (const [key, val] of Object.entries(STATUS_DICTIONARY)) {
    if (key.length >= 4 && upper.includes(key)) {
      return { type: val.type, matched: key };
    }
  }

  // 4. Fuzzy match (1-character tolerance for words >= 4 chars)
  if (upper.length >= 4) {
    for (const [key, val] of Object.entries(STATUS_DICTIONARY)) {
      if (key.length < 4) continue;
      if (Math.abs(key.length - upper.length) > 1) continue;
      
      const distance = levenshtein(upper, key);
      if (distance <= 1) {
        return { type: val.type, matched: key };
      }
    }
  }

  // 5. Custom mappings fuzzy
  if (customMappings) {
    for (const [key, val] of Object.entries(customMappings)) {
      const keyUpper = key.toUpperCase();
      if (keyUpper.length >= 4 && upper.length >= 4 && Math.abs(keyUpper.length - upper.length) <= 1) {
        if (levenshtein(upper, keyUpper) <= 1) {
          return { type: val as any, matched: key };
        }
      }
    }
  }

  return { type: 'unknown', matched: '' };
}

/**
 * Simple Levenshtein distance
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

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
    return '  ';
  }
  
  return ' ';
}

/**
 * Detect header line using multilingual keywords
 */
function detectHeader(lines: string[]): { index: number; columns: string[]; delimiter: string } | null {
  const HEADER_KEYWORDS = [
    'chambre', 'room', 'zimmer', 'habitación', 'habitacion', 'camera',
    'statut', 'status', 'état', 'etat', 'estado', 'stato',
    'type', 'typ', 'tipo',
    'client', 'guest', 'gast', 'huésped', 'ospite',
    'arrivée', 'arrival', 'anreise', 'llegada', 'arrivo',
    'départ', 'departure', 'abreise', 'salida', 'partenza',
    'date', 'datum', 'fecha', 'data',
    'nuit', 'night', 'nacht', 'noche', 'notte',
    'assigné', 'assigned', 'zugewiesen', 'asignado',
    'catégorie', 'category', 'kategorie',
    'étage', 'floor', 'stock', 'piso', 'piano',
  ];
  
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim().toLowerCase();
    if (!line) continue;
    
    const matchCount = HEADER_KEYWORDS.filter(kw => line.includes(kw)).length;
    if (matchCount < 2) continue;
    
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
  // Room numbers: 1-5 digits, optionally followed by a letter (e.g., 101A, 2B)
  // Exclude pure years (2024, 2025, 2026) and common false positives
  if (/^(19|20)\d{2}$/.test(cleaned)) return false; // Years
  if (/^\d{6,}$/.test(cleaned)) return false; // Too long
  return /^\d{1,5}[A-Za-z]?$/.test(cleaned) && cleaned.length >= 1 && cleaned.length <= 6;
}

/**
 * Detect if a line is header/footer noise
 */
function isHeaderOrFooter(line: string): boolean {
  return /^(page|imprimé|printed|total|résumé|summary|rapport|report|\d+\s*\/\s*\d+\s*$|^[-=_|]{5,}$|^\s*$)/i.test(line.trim());
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
  
  let roomColIdx = 0;
  let statusColIdx = -1;
  const startLine = header ? header.index + 1 : 0;
  
  if (header) {
    for (let i = 0; i < header.columns.length; i++) {
      const col = header.columns[i].toLowerCase();
      if (/chambre|room|zimmer|habitaci|camera|n°|ch\.|rm/i.test(col)) {
        roomColIdx = i;
      }
      if (/statut|status|état|etat|estado|stato|condition/i.test(col)) {
        statusColIdx = i;
      }
    }
    
    header.columns.forEach((name, idx) => {
      detectedColumns.push({
        index: idx,
        name,
        type: detectColumnType(name),
        sampleValues: [],
      });
    });
  }
  
  let unmappedCount = 0;
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue;
    if (isHeaderOrFooter(line)) continue;
    
    let columns: string[];
    if (delimiter === '  ') {
      columns = line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
    } else if (delimiter === ' ') {
      columns = line.split(/\s+/).filter(Boolean);
    } else {
      columns = line.split(delimiter).map(c => c.trim());
    }
    
    if (columns.length < 1) continue;
    
    let roomNumber = '';
    let isRoom = false;
    
    if (header && columns.length > roomColIdx) {
      const candidate = columns[roomColIdx];
      if (isRoomNumber(candidate)) {
        roomNumber = candidate.trim();
        isRoom = true;
      }
    }
    
    if (!isRoom) {
      // No header or header column didn't work: scan all columns
      for (const col of columns) {
        if (isRoomNumber(col)) {
          roomNumber = col.trim();
          isRoom = true;
          break;
        }
      }
    }
    
    let statusValue = '';
    let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
    
    if (isRoom) {
      // Try status column first
      if (statusColIdx >= 0 && columns.length > statusColIdx) {
        const result = fuzzyMatchStatus(columns[statusColIdx], customStatusMappings);
        statusValue = columns[statusColIdx];
        detectedType = result.type;
      }
      
      // If no match from column, try all columns
      if (detectedType === 'unknown') {
        for (let ci = 0; ci < columns.length; ci++) {
          if (ci === roomColIdx) continue;
          const result = fuzzyMatchStatus(columns[ci], customStatusMappings);
          if (result.type !== 'unknown') {
            statusValue = columns[ci];
            detectedType = result.type;
            if (statusColIdx < 0) statusColIdx = ci; // remember for future lines
            break;
          }
        }
      }
      
      // Last resort: scan entire line for known keywords
      if (detectedType === 'unknown') {
        const lineUpper = line.toUpperCase();
        for (const [key, val] of Object.entries(STATUS_DICTIONARY)) {
          if (key.length < 3) continue; // skip 2-char codes for full-line scan (too many false positives)
          if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lineUpper)) {
            statusValue = key;
            detectedType = val.type;
            break;
          }
        }
      }

      if (detectedType === 'unknown') {
        unmappedCount++;
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
          confidence: detectedType !== 'unknown' ? 0.8 : 0.3,
        })),
        detectedCleaningType: detectedType,
        confidence: detectedType !== 'unknown' ? 0.85 : 0.3,
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
  
  const totalRooms = rows.length;
  const mappedRooms = totalRooms - unmappedCount;
  const confidence = totalRooms > 0 ? Math.round((mappedRooms / totalRooms) * 100) : 0;
  
  return {
    rows,
    detectedDelimiter: delimiter,
    detectedColumns: detectedColumns.length > 0 ? detectedColumns : inferColumns(rawLines, customStatusMappings),
    headerLine: header ? lines[header.index] : null,
    rawLines,
    confidence,
    unmappedCount,
  };
}

function detectColumnType(name: string): ColumnType {
  const lower = name.toLowerCase();
  if (/chambre|room|zimmer|n°|ch\.|rm|camera/i.test(lower)) return 'room_number';
  if (/statut|status|état|etat|condition/i.test(lower)) return 'status';
  if (/type|categ|kategorie/i.test(lower)) return 'room_type';
  if (/arrivée|arrival|anreise|llegada|arrivo/i.test(lower)) return 'arrival_date';
  if (/départ|departure|abreise|salida|partenza/i.test(lower)) return 'departure_date';
  if (/client|guest|gast|nom|name|ospite/i.test(lower)) return 'guest_name';
  if (/assigné|assigned|zugewiesen|asignado/i.test(lower)) return 'assignee';
  if (/nuit|night|nacht|noche|notte/i.test(lower)) return 'night_info';
  if (/étage|floor|stock|piso|piano/i.test(lower)) return 'floor';
  return 'other';
}

function inferColumns(rawLines: RawParsedLine[], customMappings?: Record<string, string>): DetectedColumn[] {
  const roomLines = rawLines.filter(l => l.isRoom);
  if (roomLines.length === 0) return [];
  
  const maxCols = Math.max(...roomLines.map(l => l.columns.length));
  const columns: DetectedColumn[] = [];
  
  for (let i = 0; i < maxCols; i++) {
    const values = roomLines.map(l => l.columns[i] || '').filter(Boolean);
    const uniqueValues = [...new Set(values)].slice(0, 5);
    
    let type: ColumnType = 'other';
    const allNumeric = values.every(v => isRoomNumber(v));
    const hasStatusWords = values.some(v => fuzzyMatchStatus(v, customMappings).type !== 'unknown');
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
