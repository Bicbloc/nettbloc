/**
 * Types unifiés pour le système PMS
 */

export type CleaningType = 'full' | 'quick' | 'none';

// Regex universelle pour les numéros de chambre
export const UNIVERSAL_ROOM_REGEX = /(?<![\/\-\.\d:])(?:\b(?:Room|Ch\.?|Chambre|R|#)\s*)?([A-Z]?-?0*[1-9]\d{0,3}[A-Z]?)\b(?![\/\-\.\d:])/gi;

// Regex pour les dates (formats courants)
export const DATE_PATTERNS = {
  // Format DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  DMY: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,
  // Format YYYY-MM-DD
  YMD: /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g,
  // Format MM/DD/YYYY (US)
  MDY: /\b(\d{1,2})[\/](\d{1,2})[\/](\d{4})\b/g,
};

// Regex pour les nuits (Nuit X/Y, Night X of Y, etc.)
export const NIGHT_PATTERNS = {
  FR: /(?:Nuit|N)\s*(\d+)\s*[\/\\]\s*(\d+)/gi,
  EN: /(?:Night|Nt)\s*(\d+)\s*(?:of|\/)\s*(\d+)/gi,
  SIMPLE: /(\d+)\s*(?:nuit|night)s?/gi,
};

// Normalise un numéro de chambre
export function normalizeRoomNumber(roomNumber: string): string {
  // Supprime les zéros initiaux et normalise
  return roomNumber.replace(/^0+/, '') || roomNumber;
}

// Parse une date depuis différents formats
export function parseDate(dateStr: string): Date | null {
  // Format DD/MM/YYYY ou DD-MM-YYYY
  let match = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (match) {
    const [, day, month, year] = match;
    const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }
  
  // Format YYYY-MM-DD
  match = dateStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return null;
}

// Calcule le type de nettoyage depuis les dates/nuits
export function inferCleaningFromDates(
  arrivalDate: string | null,
  departureDate: string | null,
  nightInfo: string | null,
  today: Date = new Date()
): { cleaningType: CleaningType; status: string; reason: string } {
  const todayStr = today.toISOString().split('T')[0];
  
  // Parse les dates
  const arrival = arrivalDate ? parseDate(arrivalDate) : null;
  const departure = departureDate ? parseDate(departureDate) : null;
  
  // Nuit X/Y
  if (nightInfo) {
    const nightMatch = nightInfo.match(/(\d+)\s*[\/\\]\s*(\d+)/);
    if (nightMatch) {
      const currentNight = parseInt(nightMatch[1]);
      const totalNights = parseInt(nightMatch[2]);
      
      if (currentNight === totalNights) {
        // Dernière nuit = départ aujourd'hui
        return { cleaningType: 'full', status: 'checkout', reason: `Dernière nuit (${currentNight}/${totalNights})` };
      } else if (currentNight === 1 && totalNights === 1) {
        // Une seule nuit = départ
        return { cleaningType: 'full', status: 'checkout', reason: 'Séjour 1 nuit - départ' };
      } else if (currentNight > 1) {
        // Client en séjour
        return { cleaningType: 'quick', status: 'stayover', reason: `En séjour (nuit ${currentNight}/${totalNights})` };
      }
    }
  }
  
  // Analyse avec les dates
  if (departure) {
    const depStr = departure.toISOString().split('T')[0];
    if (depStr === todayStr) {
      return { cleaningType: 'full', status: 'checkout', reason: 'Départ aujourd\'hui' };
    }
  }
  
  if (arrival) {
    const arrStr = arrival.toISOString().split('T')[0];
    if (arrStr === todayStr) {
      // Arrivée aujourd'hui
      if (departure) {
        const depStr = departure.toISOString().split('T')[0];
        if (depStr === todayStr) {
          // Arrivée ET départ le même jour (rare mais possible)
          return { cleaningType: 'full', status: 'checkout_arrival', reason: 'Arrivée et départ même jour' };
        }
      }
      return { cleaningType: 'full', status: 'arrival', reason: 'Arrivée aujourd\'hui' };
    } else if (arrival < today && (!departure || departure > today)) {
      // Client en cours de séjour
      return { cleaningType: 'quick', status: 'stayover', reason: 'Client en séjour' };
    }
  }
  
  // Pas assez d'info
  return { cleaningType: 'full', status: 'unknown', reason: 'Informations insuffisantes' };
}

export interface ExtractionDebugInfo {
  rawLine: string;
  cleanedLine: string;
  detectedKeywords: string[];
  appliedRule?: string;
  source: 'regex' | 'pattern' | 'ai' | 'fallback';
  confidence: number;
}

export interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: CleaningType;
  // Dates
  arrivalDate?: string;
  departureDate?: string;
  // Nuits
  nightInfo?: string;        // "2/3" ou "Night 2 of 3"
  currentNight?: number;     // Nuit actuelle
  totalNights?: number;      // Nombre total de nuits
  // Client
  guestName?: string;
  guestCount?: number;
  // Chambre
  roomType?: string;         // twin, double, suite, etc.
  rateCode?: string;         // BB, HB, RO, etc.
  // Métadonnées
  comment?: string;          // Commentaire de réservation
  rawStatuses?: string[];    // Tous les statuts bruts détectés
  confidence?: number;
  isConnected?: boolean;
  linkedRooms?: string[];
  originalText?: string;
  validated?: boolean;
  inferenceReason?: string;  // Raison de l'inférence du nettoyage
  debugInfo?: ExtractionDebugInfo;
}

export interface StatusMapping {
  status: string;
  cleaning: CleaningType;
  priority?: number;
}

export interface CombinationRule {
  conditions: string[];
  result: { status: string; cleaning: CleaningType };
}

export interface PmsConfig {
  pmsType: string;
  keywords: string[];
  criticalKeywords?: string[]; // Mots-clés critiques (50+ points)
  roomNumberRegex: string;
  statusMappings: Record<string, StatusMapping>;
  combinationRules: CombinationRule[];
  dateFormats: string[];
}

export interface PmsDetectionResult {
  pmsType: string;
  confidence: number;
  matchedKeywords: string[];
  criticalKeywordsMatched?: string[];
  score?: number;
}

export interface PmsCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  propertyId?: string;
  baseUrl?: string;
}

export interface PmsApiRoom {
  roomNumber: string;
  status: string;
  cleaningType: CleaningType;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
}

// Facteurs de confiance pour le calcul du score
export interface ConfidenceFactors {
  pmsDetection: number;      // 0-40 points
  statusKeywordFound: number; // 0-20 points
  patternMatch: number;       // 0-25 points
  roomCountPlausible: number; // 0-15 points
}

// Contexte d'extraction pour debug
export interface RoomExtractionContext {
  rawLine: string;
  roomNumber: string;
  detectedStatuses: string[];
  confidence: number;
  source: 'adapter' | 'pattern' | 'ai' | 'fallback';
  debugInfo: ExtractionDebugInfo;
}

// Résultat du parsing avec métadonnées
export interface ParseResultWithMeta {
  rooms: ExtractedRoom[];
  pmsType: string;
  confidence: number;
  usedAi: boolean;
  usedLearnedPatterns: boolean;
  debugLogs?: string[];
  processingTime?: number;
}
