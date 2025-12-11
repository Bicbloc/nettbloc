/**
 * Types unifiés pour le système PMS
 */

export type CleaningType = 'full' | 'quick' | 'none';

// Regex universelle pour les numéros de chambre
export const UNIVERSAL_ROOM_REGEX = /(?<![\/\-\.\d:])(?:\b(?:Room|Ch\.?|Chambre|R|#)\s*)?([A-Z]?-?0*[1-9]\d{0,3}[A-Z]?)\b(?![\/\-\.\d:])/gi;

// Normalise un numéro de chambre
export function normalizeRoomNumber(roomNumber: string): string {
  // Supprime les zéros initiaux et normalise
  return roomNumber.replace(/^0+/, '') || roomNumber;
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
  arrivalDate?: string;
  departureDate?: string;
  guestName?: string;
  confidence?: number;
  isConnected?: boolean;
  linkedRooms?: string[];
  originalText?: string;
  validated?: boolean;
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
