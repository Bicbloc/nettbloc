/**
 * Détecteur de format de rapport PMS v3.0
 * Parser intelligent avec support avancé Mews/Apaleo/Medialog
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
  roomType: string;
  cleaningStatus: string; // DIR, INS, PRO, SAL, etc.
  columns: ColumnValue[];
  detectedCleaningType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown';
  confidence: number;
  statusIndicator: string;
  // Données extraites
  guestName: string;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
  departureTime: string;
  nightInfo: string; // "Night 2/3"
  hasCurrentGuest: boolean;
  hasDepartingGuest: boolean;
  hasArrivingGuest: boolean;
  isOutOfOrder: boolean;
  assignee: string;
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
  | 'night_info'
  | 'notes' 
  | 'other';

export interface ReportStructure {
  hasTable: boolean;
  columnCount: number;
  suggestedColumns: ColumnDefinition[];
  roomNumberPattern: string;
  lineParseStrategy: 'mews' | 'apaleo' | 'medialog' | 'table' | 'generic';
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
  | 'mews_space_status'
  | 'apaleo_housekeeping'
  | 'medialog_etat'
  | 'opera_housekeeping'
  | 'generic_table'
  | 'unknown';

// =========== RÈGLES DE NETTOYAGE MEWS ===========
// Mews utilise DIR/INS/PRO/SAL avec une logique spécifique

const MEWS_STATUS_MAP: Record<string, { type: 'full' | 'quick' | 'none' | 'out_of_service'; description: string }> = {
  'DIR': { type: 'full', description: 'Dirty - Chambre sale (départ ou à nettoyer)' },
  'SAL': { type: 'full', description: 'Sale - Chambre à nettoyer' },
  'INS': { type: 'quick', description: 'Inspecté - Chambre propre (client en place = recouche)' },
  'PRO': { type: 'quick', description: 'Propre - Chambre propre (client en place = recouche)' },
};

// =========== DÉTECTION DE FORMAT ===========

const FORMAT_SIGNATURES: Record<ReportFormat, { patterns: RegExp[]; weight: number }[]> = {
  mews_space_status: [
    { patterns: [/Space\s+status/i, /Statut\s+des\s+espaces/i], weight: 15 },
    { patterns: [/\b(INS|PRO|SAL|DIR)\s+[A-Z][a-z]+/], weight: 8 },
    { patterns: [/Floor\s+Spaces/i, /Étage\s+Espaces/i], weight: 8 },
    { patterns: [/×\s*Adult/i, /×\s*Adulte/i], weight: 5 },
    { patterns: [/Night\s+\d+\/\d+/i, /Nuit\s+\d+\/\d+/i], weight: 5 },
    { patterns: [/\d{3}\s+[A-Z]{2,4}\s+(DIR|INS|PRO|SAL)\b/], weight: 10 },
  ],
  apaleo_housekeeping: [
    { patterns: [/Rapport\s+Housekeeping/i], weight: 15 },
    { patterns: [/\b(Recouche|Parti|En\s+arrivée)\b/i], weight: 8 },
    { patterns: [/A\s+contrôler/i], weight: 5 },
    { patterns: [/Type\s+de\s+chambre/i], weight: 3 },
  ],
  medialog_etat: [
    { patterns: [/L'état\s+des\s+chambres/i, /état\s+des\s+chambres/i], weight: 15 },
    { patterns: [/\b(PARTI|RECOUCHE|DEPART|DRAPS)\b/], weight: 10 },
    { patterns: [/Medialog/i], weight: 15 },
    { patterns: [/MEMO\s+GOUVERNANTE/i], weight: 5 },
    { patterns: [/S\s*=\s*Sale/i], weight: 5 },
  ],
  opera_housekeeping: [
    { patterns: [/Opera/i, /Oracle/i], weight: 10 },
    { patterns: [/Housekeeping\s+Report/i], weight: 5 },
    { patterns: [/\b(VD|OD|VC|OC)\b/], weight: 8 },
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
  console.log('Detected format:', format);
  
  // 2. Parser selon le format spécifique
  const parsedData = parseReportByFormat(text, format);
  
  // 3. Construire la structure
  const structure = buildStructure(parsedData, format);
  
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
    console.log(`Format ${format}: score ${score}`);
    if (score > bestScore) {
      bestScore = score;
      bestFormat = format;
    }
  }
  
  return bestScore >= 8 ? bestFormat : 'generic_table';
}

// =========== PARSING PAR FORMAT ===========

function parseReportByFormat(text: string, format: ReportFormat): ParsedReportData {
  switch (format) {
    case 'mews_space_status':
      return parseMewsReport(text);
    case 'apaleo_housekeeping':
      return parseApaleoReport(text);
    case 'medialog_etat':
      return parseMedialogReport(text);
    default:
      return parseGenericReport(text);
  }
}

/**
 * Parser spécialisé Mews Space Status
 * Format: "101 TWS DIR Farid 05/05/2025 1 × Adults Name , Night 2/2 07/05/2025"
 */
function parseMewsReport(text: string): ParsedReportData {
  const lines = text.split('\n');
  const rows: ParsedRow[] = [];
  
  // Regex pour extraire les chambres Mews
  // Format: [Floor] RoomNumber Type Status Assignee [dates et infos client]
  const roomPattern = /(\d{3,4})\s+([A-Z]{2,5})\s+(DIR|INS|PRO|SAL)\s+([A-Za-z]+)/;
  const roomPatternAlt = /(\d{3,4})\s+([A-Z]{2,5})\s+(CLA|B|PMR|Twinable)?\s*(DIR|INS|PRO|SAL)\b/i;
  
  // Pattern pour "Out of order"
  const oooPattern = /(\d{3,4})\s+.*Out\s+of\s+order/i;
  
  // Pattern pour les noms de clients et dates
  const guestPattern = /(\d+)\s*×\s*(Adult[se]?|Enfant[s]?)\s+([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]*)*)/gi;
  const nightPattern = /Night\s+(\d+)\/(\d+)|Nuit\s+(\d+)\/(\d+)/i;
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
  const timePattern = /(\d{2}:\d{2})/g;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip les lignes vides ou headers
    if (!trimmed || trimmed.length < 5) continue;
    if (isHeaderLine(trimmed)) continue;
    
    // Vérifier Out of Order d'abord
    const oooMatch = trimmed.match(oooPattern);
    if (oooMatch) {
      rows.push(createMewsRow(line, oooMatch[1], '', 'OOO', '', true));
      continue;
    }
    
    // Essayer le pattern principal
    let match = trimmed.match(roomPattern);
    if (!match) {
      match = trimmed.match(roomPatternAlt);
    }
    
    if (match) {
      const roomNumber = match[1];
      const roomType = match[2];
      const status = (match[3] === 'CLA' || match[3] === 'B' || match[3] === 'PMR' || match[3] === 'Twinable') 
        ? match[4]?.toUpperCase() || 'SAL'
        : match[3].toUpperCase();
      const assignee = match[4] || '';
      
      // Extraire les données supplémentaires
      const dates = [...trimmed.matchAll(datePattern)].map(m => m[1]);
      const times = [...trimmed.matchAll(timePattern)].map(m => m[1]);
      const guests: string[] = [];
      let guestMatch;
      const guestRegex = /(\d+)\s*×\s*(Adult[se]?|Enfant[s]?)\s+([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]*)*)/gi;
      while ((guestMatch = guestRegex.exec(trimmed)) !== null) {
        guests.push(guestMatch[3]);
      }
      const nightMatch = trimmed.match(nightPattern);
      
      // Déterminer le type de nettoyage avec la logique Mews
      const row = createMewsRow(
        line,
        roomNumber,
        roomType,
        status,
        assignee,
        false,
        guests,
        dates,
        times,
        nightMatch
      );
      
      rows.push(row);
    }
  }
  
  // Calculer le résumé
  const summary = calculateSummary(rows);
  
  return {
    headers: ['N° Chambre', 'Type', 'Statut', 'Assigné', 'Client', 'Arrivée', 'Départ', 'Nuit', 'Type nettoyage'],
    rows,
    summary,
  };
}

function createMewsRow(
  rawLine: string,
  roomNumber: string,
  roomType: string,
  status: string,
  assignee: string,
  isOOO: boolean,
  guests: string[] = [],
  dates: string[] = [],
  times: string[] = [],
  nightMatch?: RegExpMatchArray | null
): ParsedRow {
  const nightInfo = nightMatch 
    ? `${nightMatch[1] || nightMatch[3]}/${nightMatch[2] || nightMatch[4]}`
    : '';
  
  // Analyser les dates
  const arrivalDate = dates[0] || '';
  const departureDate = dates[1] || dates[0] || '';
  
  // Déterminer si c'est une arrivée, un départ ou un client en place
  const hasNightInfo = !!nightMatch;
  const currentNight = nightMatch ? parseInt(nightMatch[1] || nightMatch[3] || '1') : 0;
  const totalNights = nightMatch ? parseInt(nightMatch[2] || nightMatch[4] || '1') : 0;
  const isLastNight = currentNight === totalNights;
  
  // Logique de détermination du type de nettoyage Mews
  let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
  let statusIndicator = status;
  
  if (isOOO) {
    detectedType = 'out_of_service';
    statusIndicator = 'OOO';
  } else if (status === 'DIR' || status === 'SAL') {
    // DIR/SAL = chambre sale
    if (hasNightInfo && !isLastNight) {
      // Client en place, pas dernier jour = recouche
      detectedType = 'quick';
      statusIndicator = `${status} (Recouche)`;
    } else if (guests.length === 0) {
      // Pas de client = chambre vacante sale = à blanc
      detectedType = 'full';
      statusIndicator = `${status} (Départ)`;
    } else if (isLastNight) {
      // Dernier jour du client = départ = à blanc
      detectedType = 'full';
      statusIndicator = `${status} (Départ)`;
    } else {
      // Client en place = recouche
      detectedType = 'quick';
      statusIndicator = `${status} (Recouche)`;
    }
  } else if (status === 'INS' || status === 'PRO') {
    // INS/PRO = chambre propre/inspectée
    if (guests.length > 0) {
      // Client en place avec chambre déjà inspectée = recouche
      detectedType = 'quick';
      statusIndicator = `${status} (Recouche)`;
    } else {
      // Chambre vide et propre = aucun nettoyage
      detectedType = 'none';
      statusIndicator = `${status} (Propre)`;
    }
  }
  
  // Créer les colonnes pour l'affichage
  const columns: ColumnValue[] = [
    { value: roomNumber, type: 'room_number', confidence: 1 },
    { value: roomType, type: 'room_type', confidence: 1 },
    { value: status, type: 'status', confidence: 1 },
    { value: assignee, type: 'assignee', confidence: 0.8 },
    { value: guests.join(', '), type: 'guest_name', confidence: 0.9 },
    { value: arrivalDate, type: 'arrival_date', confidence: 0.8 },
    { value: departureDate, type: 'departure_date', confidence: 0.8 },
    { value: nightInfo, type: 'night_info', confidence: 0.9 },
  ];
  
  return {
    rawLine,
    roomNumber,
    roomType,
    cleaningStatus: status,
    columns,
    detectedCleaningType: detectedType,
    confidence: detectedType !== 'unknown' ? 0.85 : 0.3,
    statusIndicator,
    guestName: guests.join(', '),
    arrivalDate,
    departureDate,
    arrivalTime: times[0] || '',
    departureTime: times[1] || times[0] || '',
    nightInfo,
    hasCurrentGuest: guests.length > 0,
    hasDepartingGuest: isLastNight,
    hasArrivingGuest: currentNight === 1,
    isOutOfOrder: isOOO,
    assignee,
  };
}

/**
 * Parser Apaleo Housekeeping
 */
function parseApaleoReport(text: string): ParsedReportData {
  const lines = text.split('\n');
  const rows: ParsedRow[] = [];
  
  // Pattern Apaleo: "01 Chambre twin 17/05/2025 15:00 ..."
  const roomPattern = /^(\d{2,4})\s+(Chambre\s+\w+)/i;
  const statusPattern = /\b(Recouche|Parti|En\s+arrivée)\b/i;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    if (isHeaderLine(trimmed)) continue;
    
    const roomMatch = trimmed.match(roomPattern);
    if (!roomMatch) continue;
    
    const roomNumber = roomMatch[1];
    const roomType = roomMatch[2];
    
    const statusMatch = trimmed.match(statusPattern);
    const status = statusMatch ? statusMatch[1] : '';
    
    let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
    if (/parti/i.test(status)) {
      detectedType = 'full';
    } else if (/recouche/i.test(status)) {
      detectedType = 'quick';
    } else if (/arrivée/i.test(status)) {
      detectedType = 'full'; // Arrivée = chambre à préparer
    }
    
    rows.push({
      rawLine: line,
      roomNumber,
      roomType,
      cleaningStatus: status,
      columns: [
        { value: roomNumber, type: 'room_number', confidence: 1 },
        { value: roomType, type: 'room_type', confidence: 1 },
        { value: status, type: 'status', confidence: 0.9 },
      ],
      detectedCleaningType: detectedType,
      confidence: detectedType !== 'unknown' ? 0.85 : 0.3,
      statusIndicator: status,
      guestName: '',
      arrivalDate: '',
      departureDate: '',
      arrivalTime: '',
      departureTime: '',
      nightInfo: '',
      hasCurrentGuest: /recouche/i.test(status),
      hasDepartingGuest: /parti/i.test(status),
      hasArrivingGuest: /arrivée/i.test(status),
      isOutOfOrder: false,
      assignee: '',
    });
  }
  
  return {
    headers: ['N° Chambre', 'Type', 'Statut', 'Type nettoyage'],
    rows,
    summary: calculateSummary(rows),
  };
}

/**
 * Parser Medialog État des chambres
 */
function parseMedialogReport(text: string): ParsedReportData {
  const lines = text.split('\n');
  const rows: ParsedRow[] = [];
  
  // Pattern Medialog: "110 PARTI S SGL 15/05 17/05 2"
  const roomPattern = /^(\d{3})\s+(PARTI|RECOUCHE|DEPART|DRAPS)/i;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    if (isHeaderLine(trimmed)) continue;
    
    const roomMatch = trimmed.match(roomPattern);
    if (!roomMatch) continue;
    
    const roomNumber = roomMatch[1];
    const status = roomMatch[2].toUpperCase();
    
    let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
    if (status === 'PARTI' || status === 'DEPART') {
      detectedType = 'full';
    } else if (status === 'RECOUCHE' || status === 'DRAPS') {
      detectedType = 'quick';
    }
    
    rows.push({
      rawLine: line,
      roomNumber,
      roomType: '',
      cleaningStatus: status,
      columns: [
        { value: roomNumber, type: 'room_number', confidence: 1 },
        { value: status, type: 'status', confidence: 0.95 },
      ],
      detectedCleaningType: detectedType,
      confidence: 0.9,
      statusIndicator: status,
      guestName: '',
      arrivalDate: '',
      departureDate: '',
      arrivalTime: '',
      departureTime: '',
      nightInfo: '',
      hasCurrentGuest: status === 'RECOUCHE' || status === 'DRAPS',
      hasDepartingGuest: status === 'PARTI' || status === 'DEPART',
      hasArrivingGuest: false,
      isOutOfOrder: false,
      assignee: '',
    });
  }
  
  return {
    headers: ['N° Chambre', 'Statut', 'Type nettoyage'],
    rows,
    summary: calculateSummary(rows),
  };
}

/**
 * Parser générique
 */
function parseGenericReport(text: string): ParsedReportData {
  const lines = text.split('\n');
  const rows: ParsedRow[] = [];
  
  // Pattern générique pour numéro de chambre
  const roomPattern = /^(\d{2,4}[A-Z]?)\b/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    if (isHeaderLine(trimmed)) continue;
    
    const roomMatch = trimmed.match(roomPattern);
    if (!roomMatch) continue;
    
    const roomNumber = roomMatch[1];
    
    // Chercher des indicateurs de statut
    let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
    let statusIndicator = '';
    
    if (/\b(départ|depart|parti|checkout|libéré)\b/i.test(trimmed)) {
      detectedType = 'full';
      statusIndicator = 'Départ';
    } else if (/\b(recouche|stayover|occupé|occ)\b/i.test(trimmed)) {
      detectedType = 'quick';
      statusIndicator = 'Recouche';
    } else if (/\b(ooo|out\s*of\s*order|hors\s*service|maintenance)\b/i.test(trimmed)) {
      detectedType = 'out_of_service';
      statusIndicator = 'H.S.';
    } else if (/\b(libre|vacant|propre|clean)\b/i.test(trimmed)) {
      detectedType = 'none';
      statusIndicator = 'Libre';
    }
    
    rows.push({
      rawLine: line,
      roomNumber,
      roomType: '',
      cleaningStatus: statusIndicator,
      columns: [
        { value: roomNumber, type: 'room_number', confidence: 1 },
        { value: statusIndicator, type: 'status', confidence: 0.5 },
      ],
      detectedCleaningType: detectedType,
      confidence: detectedType !== 'unknown' ? 0.6 : 0.3,
      statusIndicator,
      guestName: '',
      arrivalDate: '',
      departureDate: '',
      arrivalTime: '',
      departureTime: '',
      nightInfo: '',
      hasCurrentGuest: false,
      hasDepartingGuest: false,
      hasArrivingGuest: false,
      isOutOfOrder: false,
      assignee: '',
    });
  }
  
  return {
    headers: ['N° Chambre', 'Statut', 'Type nettoyage'],
    rows,
    summary: calculateSummary(rows),
  };
}

function isHeaderLine(line: string): boolean {
  const patterns = [
    /^(page|imprimé|total|résumé|summary|printed)/i,
    /^\d+\s+chambre\(s\)/i,
    /^(floor|étage)\s+spaces/i,
    /fermé\s+à\s+la\s+vente/i,
    /^[-=_|]{5,}$/,
    /literie\s+\d+\s*×/i,
    /\d+\s*×\s*lit/i,
    /^#\s+ETAT\s+MEMO/i,
    /^Ch\.\s+Type\s+Arrivée/i,
    /^Floor\s+Spaces/i,
    /^Étage\s+Espaces/i,
    /Space\s+status\s+-/i,
    /Statut\s+des\s+espaces\s+-/i,
  ];
  
  return patterns.some(p => p.test(line));
}

function buildStructure(parsedData: ParsedReportData, format: ReportFormat): ReportStructure {
  const columnTypes = parsedData.headers.map((name, index): ColumnDefinition => {
    const sampleValues = parsedData.rows.slice(0, 10).map(r => r.columns[index]?.value || '').filter(v => v);
    return {
      index,
      name,
      type: detectColumnTypeFromValues(sampleValues, name),
      isRelevantForCleaning: ['Statut', 'Type nettoyage', 'N° Chambre'].some(k => name.includes(k)),
      sampleValues: [...new Set(sampleValues)].slice(0, 5),
    };
  });
  
  return {
    hasTable: true,
    columnCount: columnTypes.length,
    suggestedColumns: columnTypes,
    roomNumberPattern: '^\\d{2,4}',
    lineParseStrategy: format === 'mews_space_status' ? 'mews' : format === 'apaleo_housekeeping' ? 'apaleo' : format === 'medialog_etat' ? 'medialog' : 'generic',
    delimiter: null,
  };
}

function detectColumnTypeFromValues(values: string[], name: string): ColumnType {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('chambre') || lowerName.includes('room')) return 'room_number';
  if (lowerName.includes('statut') || lowerName.includes('status')) return 'status';
  if (lowerName.includes('type')) return 'room_type';
  if (lowerName.includes('arrivée') || lowerName.includes('arrival')) return 'arrival_date';
  if (lowerName.includes('départ') || lowerName.includes('departure')) return 'departure_date';
  if (lowerName.includes('client') || lowerName.includes('guest')) return 'guest_name';
  if (lowerName.includes('assigné') || lowerName.includes('assignee')) return 'assignee';
  if (lowerName.includes('nuit') || lowerName.includes('night')) return 'night_info';
  return 'other';
}

function extractIndicators(parsedData: ParsedReportData): CleaningIndicator[] {
  const indicatorMap = new Map<string, { 
    type: 'full' | 'quick' | 'none' | 'out_of_service' | 'exclude' | 'unknown'; 
    count: number; 
    contexts: string[] 
  }>();
  
  for (const row of parsedData.rows) {
    if (!row.cleaningStatus && !row.statusIndicator) continue;
    
    const key = (row.cleaningStatus || row.statusIndicator).toUpperCase().substring(0, 20);
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
        if (row.hasArrivingGuest && !row.hasDepartingGuest) {
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
  const formatBonus = format !== 'unknown' && format !== 'generic_table' ? 0.15 : 0;
  
  return Math.min(100, Math.round((knownRatio + formatBonus) * 100));
}

/**
 * Obtient une description utilisateur du format détecté
 */
export function getFormatDescription(format: ReportFormat): { name: string; description: string } {
  const descriptions: Record<ReportFormat, { name: string; description: string }> = {
    mews_space_status: {
      name: 'Mews Space Status',
      description: 'DIR=Sale(départ) • INS/PRO=Propre(recouche si client)',
    },
    apaleo_housekeeping: {
      name: 'Apaleo Housekeeping',
      description: 'Parti=Départ • Recouche=Client en place • Arrivée=À préparer',
    },
    medialog_etat: {
      name: 'Medialog État des chambres',
      description: 'PARTI/DEPART=À blanc • RECOUCHE/DRAPS=Recouche',
    },
    opera_housekeeping: {
      name: 'Opera Housekeeping',
      description: 'VD=Vacant Dirty • OD=Occupied Dirty • VC=Vacant Clean',
    },
    generic_table: {
      name: 'Format générique',
      description: 'Format tabulaire détecté automatiquement',
    },
    unknown: {
      name: 'Format inconnu',
      description: 'Parsing générique - vérifiez les mappings manuellement',
    },
  };
  return descriptions[format];
}
