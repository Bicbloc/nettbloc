/**
 * RoomLineParser - Parser universel ultra-intelligent pour rapports de chambres
 * Reconnaît n'importe quel format de rapport PMS avec extraction complète
 */

export interface RoomLine {
  roomNumber: string;
  fullText: string;
  confidence: number;          // 0-100% de confiance dans l'extraction
  
  // Données extraites
  roomType?: string;           // DBL, SGL, TPL, FAM, DUP, STU, SUI, APP, QUA, TWN, KNG, etc.
  roomCategory?: string;       // C, S, L, P (Confort, Standard, Luxe, Premium)
  statusCode?: string;         // SAL, INS, PRO, VCI, VCO, OCC, ARR, DEP, DND, OOO, OOS, CHK, CO, CI
  statusLabel?: string;        // Libellé du statut traduit
  
  // Client
  guestName?: string;
  guestCount?: number;         // Nombre total de personnes
  
  // Dates & Horaires
  arrivalDate?: string;        // Format normalisé: JJ/MM/AAAA
  departureDate?: string;      // Format normalisé: JJ/MM/AAAA
  checkInTime?: string;        // Format: HH:MM
  checkOutTime?: string;       // Format: HH:MM
  
  // Séjour
  nightInfo?: { current: number; total: number };
  isLastNight: boolean;
  isFirstNight: boolean;
  stayDuration?: number;       // Nombre de nuits total
  
  // Occupation
  adults?: number;
  children?: number;
  infants?: number;
  
  // Type de nettoyage (déterminé automatiquement)
  cleaningType: 'a_blanc' | 'recouche' | 'none' | 'inspection';
  cleaningReason: string;      // Raison du type choisi
  
  // Métadonnées
  floor?: string;
  building?: string;
  zone?: string;
  linkedRooms?: string[];      // Chambres connectées
  notes?: string[];            // Notes diverses extraites
  vip?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

// ===== PATTERNS DE DÉTECTION UNIVERSELS =====

// Numéros de chambre (tous formats)
const ROOM_PATTERNS = [
  /(?:^|\n|room|chambre|ch\.?|r\.?|zimmer|camera|habitacion|habitación)\s*[#:]?\s*(\d{1,4}[A-Z]?(?:\s*[-+&]\s*\d{1,4}[A-Z]?)?)/gim,
  /(?:^|\n)(\d{3,4}[A-Z]?(?:-T|-[A-Z])?)\s+(?:[A-Z]{2,4}|SAL|OCC|VCI)/gm,
  /(?:^|\n)(\d{2,4}(?:\s*[+\-&]\s*\d{2,4})?)\s+/gm,
];

// Types de chambres (international)
const ROOM_TYPES = [
  'DBL', 'SGL', 'TPL', 'QUA', 'FAM', 'DUP', 'STU', 'SUI', 'APP', 'PEN',  // FR
  'TWN', 'KNG', 'QEN', 'DLX', 'STD', 'SUP', 'JNR', 'SNR', 'EXE',         // EN
  'TWIN', 'KING', 'QUEEN', 'DOUBLE', 'SINGLE', 'TRIPLE', 'SUITE',        // Complets
  'DBLC', 'DBLS', 'DBLL', 'SGLC', 'SGLS',                                 // Avec catégorie
];

// Statuts (multi-langue)
const STATUS_CODES: { [key: string]: { label: string; cleaning: 'a_blanc' | 'recouche' | 'none' | 'inspection' } } = {
  // Français
  'SAL': { label: 'Sale', cleaning: 'recouche' },
  'PRO': { label: 'Propre', cleaning: 'none' },
  'INS': { label: 'Inspecté', cleaning: 'inspection' },
  'OCC': { label: 'Occupé', cleaning: 'recouche' },
  'ARR': { label: 'Arrivée', cleaning: 'a_blanc' },
  'DEP': { label: 'Départ', cleaning: 'a_blanc' },
  // Anglais
  'VCI': { label: 'Vacant Clean Inspected', cleaning: 'none' },
  'VCO': { label: 'Vacant Check Out', cleaning: 'a_blanc' },
  'VDI': { label: 'Vacant Dirty', cleaning: 'a_blanc' },
  'OOO': { label: 'Out of Order', cleaning: 'none' },
  'OOS': { label: 'Out of Service', cleaning: 'none' },
  'DND': { label: 'Do Not Disturb', cleaning: 'none' },
  'CHK': { label: 'Checkout', cleaning: 'a_blanc' },
  'CO': { label: 'Check Out', cleaning: 'a_blanc' },
  'CI': { label: 'Check In', cleaning: 'a_blanc' },
  'SO': { label: 'Stay Over', cleaning: 'recouche' },
  // Allemand
  'AB': { label: 'Abreise', cleaning: 'a_blanc' },
  'AN': { label: 'Ankunft', cleaning: 'a_blanc' },
  'BL': { label: 'Bleibt', cleaning: 'recouche' },
  // Italien
  'PA': { label: 'Partenza', cleaning: 'a_blanc' },
  'AR': { label: 'Arrivo', cleaning: 'a_blanc' },
  'IN': { label: 'In casa', cleaning: 'recouche' },
  // Espagnol
  'SA': { label: 'Salida', cleaning: 'a_blanc' },
  'EN': { label: 'Entrada', cleaning: 'a_blanc' },
  'ES': { label: 'Estancia', cleaning: 'recouche' },
};

// Mots-clés par type
const DEPARTURE_KEYWORDS = ['départ', 'departure', 'checkout', 'check-out', 'abreise', 'partenza', 'salida', 'sortie', 'leaving', 'co'];
const ARRIVAL_KEYWORDS = ['arrivée', 'arrival', 'checkin', 'check-in', 'ankunft', 'arrivo', 'entrada', 'entrée', 'coming', 'ci'];
const STAYOVER_KEYWORDS = ['recouche', 'stayover', 'stay-over', 'bleibt', 'in casa', 'estancia', 'reste', 'staying', 'occ'];

/**
 * Parse le texte brut et le découpe en lignes logiques
 */
export function parseRoomLines(rawText: string, excludeList: string[] = []): RoomLine[] {
  const normalizedExclude = excludeList.map(n => 
    n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );
  
  // Prétraiter le texte
  const text = preprocessText(rawText);
  
  // Trouver toutes les positions de début de chambre
  const positions: { index: number; roomNumber: string }[] = [];
  
  for (const pattern of ROOM_PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const roomNum = match[1].trim().replace(/\s+/g, '');
      
      // Validations
      if (roomNum.includes('/')) continue;  // C'est une date
      if (/^20\d{2}$/.test(roomNum)) continue;  // C'est une année
      if (/^\d{1}$/.test(roomNum)) continue;  // Trop court
      if (roomNum.length > 8) continue;  // Trop long
      
      // Éviter les doublons
      const exists = positions.some(p => 
        Math.abs(p.index - match!.index) < 5 && p.roomNumber === roomNum
      );
      
      if (!exists) {
        positions.push({
          index: match.index,
          roomNumber: roomNum
        });
      }
    }
  }
  
  // Trier par position
  positions.sort((a, b) => a.index - b.index);
  
  // Dédupliquer les positions proches
  const uniquePositions: typeof positions = [];
  for (const pos of positions) {
    const last = uniquePositions[uniquePositions.length - 1];
    if (!last || Math.abs(last.index - pos.index) > 10) {
      uniquePositions.push(pos);
    }
  }
  
  if (uniquePositions.length === 0) return [];
  
  // Découper en sections
  const roomLines: RoomLine[] = [];
  
  for (let i = 0; i < uniquePositions.length; i++) {
    const start = uniquePositions[i].index;
    const end = uniquePositions[i + 1]?.index || text.length;
    const fullText = text.substring(start, end).trim();
    
    const roomLine = parseSection(uniquePositions[i].roomNumber, fullText, normalizedExclude);
    if (roomLine) {
      roomLines.push(roomLine);
    }
  }
  
  return roomLines;
}

/**
 * Prétraitement intelligent du texte
 */
function preprocessText(text: string): string {
  return text
    // Normaliser les fins de ligne
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Fusionner les lignes fragmentées (type de chambre sur 2 lignes)
    .replace(/([A-Z]{2,3})-\s*\n\s*([A-Z])\s*\n/g, '$1-$2 ')
    // Fusionner noms fragmentés sur 2 lignes
    .replace(/([A-ZÀ-ÿ][a-zà-ÿ]+)\s*\n\s*([A-ZÀ-ÿ]{2,})/g, '$1 $2')
    // Normaliser les séparateurs de date
    .replace(/(\d{2})\.(\d{2})\.(\d{4})/g, '$1/$2/$3')
    .replace(/(\d{2})-(\d{2})-(\d{4})/g, '$1/$2/$3')
    // Réduire les espaces multiples
    .replace(/[ \t]{3,}/g, '  ')
    // Supprimer les lignes vides excessives
    .replace(/\n{3,}/g, '\n\n')
    // Nettoyer les caractères spéciaux
    .replace(/[­\u200b\u00ad]/g, '')
    .trim();
}

/**
 * Parse une section de texte pour une chambre
 */
function parseSection(roomNumber: string, fullText: string, excludeList: string[]): RoomLine | null {
  const upper = fullText.toUpperCase();
  const lower = fullText.toLowerCase();
  let confidence = 100;
  
  // === ROOM NUMBER NORMALIZATION ===
  const normalizedRoom = roomNumber.replace(/\s+/g, '');
  
  // === ROOM TYPE ===
  let roomType: string | undefined;
  let roomCategory: string | undefined;
  
  // Pattern avec catégorie (DBL-C, SGL-S)
  const typeWithCatMatch = fullText.match(/\b([A-Z]{2,5})-([A-Z])\b/i);
  if (typeWithCatMatch && ROOM_TYPES.includes(typeWithCatMatch[1].toUpperCase())) {
    roomType = typeWithCatMatch[1].toUpperCase();
    roomCategory = typeWithCatMatch[2].toUpperCase();
  } else {
    // Pattern simple
    for (const type of ROOM_TYPES) {
      const regex = new RegExp(`\\b${type}\\b`, 'i');
      if (regex.test(fullText)) {
        roomType = type;
        break;
      }
    }
  }
  
  // === STATUS CODE ===
  let statusCode: string | undefined;
  let statusLabel: string | undefined;
  let baseCleaningFromStatus: 'a_blanc' | 'recouche' | 'none' | 'inspection' = 'recouche';
  
  for (const [code, info] of Object.entries(STATUS_CODES)) {
    const regex = new RegExp(`\\b${code}\\b`, 'i');
    if (regex.test(fullText)) {
      statusCode = code;
      statusLabel = info.label;
      baseCleaningFromStatus = info.cleaning;
      break;
    }
  }
  
  // === DATES (tous formats) ===
  const datePatterns = [
    /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/g,   // JJ/MM/AAAA, JJ.MM.AAAA, JJ-MM-AAAA
    /(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/g,   // AAAA/MM/JJ
    /(\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/gi,  // 15 Jan 2024
  ];
  
  const foundDates: string[] = [];
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      // Normaliser en JJ/MM/AAAA
      let normalized: string;
      if (match[0].match(/^\d{4}/)) {
        // Format AAAA/MM/JJ
        normalized = `${match[3].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[1]}`;
      } else if (match[0].match(/[A-Za-z]/)) {
        // Format textuel
        const months: { [key: string]: string } = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const monthPart = match[0].match(/[A-Za-z]+/)?.[0]?.toLowerCase().substring(0, 3) || 'jan';
        normalized = `${match[1].padStart(2, '0')}/${months[monthPart]}/${match[2]}`;
      } else {
        normalized = `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
      }
      if (!foundDates.includes(normalized)) {
        foundDates.push(normalized);
      }
    }
  }
  
  // Déterminer arrivée/départ intelligemment
  let arrivalDate: string | undefined;
  let departureDate: string | undefined;
  
  if (foundDates.length === 2) {
    // 2 dates différentes = départ + arrivée (ou arrivée + départ)
    // La première est généralement le départ, la seconde l'arrivée
    const date1Parts = foundDates[0].split('/').map(Number);
    const date2Parts = foundDates[1].split('/').map(Number);
    const d1 = new Date(date1Parts[2], date1Parts[1] - 1, date1Parts[0]);
    const d2 = new Date(date2Parts[2], date2Parts[1] - 1, date2Parts[0]);
    
    if (d1 <= d2) {
      departureDate = foundDates[0];
      arrivalDate = foundDates[1];
    } else {
      arrivalDate = foundDates[0];
      departureDate = foundDates[1];
    }
  } else if (foundDates.length === 1) {
    // 1 seule date = date de la nuit (client reste = recouche) ou départ
    const hasDeparture = DEPARTURE_KEYWORDS.some(k => lower.includes(k));
    const hasArrival = ARRIVAL_KEYWORDS.some(k => lower.includes(k));
    
    if (hasDeparture) {
      departureDate = foundDates[0];
    } else if (hasArrival) {
      arrivalDate = foundDates[0];
    } else {
      // Si pas d'indication, c'est probablement une date de séjour
      arrivalDate = foundDates[0];
    }
  }
  
  // === TIMES ===
  const timePattern = /\b(\d{1,2})[h:](\d{2})\b/gi;
  const times: { time: string; hour: number }[] = [];
  let timeMatch;
  
  while ((timeMatch = timePattern.exec(fullText)) !== null) {
    const hour = parseInt(timeMatch[1]);
    if (hour >= 0 && hour <= 23) {
      times.push({
        time: `${hour.toString().padStart(2, '0')}:${timeMatch[2]}`,
        hour
      });
    }
  }
  
  // Trier par heure
  times.sort((a, b) => a.hour - b.hour);
  
  // Avant 14h = checkout, après 14h = checkin
  const checkOutTime = times.find(t => t.hour < 14)?.time;
  const checkInTime = times.find(t => t.hour >= 14)?.time;
  
  // === NIGHT INFO ===
  const nightPatterns = [
    /Nuit\s*(\d+)\s*[\/\\]\s*(\d+)/i,
    /Night\s*(\d+)\s*[\/\\of]\s*(\d+)/i,
    /(\d+)\s*[\/\\]\s*(\d+)\s*(?:Nuit|Night|N)/i,
    /N\s*(\d+)\s*[\/\\]\s*(\d+)/i,
  ];
  
  let nightInfo: { current: number; total: number } | undefined;
  for (const pattern of nightPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      nightInfo = {
        current: parseInt(match[1]),
        total: parseInt(match[2])
      };
      break;
    }
  }
  
  const isLastNight = nightInfo ? nightInfo.current === nightInfo.total : false;
  const isFirstNight = nightInfo ? nightInfo.current === 1 : false;
  
  // === OCCUPANCY ===
  const adultsPatterns = [
    /(\d+)\s*[×x]\s*(?:Adultes?|Adults?|Adu?)/i,
    /(?:Adultes?|Adults?)\s*[:\s]*(\d+)/i,
    /(\d+)\s*(?:AD|PAX)/i,
  ];
  
  const childrenPatterns = [
    /(\d+)\s*[×x]\s*(?:Enfants?|Children|Kids?|Chi?)/i,
    /(?:Enfants?|Children)\s*[:\s]*(\d+)/i,
    /(\d+)\s*(?:CH|CHD)/i,
  ];
  
  let adults: number | undefined;
  let children: number | undefined;
  
  for (const pattern of adultsPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      adults = parseInt(match[1]);
      break;
    }
  }
  
  for (const pattern of childrenPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      children = parseInt(match[1]);
      break;
    }
  }
  
  // === GUEST NAME ===
  const guestName = extractGuestName(fullText, excludeList);
  
  // === FLOOR & BUILDING ===
  const mainRoom = normalizedRoom.split(/[+\-&]/)[0].replace(/[A-Z]/gi, '');
  const floor = mainRoom.length >= 3 ? mainRoom[0] : mainRoom.length === 2 ? '0' : undefined;
  
  const buildingMatch = fullText.match(/(?:Bâtiment|Building|Block|Bloc)\s*([A-Z0-9]+)/i);
  const building = buildingMatch?.[1];
  
  const zoneMatch = fullText.match(/(?:Zone|Aile|Wing)\s*([A-Z0-9]+)/i);
  const zone = zoneMatch?.[1];
  
  // === LINKED ROOMS ===
  const linkedMatch = normalizedRoom.match(/(\d+)\s*[+\-&]\s*(\d+)/);
  const linkedRooms = linkedMatch ? [linkedMatch[1], linkedMatch[2]] : undefined;
  
  // === VIP & PRIORITY ===
  const vip = /\bVIP\b/i.test(fullText);
  let priority: 'high' | 'normal' | 'low' = 'normal';
  if (vip || /\b(URGENT|PRIORITY|IMPORTANT)\b/i.test(fullText)) priority = 'high';
  if (/\b(LATE|TARD|LAST)\b/i.test(fullText)) priority = 'low';
  
  // === NOTES ===
  const notes: string[] = [];
  const notePatterns = [
    /(?:Note|Remarque|Comment)\s*[:\s]*([^.!\n]+)/gi,
    /\(([^)]+)\)/g,  // Texte entre parenthèses
  ];
  
  for (const pattern of notePatterns) {
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      const note = match[1].trim();
      if (note.length > 3 && note.length < 100) {
        notes.push(note);
      }
    }
  }
  
  // === DETERMINE CLEANING TYPE ===
  // Count guest names for Mews-style logic
  const allGuestNames = extractAllGuestNamesFromLine(fullText);
  
  const { cleaningType, cleaningReason } = determineCleaningType({
    statusCode,
    baseCleaningFromStatus,
    arrivalDate,
    departureDate,
    checkInTime,
    checkOutTime,
    isLastNight,
    isFirstNight,
    fullText: lower,
    guestNameCount: allGuestNames.length
  });
  
  // === CALCULATE CONFIDENCE ===
  if (!roomType) confidence -= 10;
  if (!statusCode) confidence -= 15;
  if (!guestName && (adults || children)) confidence -= 5;
  if (foundDates.length === 0 && !nightInfo) confidence -= 10;
  
  return {
    roomNumber: normalizedRoom,
    fullText,
    confidence: Math.max(0, confidence),
    roomType,
    roomCategory,
    statusCode,
    statusLabel,
    guestName,
    guestCount: (adults || 0) + (children || 0) || undefined,
    arrivalDate,
    departureDate,
    checkInTime,
    checkOutTime,
    nightInfo,
    isLastNight,
    isFirstNight,
    stayDuration: nightInfo?.total,
    adults,
    children,
    cleaningType,
    cleaningReason,
    floor,
    building,
    zone,
    linkedRooms,
    notes: notes.length > 0 ? notes : undefined,
    vip,
    priority
  };
}

/**
 * Extraction intelligente du nom du client
 */
function extractGuestName(text: string, excludeList: string[]): string | undefined {
  // Mots à ignorer
  const IGNORE = new Set([
    'adultes', 'adulte', 'enfants', 'enfant', 'nuit', 'night', 'nettoyer', 
    'hotel', 'room', 'chambre', 'etage', 'floor', 'building', 'batiment',
    'balcon', 'terrasse', 'terrace', 'balcony', 'view', 'vue',
    'sal', 'ins', 'pro', 'occ', 'arr', 'dep', 'vci', 'vco',
    'dbl', 'sgl', 'tpl', 'fam', 'dup', 'twn', 'kng', 'sui',
    'standard', 'superior', 'deluxe', 'premium', 'confort',
    'clean', 'dirty', 'propre', 'sale', 'inspecte', 'inspected',
    'cardinal', 'hotel', 'resort', 'spa'
  ]);
  
  // Patterns de noms (ordre de priorité)
  const patterns = [
    // "Mr/Mme/Mrs NOM Prénom" ou "NOM Prénom"
    /(?:M(?:r|me|rs|iss)?\.?\s+)?([A-ZÀ-ÿ]{2,})\s+([A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)?)/,
    // "Prénom NOM"
    /([A-ZÀ-ÿ][a-zà-ÿ']+)\s+([A-ZÀ-ÿ]{2,}(?:\s+[A-ZÀ-ÿ]{2,})?)/,
    // Après "Guest:" ou "Client:"
    /(?:Guest|Client|Nom)\s*[:\s]+([A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)*)/i,
    // Après occupation "2 × Adultes NOM"
    /\d+\s*[×x]\s*(?:Adultes?|Adults?)\s+([A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][A-Za-zà-ÿ']*)+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let name: string;
      if (match[2]) {
        name = `${match[1]} ${match[2]}`.trim();
      } else {
        name = match[1].trim();
      }
      
      // Nettoyer
      name = name.replace(/\s+/g, ' ').trim();
      
      // Vérifications
      const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const words = normalized.split(' ');
      
      // Ignorer si contient un mot interdit
      if (words.some(w => IGNORE.has(w))) continue;
      
      // Ignorer si dans la liste d'exclusion
      if (excludeList.some(ex => normalized.includes(ex))) continue;
      
      // Doit avoir au moins 4 caractères
      if (name.length < 4) continue;
      
      // Doit avoir au moins 2 parties (prénom + nom) ou être en majuscules
      if (words.length < 2 && !/^[A-ZÀ-ÿ]+$/.test(name)) continue;
      
      return name;
    }
  }
  
  return undefined;
}

/**
 * Extrait tous les noms de clients distincts d'une ligne
 * Réplique la logique de FieldExtractor.extractAllGuestNames pour usage standalone
 */
function extractAllGuestNamesFromLine(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const IGNORE_WORDS = new Set([
    'adultes', 'adulte', 'enfants', 'enfant', 'nuit', 'night',
    'hotel', 'room', 'chambre', 'etage', 'floor',
    'sal', 'ins', 'pro', 'occ', 'arr', 'dep',
    'dbl', 'sgl', 'tpl', 'fam', 'dup', 'twn', 'kng', 'sui',
    'standard', 'superior', 'deluxe', 'cardinal', 'resort',
    'clean', 'dirty', 'propre', 'sale', 'inspected',
    'responsable', 'espaces', 'statut', 'status'
  ]);
  
  const namePatterns = [
    /([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç']+)\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇa-zàâäéèêëïîôùûüç'-]+)/g,
    /([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇa-zàâäéèêëïîôùûüç'-]+),\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç']+(?:\s+[A-Za-z]+)*)/g,
  ];
  
  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[0].replace(/,\s*/, ' ').trim();
      if (name.length < 4) continue;
      const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const words = normalized.split(' ');
      if (words.some(w => IGNORE_WORDS.has(w))) continue;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        names.push(name);
      }
    }
  }
  
  return names;
}

/**
 * Détermine le type de nettoyage avec raison
 */
function determineCleaningType(params: {
  statusCode?: string;
  baseCleaningFromStatus: 'a_blanc' | 'recouche' | 'none' | 'inspection';
  arrivalDate?: string;
  departureDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  isLastNight?: boolean;
  isFirstNight?: boolean;
  fullText: string;
  guestNameCount?: number;
}): { cleaningType: 'a_blanc' | 'recouche' | 'none' | 'inspection'; cleaningReason: string } {
  const { 
    statusCode, baseCleaningFromStatus, 
    arrivalDate, departureDate, 
    checkInTime, checkOutTime,
    isLastNight, isFirstNight,
    fullText,
    guestNameCount
  } = params;
  
  // === STATUTS PRIORITAIRES (pas de ménage) ===
  if (['INS', 'VCI'].includes(statusCode || '')) {
    return { cleaningType: 'inspection', cleaningReason: 'Chambre déjà inspectée' };
  }
  
  if (['PRO', 'OOO', 'OOS', 'DND'].includes(statusCode || '')) {
    return { cleaningType: 'none', cleaningReason: `Statut ${statusCode}` };
  }
  
  // === RÈGLE NOMS CLIENTS (logique Mews): 2 noms = à blanc, 1 nom = recouche ===
  if (guestNameCount !== undefined && guestNameCount > 0 && ['SAL', 'OCC'].includes(statusCode || '')) {
    if (guestNameCount >= 2) {
      return { cleaningType: 'a_blanc', cleaningReason: `${guestNameCount} clients détectés (checkout+checkin)` };
    }
    if (guestNameCount === 1) {
      return { cleaningType: 'recouche', cleaningReason: '1 seul client (séjour en cours)' };
    }
  }
  
  // === RÈGLE PRINCIPALE: 2 DATES = À BLANC ===
  if (arrivalDate && departureDate) {
    return { 
      cleaningType: 'a_blanc', 
      cleaningReason: `Départ (${departureDate}) + Arrivée (${arrivalDate})` 
    };
  }
  
  // === 2 HORAIRES = À BLANC (même jour) ===
  if (checkOutTime && checkInTime) {
    return { 
      cleaningType: 'a_blanc', 
      cleaningReason: `Départ ${checkOutTime} + Arrivée ${checkInTime}` 
    };
  }
  
  // === DERNIÈRE NUIT = À BLANC ===
  if (isLastNight) {
    return { cleaningType: 'a_blanc', cleaningReason: 'Dernière nuit (départ demain)' };
  }
  
  // === DÉPART UNIQUEMENT = À BLANC ===
  if (departureDate && !arrivalDate) {
    return { cleaningType: 'a_blanc', cleaningReason: `Départ le ${departureDate}` };
  }
  
  // === CHECKOUT SANS CHECKIN = À BLANC ===
  if (checkOutTime && !checkInTime) {
    return { cleaningType: 'a_blanc', cleaningReason: `Départ à ${checkOutTime}` };
  }
  
  // === MOTS-CLÉS DÉPART ===
  if (DEPARTURE_KEYWORDS.some(k => fullText.includes(k))) {
    return { cleaningType: 'a_blanc', cleaningReason: 'Mot-clé départ détecté' };
  }
  
  // === STATUT DÉPART ===
  if (['DEP', 'VCO', 'VDI', 'CO', 'CHK', 'AB', 'PA', 'SA'].includes(statusCode || '')) {
    return { cleaningType: 'a_blanc', cleaningReason: `Statut ${statusCode} (départ)` };
  }
  
  // === 1 SEULE DATE = RECOUCHE ===
  if ((arrivalDate && !departureDate) || (!arrivalDate && departureDate === undefined)) {
    return { cleaningType: 'recouche', cleaningReason: 'Client en séjour (1 seule date)' };
  }
  
  // === PREMIÈRE NUIT = RECOUCHE ===
  if (isFirstNight) {
    return { cleaningType: 'recouche', cleaningReason: 'Première nuit' };
  }
  
  // === MOTS-CLÉS SÉJOUR ===
  if (STAYOVER_KEYWORDS.some(k => fullText.includes(k))) {
    return { cleaningType: 'recouche', cleaningReason: 'Mot-clé séjour détecté' };
  }
  
  // === STATUT OCCUPATION ===
  if (['OCC', 'SO', 'BL', 'IN', 'ES'].includes(statusCode || '')) {
    return { cleaningType: 'recouche', cleaningReason: `Statut ${statusCode} (occupé)` };
  }
  
  // === FALLBACK AU STATUT DE BASE ===
  if (baseCleaningFromStatus !== 'recouche') {
    return { cleaningType: baseCleaningFromStatus, cleaningReason: `Basé sur statut ${statusCode}` };
  }
  
  // === PAR DÉFAUT ===
  return { cleaningType: 'recouche', cleaningReason: 'Pas assez d\'informations (défaut)' };
}

/**
 * Liste d'exclusion par défaut
 */
export const DEFAULT_EXCLUDE_LIST: string[] = [];
