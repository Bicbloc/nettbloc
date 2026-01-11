/**
 * RoomLineParser - Parser intelligent pour découper le texte en lignes logiques par chambre
 * Chaque ligne = du numéro de chambre au prochain numéro de chambre
 */

export interface RoomLine {
  roomNumber: string;
  fullText: string;
  
  // Données extraites
  roomType?: string;        // DBL, SGL, TPL, FAM, DUP...
  roomCategory?: string;    // C, S (Confort, Standard)
  statusCode?: string;      // SAL, INS, PRO, VCI, VCO...
  
  // Client
  guestName?: string;
  
  // Dates & Horaires
  arrivalDate?: string;     // Format: JJ/MM/AAAA
  departureDate?: string;   // Format: JJ/MM/AAAA
  checkInTime?: string;     // Format: HH:MM
  checkOutTime?: string;    // Format: HH:MM
  
  // Séjour
  nightInfo?: { current: number; total: number };
  isLastNight: boolean;
  isFirstNight: boolean;
  
  // Occupation
  adults?: number;
  children?: number;
  
  // Type de nettoyage suggéré
  suggestedCleaningType: 'a_blanc' | 'recouche' | 'none';
  
  // Métadonnées
  floor?: string;
  linkedRooms?: string[];   // Pour 003+004 FAM
}

// Pattern principal pour détecter un numéro de chambre au début d'une section
const ROOM_START_PATTERN = /(?:^|\n)(\d{2,4}(?:\s*[+\-]\s*\d{2,4})?(?:-T)?(?:-?\s*(?:Balcon|Terrasse))?)\s+/gm;

/**
 * Parse le texte brut et le découpe en lignes logiques
 */
export function parseRoomLines(rawText: string, excludeList: string[] = []): RoomLine[] {
  const normalizedExclude = excludeList.map(n => 
    n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  );
  
  // Prétraiter le texte pour fusionner les lignes fragmentées
  const text = preprocessText(rawText);
  
  // Trouver toutes les positions de début de chambre
  const positions: { index: number; roomNumber: string }[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = ROOM_START_PATTERN.exec(text)) !== null) {
    const roomNum = match[1].trim();
    
    // Ignorer si c'est une date (contient /)
    if (roomNum.includes('/')) continue;
    
    // Ignorer les numéros qui ressemblent à des années
    if (/^20\d{2}$/.test(roomNum)) continue;
    
    positions.push({
      index: match.index + (match[0].match(/^\n/)?.[0]?.length || 0),
      roomNumber: roomNum
    });
  }
  
  if (positions.length === 0) return [];
  
  // Découper en sections
  const roomLines: RoomLine[] = [];
  
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = positions[i + 1]?.index || text.length;
    const fullText = text.substring(start, end).trim();
    
    const roomLine = parseSection(positions[i].roomNumber, fullText, normalizedExclude);
    if (roomLine) {
      roomLines.push(roomLine);
    }
  }
  
  return roomLines;
}

/**
 * Prétraitement du texte
 */
function preprocessText(text: string): string {
  return text
    // Fusionner DBL- + C sur deux lignes
    .replace(/([A-Z]{2,3})-\s*\n\s*([A-Z])\s*\n/g, '$1-$2 ')
    // Fusionner noms fragmentés
    .replace(/([A-ZÀ-ÿ][a-zà-ÿ]+)\s*\n\s*([A-ZÀ-ÿ]{2,})/g, '$1 $2')
    // Réduire les espaces multiples
    .replace(/[ \t]{3,}/g, '  ')
    // Supprimer les lignes vides excessives
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Parse une section de texte pour une chambre
 */
function parseSection(roomNumber: string, fullText: string, excludeList: string[]): RoomLine | null {
  const upper = fullText.toUpperCase();
  
  // === ROOM TYPE & CATEGORY ===
  const typeMatch = fullText.match(/\b(DBL|SGL|TPL|FAM|DUP|STU|SUI|APP|QUA)-?([A-Z])?/i);
  const roomType = typeMatch?.[1]?.toUpperCase();
  const roomCategory = typeMatch?.[2]?.toUpperCase();
  
  // === STATUS CODE ===
  const statusMatch = upper.match(/\b(SAL|INS|PRO|VCI|VCO|OCC|ARR|DEP|DND|OOO|OOS)\b/);
  const statusCode = statusMatch?.[1];
  
  // === DATES ===
  const dates = fullText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
  const arrivalDate = dates[0];
  const departureDate = dates[1];
  
  // === TIMES ===
  const times = fullText.match(/\b(\d{1,2}:\d{2})\b/g) || [];
  // Filtrer les heures valides (pas les ratios comme 3/4)
  const validTimes = times.filter(t => {
    const hour = parseInt(t.split(':')[0]);
    return hour >= 6 && hour <= 23;
  });
  const checkOutTime = validTimes.find(t => parseInt(t.split(':')[0]) < 14);
  const checkInTime = validTimes.find(t => parseInt(t.split(':')[0]) >= 14);
  
  // === NIGHT INFO ===
  const nightMatch = fullText.match(/Nuit\s*(\d+)\s*[\/\\]\s*(\d+)/i);
  const nightInfo = nightMatch ? {
    current: parseInt(nightMatch[1]),
    total: parseInt(nightMatch[2])
  } : undefined;
  
  const isLastNight = nightInfo ? nightInfo.current === nightInfo.total : false;
  const isFirstNight = nightInfo ? nightInfo.current === 1 : false;
  
  // === OCCUPANCY ===
  const adultsMatch = fullText.match(/(\d+)\s*[×x]\s*Adultes?/i);
  const childrenMatch = fullText.match(/(\d+)\s*[×x]\s*Enfants?/i);
  const adults = adultsMatch ? parseInt(adultsMatch[1]) : undefined;
  const children = childrenMatch ? parseInt(childrenMatch[1]) : undefined;
  
  // === GUEST NAME ===
  const guestName = extractGuestName(fullText, excludeList);
  
  // === FLOOR ===
  const mainRoom = roomNumber.split(/[+\-]/)[0].replace(/\D/g, '');
  const floor = mainRoom.length >= 3 ? mainRoom[0] : undefined;
  
  // === LINKED ROOMS ===
  const linkedMatch = roomNumber.match(/(\d+)\s*[+\-]\s*(\d+)/);
  const linkedRooms = linkedMatch ? [linkedMatch[1], linkedMatch[2]] : undefined;
  
  // === SUGGESTED CLEANING TYPE ===
  const suggestedCleaningType = determineSuggestedCleaningType(statusCode, isLastNight, checkOutTime);
  
  return {
    roomNumber,
    fullText,
    roomType,
    roomCategory,
    statusCode,
    guestName,
    arrivalDate,
    departureDate,
    checkInTime,
    checkOutTime,
    nightInfo,
    isLastNight,
    isFirstNight,
    adults,
    children,
    suggestedCleaningType,
    floor,
    linkedRooms
  };
}

/**
 * Extraction intelligente du nom du client
 */
function extractGuestName(text: string, excludeList: string[]): string | undefined {
  // Mots-clés à ignorer (statuts, termes génériques)
  const IGNORE_WORDS = [
    'adultes', 'adulte', 'enfants', 'enfant', 'nuit', 'nettoyer', 
    'hotel', 'cardinal', 'etage', 'espaces', 'responsable', 'statut',
    'balcon', 'terrasse', 'sal', 'ins', 'pro', 'dbl', 'sgl', 'tpl', 'fam', 'dup'
  ];
  
  // Pattern 1: Après "X × Adultes" - le nom suit généralement
  const afterAdultsMatch = text.match(/\d+\s*[×x]\s*(?:Adultes?|Enfants?)\s+([A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']*)*)/i);
  
  // Pattern 2: Nom en MAJUSCULES avec prénom
  const upperNameMatch = text.match(/([A-ZÀ-ÿ][a-zà-ÿ']+)\s+([A-ZÀ-ÿ]{2,}(?:\s+[A-ZÀ-ÿ]{2,})*)/);
  
  // Pattern 3: NOM PRENOM format
  const reverseNameMatch = text.match(/([A-ZÀ-ÿ]{2,})\s+([A-ZÀ-ÿ][a-zà-ÿ']+)/);
  
  const candidates: string[] = [];
  
  if (afterAdultsMatch?.[1]) candidates.push(afterAdultsMatch[1].trim());
  if (upperNameMatch) candidates.push(`${upperNameMatch[1]} ${upperNameMatch[2]}`.trim());
  if (reverseNameMatch) candidates.push(`${reverseNameMatch[1]} ${reverseNameMatch[2]}`.trim());
  
  // Filtrer les candidats
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Vérifier la liste d'exclusion
    const isExcluded = excludeList.some(ex => 
      normalized.includes(ex) || ex.includes(normalized.split(' ')[0])
    );
    
    // Vérifier les mots-clés à ignorer
    const isIgnored = IGNORE_WORDS.some(w => normalized.includes(w));
    
    // Doit avoir au moins 4 caractères et contenir un espace (prénom + nom)
    if (!isExcluded && !isIgnored && candidate.length >= 4) {
      return candidate;
    }
  }
  
  return undefined;
}

/**
 * Détermine le type de nettoyage suggéré basé sur le statut et les infos
 */
function determineSuggestedCleaningType(
  statusCode?: string, 
  isLastNight?: boolean,
  checkOutTime?: string
): 'a_blanc' | 'recouche' | 'none' {
  // INS = Inspecté, PRO = Propre -> Pas de ménage
  if (statusCode === 'INS' || statusCode === 'PRO' || statusCode === 'VCI' || statusCode === 'OOO' || statusCode === 'OOS') {
    return 'none';
  }
  
  // SAL = Sale avec départ ou dernière nuit -> À blanc
  if (statusCode === 'SAL' || statusCode === 'DEP' || statusCode === 'VCO') {
    if (isLastNight || checkOutTime) {
      return 'a_blanc';
    }
    return 'recouche';
  }
  
  // OCC = Occupé -> Recouche
  if (statusCode === 'OCC' || statusCode === 'ARR') {
    return 'recouche';
  }
  
  // Par défaut, si dernière nuit -> À blanc, sinon recouche
  return isLastNight ? 'a_blanc' : 'recouche';
}

/**
 * Liste d'exclusion par défaut
 */
export const DEFAULT_EXCLUDE_LIST: string[] = [];
