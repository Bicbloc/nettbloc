/**
 * Parser intelligent de rapports PMS
 * Parse le texte brut en lignes de données structurées
 */

import { ReportFormat, FormatDetection } from './ReportFormatDetector';

export interface ParsedRoomLine {
  roomNumber: string;
  rawLine: string;
  cleanedLine: string;
  statusIndicators: string[];
  dataColumns: ParsedColumn[];
  floor?: number;
  roomType?: string;
  guestInfo?: string;
  dates?: { arrival?: string; departure?: string };
}

export interface ParsedColumn {
  index: number;
  value: string;
  type: 'status' | 'room_type' | 'date' | 'time' | 'guest' | 'assignee' | 'count' | 'other';
}

export interface ParseResult {
  rooms: ParsedRoomLine[];
  excludedLines: string[];
  parseStats: {
    totalLines: number;
    roomLines: number;
    excludedLines: number;
    parseErrors: number;
  };
}

// Patterns d'exclusion (lignes qui ne sont pas des chambres)
const EXCLUSION_PATTERNS = [
  /^(page|imprimé|total|résumé|summary)/i,
  /^\d+\s+chambre\(s\)/i,
  /^(floor|étage)\s+spaces/i,
  /literie\s+\d+\s*×/i,
  /\d+\s*×\s*lit/i,
  /fermé\s+à\s+la\s+vente/i,
  /^\s*$/, // Lignes vides
  /^[-=_]{5,}$/, // Séparateurs
  /^\|[-\s|]+\|$/, // Lignes de tableau vides
];

// Patterns de numéro de chambre
const ROOM_NUMBER_PATTERNS = [
  /^(\d{1,2})\s+(\d{3}[A-Z]?)/,                  // "1 101" (floor + room)
  /^(\d{3,4}[A-Z]?(?:\s*[+\/\-]\s*\d{3,4}[A-Z]?)?)/,  // "101" or "101+102"
  /^\|?\s*(\d{3,4}[A-Z]?)\s/,                    // "| 101 " (table format)
  /^Room\s+(\d+)/i,                              // "Room 101"
  /^Ch\.?\s*(\d+)/i,                             // "Ch. 101"
];

/**
 * Parse un rapport selon le format détecté
 */
export function parseReport(text: string, detection: FormatDetection): ParseResult {
  const lines = text.split('\n');
  const rooms: ParsedRoomLine[] = [];
  const excludedLines: string[] = [];
  let parseErrors = 0;
  
  // Sélectionner la stratégie de parsing
  const parseFunction = getParseStrategy(detection.format, detection.structure.lineParseStrategy);
  
  // Variables pour le parsing multi-ligne (certains formats ont des données sur plusieurs lignes)
  let currentRoom: Partial<ParsedRoomLine> | null = null;
  let continuationBuffer = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Vérifier les exclusions
    if (shouldExcludeLine(trimmed)) {
      excludedLines.push(trimmed);
      continue;
    }
    
    // Essayer de parser la ligne
    const parsed = parseFunction(line, trimmed, i, detection);
    
    if (parsed) {
      // Si on avait une chambre en cours, la sauvegarder
      if (currentRoom && currentRoom.roomNumber) {
        rooms.push(finalizeRoom(currentRoom, continuationBuffer));
        continuationBuffer = '';
      }
      currentRoom = parsed;
    } else if (currentRoom && trimmed) {
      // C'est potentiellement une continuation de la ligne précédente
      continuationBuffer += ' ' + trimmed;
    }
  }
  
  // Ajouter la dernière chambre
  if (currentRoom && currentRoom.roomNumber) {
    rooms.push(finalizeRoom(currentRoom, continuationBuffer));
  }
  
  // Post-traitement: extraire les indicateurs de statut
  for (const room of rooms) {
    room.statusIndicators = extractStatusIndicators(room.rawLine + ' ' + room.cleanedLine, detection);
  }
  
  return {
    rooms,
    excludedLines,
    parseStats: {
      totalLines: lines.length,
      roomLines: rooms.length,
      excludedLines: excludedLines.length,
      parseErrors,
    },
  };
}

/**
 * Vérifie si une ligne doit être exclue
 */
function shouldExcludeLine(line: string): boolean {
  if (!line || line.length < 3) return true;
  return EXCLUSION_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Sélectionne la fonction de parsing appropriée
 */
function getParseStrategy(format: ReportFormat, strategy: string): (line: string, trimmed: string, index: number, detection: FormatDetection) => Partial<ParsedRoomLine> | null {
  
  switch (format) {
    case 'mews_space_status':
      return parseMewsLine;
    case 'medialog_etat':
      return parseMedialogLine;
    case 'apaleo_housekeeping':
      return parseApaleoLine;
    default:
      return parseGenericLine;
  }
}

/**
 * Parse une ligne format Mews Space Status
 * Format: "Floor Spaces Assignee" avec INS/PRO/SAL/DIR
 */
function parseMewsLine(line: string, trimmed: string, index: number, detection: FormatDetection): Partial<ParsedRoomLine> | null {
  // Pattern: "101 TWS DIR Farid ..."
  // Ou: "1 101 TWS DIR ..."
  const mewsPattern = /^(\d*)?\s*(\d{3}[A-Z]?(?:\s*[+]\s*\d{3}[A-Z]?)?)\s+([A-Z]{2,4})\s+(INS|PRO|SAL|DIR)\s+(.*)$/i;
  const match = trimmed.match(mewsPattern);
  
  if (match) {
    const floor = match[1] ? parseInt(match[1]) : undefined;
    const roomNumber = match[2].replace(/\s+/g, '');
    const roomType = match[3];
    const status = match[4].toUpperCase();
    const rest = match[5];
    
    return {
      roomNumber,
      rawLine: line,
      cleanedLine: trimmed,
      floor,
      roomType,
      statusIndicators: [status],
      dataColumns: [
        { index: 0, value: roomNumber, type: 'other' },
        { index: 1, value: roomType, type: 'room_type' },
        { index: 2, value: status, type: 'status' },
        { index: 3, value: rest, type: 'other' },
      ],
    };
  }
  
  // Pattern alternatif plus souple
  const simplePattern = /^(\d{3,4}[A-Z]?)\s+([A-Z]{2,5})\s+(INS|PRO|SAL|DIR)/i;
  const simpleMatch = trimmed.match(simplePattern);
  
  if (simpleMatch) {
    return {
      roomNumber: simpleMatch[1],
      rawLine: line,
      cleanedLine: trimmed,
      roomType: simpleMatch[2],
      statusIndicators: [simpleMatch[3].toUpperCase()],
      dataColumns: [],
    };
  }
  
  return null;
}

/**
 * Parse une ligne format Medialog
 * Format: "# ETAT MEMO ARR. DEP. DATES ETAT"
 */
function parseMedialogLine(line: string, trimmed: string, index: number, detection: FormatDetection): Partial<ParsedRoomLine> | null {
  // Pattern: "110 PARTI S SGL 15/05 17/05 2"
  const medialogPattern = /^(\d{3})\s+(PARTI|RECOUCHE|DEPART|DRAPS)\s*([SV])?\s+([A-Z\s\+]+)\s+(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(\d+)$/i;
  const match = trimmed.match(medialogPattern);
  
  if (match) {
    return {
      roomNumber: match[1],
      rawLine: line,
      cleanedLine: trimmed,
      statusIndicators: [match[2].toUpperCase()],
      roomType: match[4].trim(),
      dates: {
        arrival: match[5],
        departure: match[6],
      },
      dataColumns: [
        { index: 0, value: match[1], type: 'other' },
        { index: 1, value: match[2], type: 'status' },
        { index: 2, value: match[4], type: 'room_type' },
      ],
    };
  }
  
  // Pattern simplifié
  const simplePattern = /^(\d{3})\s+(PARTI|RECOUCHE|DEPART|DRAPS)/i;
  const simpleMatch = trimmed.match(simplePattern);
  
  if (simpleMatch) {
    return {
      roomNumber: simpleMatch[1],
      rawLine: line,
      cleanedLine: trimmed,
      statusIndicators: [simpleMatch[2].toUpperCase()],
      dataColumns: [],
    };
  }
  
  return null;
}

/**
 * Parse une ligne format Apaleo Housekeeping
 * Format: "Ch. Type Arrivée Départ Adultes Nom Statut État"
 */
function parseApaleoLine(line: string, trimmed: string, index: number, detection: FormatDetection): Partial<ParsedRoomLine> | null {
  // Pattern: "01 Chambre twin 17/05/2025 15:00 ..."
  const apaleoPattern = /^(\d{2,4})\s+(Chambre\s+\w+)\s+(\d{2}\/\d{2}\/\d{4})/i;
  const match = trimmed.match(apaleoPattern);
  
  if (match) {
    // Chercher le statut dans la ligne (Recouche, Parti, En arrivée)
    const statusMatch = line.match(/\b(Recouche|Parti|En\s+arrivée)\b/i);
    const status = statusMatch ? statusMatch[1] : '';
    
    return {
      roomNumber: match[1],
      rawLine: line,
      cleanedLine: trimmed,
      roomType: match[2],
      statusIndicators: status ? [status] : [],
      dataColumns: [
        { index: 0, value: match[1], type: 'other' },
        { index: 1, value: match[2], type: 'room_type' },
        { index: 2, value: status, type: 'status' },
      ],
    };
  }
  
  // Pattern simplifié pour numéro de chambre
  const simplePattern = /^(\d{2,4})\s+/;
  const simpleMatch = trimmed.match(simplePattern);
  
  if (simpleMatch && (trimmed.includes('Recouche') || trimmed.includes('Parti') || trimmed.includes('arrivée'))) {
    const statusMatch = line.match(/\b(Recouche|Parti|En\s+arrivée)\b/i);
    return {
      roomNumber: simpleMatch[1],
      rawLine: line,
      cleanedLine: trimmed,
      statusIndicators: statusMatch ? [statusMatch[1]] : [],
      dataColumns: [],
    };
  }
  
  return null;
}

/**
 * Parse une ligne avec un parser générique
 */
function parseGenericLine(line: string, trimmed: string, index: number, detection: FormatDetection): Partial<ParsedRoomLine> | null {
  // Essayer tous les patterns de numéro de chambre
  for (const pattern of ROOM_NUMBER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const roomNumber = match[1] + (match[2] || '');
      
      // Split le reste en colonnes
      const rest = trimmed.substring(match[0].length);
      const columns = rest.split(/\s{2,}|\t/).filter(c => c.trim());
      
      return {
        roomNumber: roomNumber.replace(/\s+/g, ''),
        rawLine: line,
        cleanedLine: trimmed,
        dataColumns: columns.map((val, i) => ({
          index: i,
          value: val.trim(),
          type: 'other' as const,
        })),
        statusIndicators: [],
      };
    }
  }
  
  return null;
}

/**
 * Extrait les indicateurs de statut d'une ligne
 */
function extractStatusIndicators(text: string, detection: FormatDetection): string[] {
  const indicators: string[] = [];
  
  // Patterns de statut connus
  const patterns = [
    /\b(INS|PRO|SAL|DIR)\b/gi,
    /\b(PARTI|RECOUCHE|DEPART|DRAPS)\b/gi,
    /\b(Recouche|Parti|En\s+arrivée)\b/gi,
    /\b(Dirty|Clean|Inspected)\b/gi,
    /\b(A\s+contrôler|Sale|Propre)\b/gi,
    /\b(OOO|Out\s+of\s+order|Hors\s+service)\b/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[0].trim().toUpperCase();
      if (!indicators.includes(value)) {
        indicators.push(value);
      }
    }
  }
  
  return indicators;
}

/**
 * Finalise un objet chambre avec les données de continuation
 */
function finalizeRoom(room: Partial<ParsedRoomLine>, continuation: string): ParsedRoomLine {
  return {
    roomNumber: room.roomNumber || '',
    rawLine: room.rawLine || '',
    cleanedLine: room.cleanedLine || '',
    statusIndicators: room.statusIndicators || [],
    dataColumns: room.dataColumns || [],
    floor: room.floor,
    roomType: room.roomType,
    guestInfo: continuation.trim() || undefined,
    dates: room.dates,
  };
}
