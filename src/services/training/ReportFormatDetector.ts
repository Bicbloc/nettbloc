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
    { patterns: [/\b(PARTI|RECOUCHE|DEPART|DRAPS)\b/], weight: 3 },
    { patterns: [/Medialog/i], weight: 15 },
    { patterns: [/MEMO\s+GOUVERNANTE/i], weight: 5 },
    { patterns: [/S\s*=\s*Sale/i], weight: 5 },
    { patterns: [/^\d{3}\s+(?:PARTI|RECOUCHE|DEPART|DRAPS)\s+[A-Z]\s+[A-Z]{3}/m], weight: 10 },
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
  
  return bestScore >= 15 ? bestFormat : 'generic_table';
}

// =========== PARSING PAR FORMAT ===========

function parseReportByFormat(text: string, format: ReportFormat): ParsedReportData {
  let result: ParsedReportData;
  
  switch (format) {
    case 'mews_space_status':
      result = parseMewsReport(text);
      break;
    case 'apaleo_housekeeping':
      result = parseApaleoReport(text);
      break;
    case 'medialog_etat':
      result = parseMedialogReport(text);
      break;
    default:
      return parseGenericReport(text);
  }
  
  // Fallback: si le parser spécifique retourne 0 lignes, utiliser le parser générique
  if (result.rows.length === 0) {
    console.warn(`⚠️ Le parser ${format} n'a retourné aucune chambre — fallback vers parser générique`);
    return parseGenericReport(text);
  }
  
  return result;
}

/**
 * Parser spécialisé Mews Space Status
 * Format: "101 TWS DIR Farid 05/05/2025 1 × Adults Name , Night 2/2 07/05/2025"
 */
function parseMewsReport(text: string): ParsedReportData {
  const rows: ParsedRow[] = [];
  
  // Normaliser le texte - joindre les lignes qui font partie d'une même entrée
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, '\n');
  
  const lines = normalizedText.split('\n');
  
  // Pattern principal pour détecter le début d'une chambre
  // Format: "001   DBL-" ou "101-T   DBL-" ou "003+004   DUP"
  const roomStartPattern = /^(\d{3,4}(?:-[A-Z])?(?:\+\d{3,4})?)\s+([A-Z]{2,4})/;
  
  // Pattern pour les statuts Mews
  const statusPattern = /\b(DIR|INS|PRO|SAL)\b/;
  
  // Pattern pour "Nuit X/Y"
  const nightPattern = /Nuit\s+(\d+)\/(\d+)/i;
  
  // Pattern pour les dates (format DD/MM/YYYY)
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
  
  // Pattern pour les heures
  const timePattern = /\b(\d{2}:\d{2})\b/g;
  
  // Pattern pour les noms de clients (après "Adultes" ou "Enfants" avec ×)
  // Format: "1 × Adults Guoda Cirtautaite" ou "2 × Adultes NOM PRENOM"
  const guestPatternMews = /\d+\s*×\s*(?:Adults?|Adultes?|Enfants?|Children)\s+([A-ZÀ-Ÿa-zà-ÿ][A-Za-zÀ-ÿ',\.\-\s]+?)(?=\s*(?:,\s*Nuit|Night|\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{2}:\d{2}|$))/gi;
  
  // Pattern alternatif sans × : "Adultes NOM"
  const guestPatternAlt = /(?:Adultes?|Adults?|Enfants?)\s+([A-ZÀ-Ÿa-zà-ÿ][A-Za-zÀ-ÿ',\.\-\s]*?)(?=\s*(?:,\s*Nuit|Night|\d{2}\/\d{2}\/\d{4}|$|\n))/gi;
  
  // Pattern pour noms en format "Prénom NOM" ou "NOM Prénom" après dates/heures
  const nameAfterTimePattern = /\d{2}:\d{2}\s+\d+\s*×\s*(?:Adults?|Adultes?|Enfants?|Children)\s+([A-ZÀ-Ÿa-zà-ÿ][A-Za-zÀ-ÿ\s\-',\.]+?)(?=\s*(?:\d{2}[\/\-]|$|Nuit|Night|,))/gi;
  
  // Pattern pour extraire nom entre date et "Nuit X/Y" ou fin de ligne
  // Format: "04/05/2025 1 × Adults Guoda Cirtautaite , Night 3/3 07/05/2025"
  const nameInContextPattern = /\d{2}[\/\-]\d{2}[\/\-]\d{4}\s+\d+\s*×\s*(?:Adults?|Adultes?)\s+([A-ZÀ-Ÿa-zà-ÿ][A-Za-zÀ-ÿ\s\-',\.]+?)(?:\s*,?\s*(?:Nuit|Night)\s+\d+\/\d+|\s+\d{2}[\/\-]\d{2}[\/\-]\d{4})/gi;
  
  // Reconstruire le contenu par chambre - grouper les lignes consécutives
  let currentRoomData = '';
  let roomEntries: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue;
    
    // Skip les en-têtes
    if (isHeaderLine(line)) continue;
    if (/^Étage\s+Espaces/i.test(line)) continue;
    if (/^Floor\s+Spaces/i.test(line)) continue;
    if (/^Hotel\s+/i.test(line)) continue;
    if (/^\d+\s*\/\s*\d+$/.test(line)) continue; // Pagination
    
    // Vérifier si c'est le début d'une nouvelle chambre
    if (roomStartPattern.test(line)) {
      // Sauvegarder l'entrée précédente si elle existe
      if (currentRoomData) {
        roomEntries.push(currentRoomData);
      }
      currentRoomData = line;
    } else if (currentRoomData) {
      // Continuer à accumuler les données de la chambre courante
      currentRoomData += ' ' + line;
    }
  }
  
  // Ajouter la dernière entrée
  if (currentRoomData) {
    roomEntries.push(currentRoomData);
  }
  
  // Maintenant parser chaque entrée de chambre
  for (const entry of roomEntries) {
    const roomMatch = entry.match(roomStartPattern);
    if (!roomMatch) continue;
    
    const roomNumber = roomMatch[1];
    const roomType = roomMatch[2];
    
    // Trouver le statut
    const statusMatch = entry.match(statusPattern);
    const status = statusMatch ? statusMatch[1].toUpperCase() : '';
    
    // Skip si pas de statut valide
    if (!status) continue;
    
    // Extraire les dates
    const dates = [...entry.matchAll(datePattern)].map(m => m[1]);
    const arrivalDate = dates.length > 0 ? dates[0] : '';
    const departureDate = dates.length > 1 ? dates[1] : dates[0] || '';
    
    // Extraire les heures
    const times = [...entry.matchAll(timePattern)].map(m => m[1]);
    
    // Extraire le nom du client - essayer plusieurs patterns
    let guestName = '';
    
    // 1. Essayer le pattern principal avec ×
    const mewsMatches = [...entry.matchAll(guestPatternMews)];
    if (mewsMatches.length > 0) {
      // Prendre le dernier match (généralement le client actuel)
      guestName = mewsMatches[mewsMatches.length - 1][1].trim();
    }
    
    // 2. Essayer le pattern contextuel (date + adultes + nom + nuit)
    if (!guestName) {
      const contextMatches = [...entry.matchAll(nameInContextPattern)];
      if (contextMatches.length > 0) {
        guestName = contextMatches[contextMatches.length - 1][1].trim();
      }
    }
    
    // 3. Essayer le pattern après heure
    if (!guestName) {
      const afterTimeMatches = [...entry.matchAll(nameAfterTimePattern)];
      if (afterTimeMatches.length > 0) {
        guestName = afterTimeMatches[afterTimeMatches.length - 1][1].trim();
      }
    }
    
    // 4. Essayer le pattern alternatif sans ×
    if (!guestName) {
      const altMatches = [...entry.matchAll(guestPatternAlt)];
      if (altMatches.length > 0) {
        guestName = altMatches[0][1].trim();
      }
    }
    
    // Nettoyer le nom (enlever les virgules, espaces multiples, caractères de fin)
    guestName = guestName
      .replace(/[,\s]+$/, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*$/, '')
      .trim();
    
    // Exclure les noms qui sont clairement des assignés (souvent tout en majuscules ou un seul mot répétitif)
    if (guestName && guestName.toUpperCase() === guestName && guestName.split(' ').length <= 1) {
      // Probablement un assigné, pas un client - vérifier si c'est dans la partie assigné
      const assigneeMatch = entry.match(new RegExp(`${status}\\s+${guestName}`, 'i'));
      if (assigneeMatch) {
        guestName = '';
      }
    }
    
    // Nettoyer le nom (enlever les virgules de fin, etc.)
    guestName = guestName.replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
    
    // Extraire info nuit
    const nightMatch = entry.match(nightPattern);
    const nightInfo = nightMatch ? `${nightMatch[1]}/${nightMatch[2]}` : '';
    
    // Extraire l'assigné (nom après le statut, avant les données client)
    let assignee = '';
    const assigneePattern = new RegExp(`${status}\\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\\s+[A-ZÀ-Ÿ][a-zà-ÿ]*)?)`);
    const assigneeMatch = entry.match(assigneePattern);
    if (assigneeMatch) {
      assignee = assigneeMatch[1].trim();
    }
    
    // Déterminer le type de nettoyage
    const hasGuest = guestName.length > 0 || times.length > 0 || dates.length > 0;
    const hasNightInfo = !!nightMatch;
    const currentNight = nightMatch ? parseInt(nightMatch[1]) : 0;
    const totalNights = nightMatch ? parseInt(nightMatch[2]) : 0;
    const isLastNight = hasNightInfo && currentNight === totalNights;
    
    // Logique de nettoyage Mews
    let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
    let statusIndicator = status;
    
    if (status === 'DIR' || status === 'SAL') {
      // DIR/SAL = chambre sale
      if (hasNightInfo && !isLastNight) {
        // Client en place, pas dernier jour = recouche
        detectedType = 'quick';
        statusIndicator = `${status} (Recouche)`;
      } else if (!hasGuest) {
        // Pas de client = chambre vacante sale = à blanc
        detectedType = 'full';
        statusIndicator = `${status} (Vacant)`;
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
      if (hasGuest) {
        // Client attendu ou en place = recouche probable
        detectedType = 'quick';
        statusIndicator = `${status} (Recouche)`;
      } else {
        // Chambre vide et propre = aucun nettoyage
        detectedType = 'none';
        statusIndicator = `${status} (Propre)`;
      }
    }
    
    // Créer la ligne
    const columns: ColumnValue[] = [
      { value: roomNumber, type: 'room_number', confidence: 1 },
      { value: roomType, type: 'room_type', confidence: 1 },
      { value: status, type: 'status', confidence: 1 },
      { value: assignee, type: 'assignee', confidence: 0.8 },
      { value: guestName, type: 'guest_name', confidence: 0.9 },
      { value: arrivalDate, type: 'arrival_date', confidence: 0.8 },
      { value: departureDate, type: 'departure_date', confidence: 0.8 },
      { value: nightInfo, type: 'night_info', confidence: 0.9 },
    ];
    
    rows.push({
      rawLine: entry,
      roomNumber,
      roomType,
      cleaningStatus: status,
      columns,
      detectedCleaningType: detectedType,
      confidence: detectedType !== 'unknown' ? 0.85 : 0.3,
      statusIndicator,
      guestName,
      arrivalDate,
      departureDate,
      arrivalTime: times[0] || '',
      departureTime: times[1] || times[0] || '',
      nightInfo,
      hasCurrentGuest: hasGuest,
      hasDepartingGuest: isLastNight,
      hasArrivingGuest: currentNight === 1,
      isOutOfOrder: false,
      assignee,
    });
  }
  
  // Calculer le résumé
  const summary = calculateSummary(rows);
  
  return {
    headers: ['N° Chambre', 'Type', 'Statut', 'Assigné', 'Client', 'Arrivée', 'Départ', 'Nuit', 'Type nettoyage'],
    rows,
    summary,
  };
}

/**
 * Parser Apaleo Housekeeping - Version améliorée
 * Gère les doublons (Parti + En arrivée) en priorisant les arrivées
 * Extrait noms clients, dates, heures
 */
function parseApaleoReport(text: string): ParsedReportData {
  const normalizedText = text.replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  
  // Map pour regrouper les entrées par chambre
  const roomEntriesMap = new Map<string, {
    departing?: ParsedRow;
    arriving?: ParsedRow;
    staying?: ParsedRow;
  }>();
  
  // Patterns Apaleo améliorés pour gérer les numéros à 2 chiffres
  // Format: "01 Chambre twin 17/05/2025 15:00 ..."
  // ou "01   Chambre twin   17/05/2025..."
  const roomPattern = /^(\d{2,4})\s+(Chambre\s+\w+)/i;
  
  // Pattern alternatif pour lignes avec plus d'espaces ou format différent
  const roomPatternAlt = /^\s*(\d{2,4})\s+(?:Chambre\s+)?(\w+(?:\s+\w+)?)\s+(\d{2}\/\d{2}\/\d{4})/i;
  
  const statusPattern = /\b(Recouche|Parti|En\s+arrivée|Arrivé)\b/i;
  const datePattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/g;
  
  // Pattern pour extraire le nom du client
  // Format: "2 adultes NOM PRENOM" ou "1 adulte NOM"
  const guestPattern = /\d+\s+adultes?\s*(?:,\s*\d+\s+enfants?\s*(?:\(\d+\))?)?\s+([A-ZÀ-Ÿa-zà-ÿ][A-Za-zÀ-ÿ\-\'\s]+?)(?=\s+(?:Recouche|Parti|En\s+arrivée|Arrivé|$))/i;
  
  // Pattern alternatif pour nom après "enfant(s) (age)"
  const guestPatternAlt = /(?:\d+\s+adultes?(?:,\s*\d+\s+enfants?\s*\(\d+\))?)\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\-\'\s]+?)(?=\s+(?:Recouche|Parti|En\s+arrivée|Arrivé))/i;
  
  // Accumuler les lignes pour chaque entrée de chambre
  let currentEntry = '';
  let roomEntries: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    if (isHeaderLine(trimmed)) continue;
    if (/^Ch\.\s+Type/i.test(trimmed)) continue; // En-tête tableau
    if (/^\d+\s*$/.test(trimmed)) continue; // Numéro de page seul
    if (/^Imprimé le/i.test(trimmed)) continue;
    
    // Vérifier si c'est le début d'une nouvelle chambre (pattern principal ou alternatif)
    const isNewRoom = roomPattern.test(trimmed) || roomPatternAlt.test(trimmed);
    
    if (isNewRoom) {
      if (currentEntry) {
        roomEntries.push(currentEntry);
      }
      currentEntry = trimmed;
    } else if (currentEntry) {
      // Continuer à accumuler les données
      currentEntry += ' ' + trimmed;
    }
  }
  
  // Ajouter la dernière entrée
  if (currentEntry) {
    roomEntries.push(currentEntry);
  }
  
  console.log(`📋 Apaleo: ${roomEntries.length} entrées de chambre trouvées`);
  
  // Parser chaque entrée
  for (const entry of roomEntries) {
    // Essayer le pattern principal, puis alternatif
    let roomMatch = entry.match(roomPattern);
    let roomNumber = '';
    let roomType = '';
    
    if (roomMatch) {
      roomNumber = roomMatch[1];
      roomType = roomMatch[2];
    } else {
      // Essayer le pattern alternatif
      const altMatch = entry.match(roomPatternAlt);
      if (altMatch) {
        roomNumber = altMatch[1];
        roomType = altMatch[2] || 'Chambre';
      }
    }
    
    if (!roomNumber) continue;
    
    // Normaliser le numéro de chambre (garder les zéros devant)
    roomNumber = roomNumber.padStart(2, '0');
    
    console.log(`🏠 Chambre détectée: ${roomNumber} - ${roomType}`);
    
    // Extraire le statut
    const statusMatch = entry.match(statusPattern);
    const status = statusMatch ? statusMatch[1] : '';
    
    if (!status) continue;
    
    // Extraire les dates et heures
    const dates: { date: string; time: string }[] = [];
    let dateMatch;
    const dateRegex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/g;
    while ((dateMatch = dateRegex.exec(entry)) !== null) {
      dates.push({ date: dateMatch[1], time: dateMatch[2] });
    }
    
    const arrivalDate = dates.length > 0 ? dates[0].date : '';
    const arrivalTime = dates.length > 0 ? dates[0].time : '';
    const departureDate = dates.length > 1 ? dates[1].date : '';
    const departureTime = dates.length > 1 ? dates[1].time : '';
    
    // Extraire le nom du client
    let guestName = '';
    const guestMatch = entry.match(guestPattern) || entry.match(guestPatternAlt);
    if (guestMatch) {
      guestName = guestMatch[1].trim();
    } else {
      // Fallback: chercher le nom entre les adultes et le statut
      const fallbackPattern = /\d+\s+adultes?[^A-Z]*([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\-\'\s]+?)(?=\s+(?:Recouche|Parti|En|Arrivé))/i;
      const fallbackMatch = entry.match(fallbackPattern);
      if (fallbackMatch) {
        guestName = fallbackMatch[1].trim();
      }
    }
    
    // Nettoyer le nom
    guestName = guestName.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
    
    // Déterminer le type de nettoyage
    let detectedType: 'full' | 'quick' | 'none' | 'out_of_service' | 'unknown' = 'unknown';
    let statusIndicator = status;
    let hasDepartingGuest = false;
    let hasArrivingGuest = false;
    let hasCurrentGuest = false;
    
    if (/parti/i.test(status)) {
      detectedType = 'full';
      statusIndicator = 'Départ';
      hasDepartingGuest = true;
    } else if (/en\s+arrivée/i.test(status)) {
      detectedType = 'full';
      statusIndicator = 'Arrivée';
      hasArrivingGuest = true;
    } else if (/arrivé/i.test(status)) {
      detectedType = 'quick'; // Arrivé = client en place, recouche
      statusIndicator = 'Arrivé';
      hasCurrentGuest = true;
    } else if (/recouche/i.test(status)) {
      detectedType = 'quick';
      statusIndicator = 'Recouche';
      hasCurrentGuest = true;
    }
    
    const row: ParsedRow = {
      rawLine: entry,
      roomNumber,
      roomType,
      cleaningStatus: status,
      columns: [
        { value: roomNumber, type: 'room_number', confidence: 1 },
        { value: roomType, type: 'room_type', confidence: 1 },
        { value: status, type: 'status', confidence: 0.95 },
        { value: guestName, type: 'guest_name', confidence: 0.9 },
        { value: arrivalDate, type: 'arrival_date', confidence: 0.9 },
        { value: departureDate, type: 'departure_date', confidence: 0.9 },
      ],
      detectedCleaningType: detectedType,
      confidence: 0.9,
      statusIndicator,
      guestName,
      arrivalDate,
      departureDate,
      arrivalTime,
      departureTime,
      nightInfo: '',
      hasCurrentGuest,
      hasDepartingGuest,
      hasArrivingGuest,
      isOutOfOrder: false,
      assignee: '',
    };
    
    // Stocker dans la map pour gérer les doublons
    const existing = roomEntriesMap.get(roomNumber) || {};
    
    if (hasDepartingGuest) {
      existing.departing = row;
    } else if (hasArrivingGuest) {
      existing.arriving = row;
    } else {
      existing.staying = row;
    }
    
    roomEntriesMap.set(roomNumber, existing);
  }
  
  // Construire le tableau final en priorisant les arrivées
  const finalRows: ParsedRow[] = [];
  
  for (const [roomNumber, entries] of roomEntriesMap) {
    // Priorité: Arrivée > Recouche > Départ
    // Si une chambre a à la fois Parti et En arrivée, on prend En arrivée (= à blanc)
    if (entries.arriving) {
      // Si doublon (départ + arrivée), c'est un turnover = à blanc
      if (entries.departing) {
        entries.arriving.statusIndicator = 'Départ + Arrivée';
        entries.arriving.detectedCleaningType = 'full';
        entries.arriving.hasDepartingGuest = true;
      }
      finalRows.push(entries.arriving);
    } else if (entries.staying) {
      finalRows.push(entries.staying);
    } else if (entries.departing) {
      finalRows.push(entries.departing);
    }
  }
  
  // Trier par numéro de chambre
  finalRows.sort((a, b) => {
    const numA = parseInt(a.roomNumber.replace(/\D/g, ''));
    const numB = parseInt(b.roomNumber.replace(/\D/g, ''));
    return numA - numB;
  });
  
  return {
    headers: ['N° Chambre', 'Type', 'Statut', 'Client', 'Arrivée', 'Départ', 'Type nettoyage'],
    rows: finalRows,
    summary: calculateSummary(finalRows),
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
 * Détecte la ligne d'en-tête d'un tableau et retourne l'index de la colonne "chambre"
 */
function detectTableHeader(lines: string[]): { headerLineIndex: number; roomColumnIndex: number; delimiter: string } | null {
  const HEADER_KEYWORDS = ['chambre', 'room', 'zimmer', 'nb pers', 'statut', 'etat', 'état', 'date', 'client', 'type', 'assignee', 'arrivée', 'départ', 'recouche', 'blanc'];
  const ROOM_COLUMN_KEYWORDS = ['chambre', 'room', 'zimmer', 'ch.', 'n°'];

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim().toLowerCase();
    if (!line) continue;

    // Count how many header keywords appear in this line
    const matchCount = HEADER_KEYWORDS.filter(kw => line.includes(kw)).length;
    if (matchCount < 2) continue;

    // Try tab delimiter first, then multiple spaces
    let delimiter = '\t';
    let columns = lines[i].split('\t').map(c => c.trim());
    if (columns.length < 3) {
      delimiter = '  '; // 2+ spaces
      columns = lines[i].split(/\s{2,}/).map(c => c.trim());
    }
    if (columns.length < 3) continue;

    // Find the room column index
    const roomColIdx = columns.findIndex(col => 
      ROOM_COLUMN_KEYWORDS.some(kw => col.toLowerCase().includes(kw))
    );

    if (roomColIdx !== -1) {
      console.log(`📋 En-tête tableau détecté ligne ${i}: "${lines[i].trim().substring(0, 80)}" — colonne chambre: ${roomColIdx}`);
      return { headerLineIndex: i, roomColumnIndex: roomColIdx, delimiter };
    }
  }

  return null;
}

/**
 * Filtre de cohérence d'étage: si >70% des chambres ont 3+ chiffres,
 * rejeter les nombres à 2 chiffres sans statut explicite
 */
function applyFloorCoherenceFilter(rows: ParsedRow[]): ParsedRow[] {
  if (rows.length < 3) return rows;

  const threeDigitCount = rows.filter(r => r.roomNumber.replace(/\D/g, '').length >= 3).length;
  const ratio = threeDigitCount / rows.length;

  if (ratio < 0.7) return rows; // Not enough 3-digit rooms to apply filter

  const EXPLICIT_STATUSES = /\b(libre|recouche|depart|départ|parti|checkout|stayover|occupé|occ|blanc|arrivée|arrival|clean|propre|sale|dirty|ooo|hors.service|maintenance)\b/i;

  const filtered = rows.filter(r => {
    const digits = r.roomNumber.replace(/\D/g, '');
    if (digits.length >= 3) return true; // Keep 3+ digit rooms always

    // 2-digit room: only keep if it has an explicit status
    const hasExplicitStatus = EXPLICIT_STATUSES.test(r.rawLine);
    if (!hasExplicitStatus) {
      console.log(`🧹 Cohérence étage: rejet "${r.roomNumber}" (2 chiffres sans statut explicite)`);
    }
    return hasExplicitStatus;
  });

  if (filtered.length < rows.length) {
    console.log(`🧹 Cohérence étage: ${rows.length - filtered.length} faux positifs rejetés (${threeDigitCount}/${rows.length} = ${Math.round(ratio * 100)}% à 3+ chiffres)`);
  }

  return filtered;
}

/**
 * Parser générique - renforcé avec détection d'en-tête, filtrage contextuel et cohérence d'étage
 */
function parseGenericReport(text: string): ParsedReportData {
  const lines = text.split('\n');
  let rows: ParsedRow[] = [];
  
  // === PHASE 1: Détecter l'en-tête du tableau ===
  const headerInfo = detectTableHeader(lines);
  
  // Pattern pour détecter les dates (pour filtrer les faux positifs)
  const DATE_PART_PATTERN = /\d{2}[\/\.\-]\d{2}[\/\.\-]\d{2,4}/;
  
  // Context keywords that indicate a line is about a room
  const ROOM_CONTEXT_KEYWORDS = /\b(départ|depart|parti|checkout|libéré|recouche|stayover|occupé|occ|ooo|out\s*of\s*order|hors\s*service|maintenance|libre|vacant|propre|clean|sale|dirty|arrivée|arrival|checkin|chambre|room|dbl|sgl|tpl|twn|suite|fam|dup|blanc|draps)\b/i;
  
  // Date pattern as context indicator
  const DATE_CONTEXT = /\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4}/;

  const startLine = headerInfo ? headerInfo.headerLineIndex + 1 : 0;
  
  for (let i = startLine; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.length < 3) continue;
    if (isHeaderLine(trimmed)) continue;
    
    let roomNumber = '';
    
    if (headerInfo) {
      // === MODE EN-TÊTE DÉTECTÉ: extraire uniquement depuis la colonne identifiée ===
      const columns = headerInfo.delimiter === '\t' 
        ? trimmed.split('\t').map(c => c.trim())
        : trimmed.split(/\s{2,}/).map(c => c.trim());
      
      if (columns.length <= headerInfo.roomColumnIndex) continue;
      
      const candidate = columns[headerInfo.roomColumnIndex].replace(/\s/g, '');
      // Must be a 2-4 digit number (optionally with letter suffix)
      if (/^\d{2,4}[A-Z]?$/.test(candidate)) {
        roomNumber = candidate;
      } else {
        continue;
      }
    } else {
      // === MODE SANS EN-TÊTE: regex sur la ligne ===
      const roomPattern = /(?:^|\t)(\d{2,4}[A-Z]?)\b/;
      const roomMatch = trimmed.match(roomPattern);
      if (!roomMatch) continue;
      
      roomNumber = roomMatch[1];
      
      // FILTRE DATE: rejeter si le nombre fait partie d'une date (ex: "16/02/2026")
      // Check if the matched number is immediately followed by a date separator
      const matchIdx = trimmed.indexOf(roomMatch[0]);
      const afterMatch = trimmed.substring(matchIdx + roomMatch[0].length);
      if (/^[\/\.\-]\d{2}[\/\.\-]\d{2,4}/.test(afterMatch)) {
        continue; // This is a day in a date, not a room number
      }
      
      // Also check: if the number is preceded by a date separator
      const beforeMatch = trimmed.substring(0, matchIdx + (roomMatch[0].startsWith('\t') ? 1 : 0));
      if (/\d{2}[\/\.\-]$/.test(beforeMatch)) {
        continue; // This is part of a date
      }
      
      // Context validation (only in headerless mode)
      const textAfterNumber = trimmed.substring(matchIdx + roomMatch[0].length).trim();
      const hasContextKeyword = ROOM_CONTEXT_KEYWORDS.test(trimmed);
      const hasDateContext = DATE_CONTEXT.test(trimmed);
      const hasMultipleColumns = textAfterNumber.length >= 5;
      
      if (!hasContextKeyword && !hasDateContext && !hasMultipleColumns) {
        continue;
      }
      
      if (trimmed.length < 10 && !hasContextKeyword) {
        continue;
      }
    }
    
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
      detectedType = 'full'; // "Libre" = chambre vide = à blanc
      statusIndicator = 'Libre';
    } else if (/\b(blanc|à\s*blanc)\b/i.test(trimmed)) {
      detectedType = 'full';
      statusIndicator = 'À blanc';
    }
    
    rows.push({
      rawLine: lines[i],
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
  
  // === PHASE 2: Dédoublonner par numéro de chambre (garder la meilleure confiance) ===
  const roomMap = new Map<string, ParsedRow>();
  for (const row of rows) {
    const existing = roomMap.get(row.roomNumber);
    if (!existing || row.confidence > existing.confidence) {
      roomMap.set(row.roomNumber, row);
    }
  }
  rows = Array.from(roomMap.values());
  
  // === PHASE 3: Appliquer le filtre de cohérence d'étage ===
  rows = applyFloorCoherenceFilter(rows);
  
  // Trier par numéro de chambre
  rows.sort((a, b) => {
    const numA = parseInt(a.roomNumber.replace(/\D/g, ''));
    const numB = parseInt(b.roomNumber.replace(/\D/g, ''));
    return numA - numB;
  });
  
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
    /^[-=_|]{5,}$/,
    /literie\s+\d+\s*×/i,
    /\d+\s*×\s*lit/i,
    /^#\s+ETAT\s+MEMO/i,
    /^Ch\.\s+Type\s+Arrivée/i,
    /^Floor\s+Spaces/i,
    /^Étage\s+Espaces/i,
    /Space\s+status\s+-/i,
    /Statut\s+des\s+espaces\s+-/i,
    // Generic: isolated page numbers
    /^\d{1,2}\s*$/,
    /^Page\s+\d+/i,
    /^\d+\s*\/\s*\d+\s*$/,
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
