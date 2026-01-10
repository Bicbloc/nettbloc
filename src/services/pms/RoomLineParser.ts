/**
 * RoomLineParser - Parser intelligent qui découpe le texte en lignes logiques
 * Une ligne logique = du numéro de chambre jusqu'au prochain numéro de chambre
 */

export interface RoomLine {
  roomNumber: string;
  fullText: string;
  startIndex: number;
  endIndex: number;
  floor?: string;
  roomType?: string;
  statusCode?: string;
  guestName?: string;
  dates: {
    arrival?: string;
    departure?: string;
    checkInTime?: string;
    checkOutTime?: string;
  };
  nightInfo?: { current: number; total: number };
  occupancy?: { adults: number; children: number };
  isLastNight?: boolean;
  linkedRoom?: string; // Pour les chambres communicantes (ex: 003+004)
}

// Pattern pour détecter les numéros de chambre au début d'une section
const ROOM_NUMBER_PATTERNS = [
  // Chambres communicantes: 003+004, 103+104, 503-504
  /(\d{2,4})\s*[+\-]\s*(\d{2,4})/,
  // Chambre avec suffixe: 101-T, 205-T-Balcon, 206-T/ Balcon
  /(\d{2,4})(?:-T)?(?:-?\s*(?:Balcon|Terrasse))?(?:\s|$)/,
  // Chambre simple: 001, 102, 612
  /^(\d{2,4})\s+/,
];

// Patterns pour les types de chambre
const ROOM_TYPE_PATTERNS = [
  /\b(DBL|SGL|TPL|FAM|DUP|STU|SUI|APP|QUA)-?([A-Z])?/i,
];

// Patterns pour les statuts
const STATUS_PATTERNS = [
  /\b(SAL|INS|PRO|VCI|VCO|OCC|ARR|DEP|DND|OOO|OOS)\b/i,
];

/**
 * Parse le texte brut et le découpe en lignes logiques par chambre
 */
export function parseRoomLines(
  rawText: string,
  excludeList: string[] = []
): RoomLine[] {
  const roomLines: RoomLine[] = [];
  
  // Normaliser les noms à exclure
  const normalizedExcludeList = excludeList.map(name => 
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  
  // Prétraitement: fusionner les lignes fragmentées
  const processedText = preprocessText(rawText);
  
  // Trouver toutes les positions de numéros de chambre
  const roomPositions = findRoomPositions(processedText);
  
  if (roomPositions.length === 0) {
    return [];
  }
  
  // Découper le texte en sections par chambre
  for (let i = 0; i < roomPositions.length; i++) {
    const current = roomPositions[i];
    const next = roomPositions[i + 1];
    
    const startIndex = current.index;
    const endIndex = next ? next.index : processedText.length;
    
    const fullText = processedText.substring(startIndex, endIndex).trim();
    
    // Parser les détails de cette ligne logique
    const roomLine = parseRoomSection(
      current.roomNumber, 
      fullText, 
      startIndex, 
      endIndex,
      normalizedExcludeList,
      current.linkedRoom
    );
    
    if (roomLine) {
      roomLines.push(roomLine);
    }
  }
  
  return roomLines;
}

/**
 * Prétraitement du texte pour fusionner les lignes fragmentées
 */
function preprocessText(text: string): string {
  // Remplacer les retours à la ligne multiples par un espace
  // mais garder la structure des sections
  let processed = text
    // Fusionner les lignes qui sont clairement fragmentées (ex: "DBL-" suivi de "C")
    .replace(/([A-Z]{2,3})-\s*\n\s*([A-Z])\s*\n/g, '$1-$2 ')
    // Fusionner les noms fragmentés sur plusieurs lignes
    .replace(/([A-Z][a-zÀ-ÿ]+)\s*\n\s*([A-Z]+)/g, '$1 $2')
    // Supprimer les sauts de ligne excessifs
    .replace(/\n{3,}/g, '\n\n');
  
  return processed;
}

/**
 * Trouve toutes les positions des numéros de chambre dans le texte
 */
function findRoomPositions(text: string): Array<{ 
  index: number; 
  roomNumber: string; 
  linkedRoom?: string;
}> {
  const positions: Array<{ index: number; roomNumber: string; linkedRoom?: string }> = [];
  
  // Pattern pour les chambres communicantes (ex: 003+004, 103+104)
  const connectedPattern = /(?:^|\s)(\d{2,4})\s*[+\-]\s*(\d{2,4})(?:\s+(?:FAM|DUP))?/gm;
  let match;
  
  while ((match = connectedPattern.exec(text)) !== null) {
    // Ignorer si c'est clairement une date (contient /)
    const context = text.substring(Math.max(0, match.index - 5), match.index + match[0].length + 5);
    if (/\d{2}\/\d{2}\/\d{4}/.test(context)) continue;
    
    positions.push({
      index: match.index + (match[0].startsWith(' ') ? 1 : 0),
      roomNumber: `${match[1]}+${match[2]}`,
      linkedRoom: match[2]
    });
  }
  
  // Pattern pour les chambres simples avec type (ex: 101 DBL-C, 308 SGL-C)
  const simplePattern = /(?:^|\n|\s{2,})(\d{2,4})(?:-T)?(?:-?\s*(?:Balcon|Terrasse))?\s+(?:DBL|SGL|TPL|FAM|DUP|STU|SUI|APP|QUA)/gm;
  
  while ((match = simplePattern.exec(text)) !== null) {
    const roomNum = match[1];
    const startPos = match.index + (match[0].match(/^[\n\s]+/)?.[0].length || 0);
    
    // Vérifier qu'on n'a pas déjà cette position (chambre communicante)
    const alreadyExists = positions.some(p => 
      Math.abs(p.index - startPos) < 5 || 
      p.roomNumber.includes(roomNum)
    );
    
    if (!alreadyExists) {
      positions.push({
        index: startPos,
        roomNumber: roomNum
      });
    }
  }
  
  // Pattern pour les sous-chambres (ex: 003-T, 004-T après 003+004)
  const subRoomPattern = /(?:^|\n)(\d{2,4})-?T?\s+(?:DBL|SGL|TPL)/gm;
  
  while ((match = subRoomPattern.exec(text)) !== null) {
    const roomNum = match[1];
    const startPos = match.index + (match[0].startsWith('\n') ? 1 : 0);
    
    // Vérifier qu'on n'a pas déjà cette position
    const alreadyExists = positions.some(p => 
      Math.abs(p.index - startPos) < 3
    );
    
    if (!alreadyExists) {
      positions.push({
        index: startPos,
        roomNumber: roomNum
      });
    }
  }
  
  // Trier par position
  positions.sort((a, b) => a.index - b.index);
  
  // Dédupliquer les positions trop proches
  const deduplicated = positions.filter((pos, i) => {
    if (i === 0) return true;
    return pos.index - positions[i - 1].index > 10;
  });
  
  return deduplicated;
}

/**
 * Parse une section de texte pour une chambre
 */
function parseRoomSection(
  roomNumber: string,
  fullText: string,
  startIndex: number,
  endIndex: number,
  excludeList: string[],
  linkedRoom?: string
): RoomLine | null {
  const upper = fullText.toUpperCase();
  
  // Extraire le type de chambre
  const typeMatch = fullText.match(/\b(DBL|SGL|TPL|FAM|DUP|STU|SUI|APP|QUA)-?([A-Z])?/i);
  const roomType = typeMatch ? typeMatch[0] : undefined;
  
  // Extraire le statut
  const statusMatch = upper.match(/\b(SAL|INS|PRO|VCI|VCO|OCC|ARR|DEP)\b/);
  const statusCode = statusMatch ? statusMatch[1] : undefined;
  
  // Extraire les dates
  const dates = extractDates(fullText);
  
  // Extraire l'info de nuit (ex: "Nuit 3/4")
  const nightInfo = extractNightInfo(fullText);
  
  // Extraire l'occupation (ex: "2 × Adultes 1 × Enfants")
  const occupancy = extractOccupancy(fullText);
  
  // Extraire le nom du client (en excluant les noms de la liste)
  const guestName = extractGuestName(fullText, excludeList);
  
  // Déterminer l'étage
  const floor = roomNumber.length >= 3 ? roomNumber[0] : undefined;
  
  return {
    roomNumber,
    fullText,
    startIndex,
    endIndex,
    floor,
    roomType,
    statusCode,
    guestName,
    dates,
    nightInfo,
    occupancy,
    isLastNight: nightInfo ? nightInfo.current === nightInfo.total : false,
    linkedRoom
  };
}

/**
 * Extraire les dates d'une section
 */
function extractDates(text: string): RoomLine['dates'] {
  const dates: RoomLine['dates'] = {};
  
  // Pattern pour les dates (ex: 07/01/2026, 11/01/2026)
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  const foundDates: string[] = [];
  let match;
  
  while ((match = datePattern.exec(text)) !== null) {
    foundDates.push(match[0]);
  }
  
  // Pattern pour les heures (ex: 15:00, 11:00)
  const timePattern = /(\d{1,2}):(\d{2})/g;
  const foundTimes: string[] = [];
  
  while ((match = timePattern.exec(text)) !== null) {
    const hour = parseInt(match[1]);
    // Filtrer les heures valides (pas les minutes d'une date)
    if (hour >= 0 && hour <= 23) {
      foundTimes.push(match[0]);
    }
  }
  
  // Logique d'attribution des dates
  if (foundDates.length >= 2) {
    dates.arrival = foundDates[0];
    dates.departure = foundDates[1];
  } else if (foundDates.length === 1) {
    // Une seule date: vérifier le contexte
    const upper = text.toUpperCase();
    if (/\bSAL\b/.test(upper) || /\bDEP\b/.test(upper)) {
      dates.departure = foundDates[0];
    } else {
      dates.arrival = foundDates[0];
    }
  }
  
  // Attribution des heures
  if (foundTimes.length >= 2) {
    dates.checkOutTime = foundTimes[0];
    dates.checkInTime = foundTimes[1];
  } else if (foundTimes.length === 1) {
    dates.checkInTime = foundTimes[0];
  }
  
  return dates;
}

/**
 * Extraire l'info de nuit
 */
function extractNightInfo(text: string): { current: number; total: number } | undefined {
  const match = text.match(/Nuit\s*(\d+)\s*[\/\\]\s*(\d+)/i);
  if (match) {
    return {
      current: parseInt(match[1]),
      total: parseInt(match[2])
    };
  }
  return undefined;
}

/**
 * Extraire l'occupation
 */
function extractOccupancy(text: string): { adults: number; children: number } | undefined {
  const adults = text.match(/(\d+)\s*[×x]\s*Adultes?/i);
  const children = text.match(/(\d+)\s*[×x]\s*Enfants?/i);
  
  if (adults || children) {
    return {
      adults: adults ? parseInt(adults[1]) : 0,
      children: children ? parseInt(children[1]) : 0
    };
  }
  return undefined;
}

/**
 * Extraire le nom du client en excluant les noms de la liste d'exclusion
 */
function extractGuestName(text: string, excludeList: string[]): string | undefined {
  // Pattern: rechercher après "Adultes" ou "Enfants"
  const afterOccupancyMatch = text.match(/(?:\d+\s*[×x]\s*(?:Adultes?|Enfants?)\s+)([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]*)*)/i);
  
  // Pattern: rechercher un nom avec prénom/nom
  const namePatterns = [
    // Prénom Nom (ex: "Thierry VIARD")
    /([A-ZÀ-ÿ][a-zà-ÿ]+)\s+([A-ZÀ-ÿ]{2,})/,
    // NOM Prénom (ex: "VIARD Thierry")  
    /([A-ZÀ-ÿ]{2,})\s+([A-ZÀ-ÿ][a-zà-ÿ]+)/,
    // Nom composé (ex: "Lie' Ayny")
    /([A-ZÀ-ÿ][a-zà-ÿ']+)\s+([A-ZÀ-ÿ][a-zà-ÿ]+)/,
  ];
  
  let candidates: string[] = [];
  
  if (afterOccupancyMatch) {
    candidates.push(afterOccupancyMatch[1].trim());
  }
  
  for (const pattern of namePatterns) {
    const matches = text.matchAll(new RegExp(pattern, 'g'));
    for (const m of matches) {
      candidates.push(`${m[1]} ${m[2]}`.trim());
    }
  }
  
  // Filtrer les candidats
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Vérifier si c'est dans la liste d'exclusion
    const isExcluded = excludeList.some(excluded => 
      normalized.includes(excluded) || excluded.includes(normalized.split(' ')[0])
    );
    
    // Vérifier que ce n'est pas un mot-clé
    const keywords = ['adultes', 'enfants', 'nuit', 'nettoyer', 'hotel', 'cardinal', 
                      'etage', 'espaces', 'responsable', 'statut', 'balcon'];
    const isKeyword = keywords.some(kw => normalized.includes(kw));
    
    if (!isExcluded && !isKeyword && candidate.length > 3) {
      return candidate;
    }
  }
  
  return undefined;
}

/**
 * Liste d'exclusion par défaut (à compléter par l'utilisateur)
 */
export const DEFAULT_EXCLUDE_LIST = [
  // Termes génériques à toujours exclure
  'hotel', 'cardinal', 'étage', 'espaces', 'responsable', 'statut',
  'adultes', 'enfants', 'nuit', 'nettoyer', 'balcon', 'terrasse'
];
