/**
 * Types unifiés pour le système PMS
 * Supporte les deux formats: ancien (full/quick) et nouveau (a_blanc/recouche)
 */

// Type de nettoyage unifié - supporte les deux formats pour la compatibilité
export type CleaningType = 'full' | 'quick' | 'none' | 'a_blanc' | 'recouche';

// Type normalisé (nouveau format)
export type NormalizedCleaningType = 'a_blanc' | 'recouche' | 'none';

// Mapping pour compatibilité
const CLEANING_TYPE_COMPAT: Record<string, NormalizedCleaningType> = {
  'full': 'a_blanc',
  'quick': 'recouche',
  'none': 'none',
  'a_blanc': 'a_blanc',
  'recouche': 'recouche',
};

/**
 * Normalise un type de nettoyage vers le nouveau format
 */
export function normalizeCleaningType(type: string | undefined | null): NormalizedCleaningType {
  if (!type) return 'a_blanc';
  const normalized = CLEANING_TYPE_COMPAT[type.toLowerCase()];
  return normalized || 'a_blanc';
}

/**
 * Vérifie si c'est un nettoyage complet (à blanc)
 */
export function isFullCleaning(type: string | undefined | null): boolean {
  return normalizeCleaningType(type) === 'a_blanc';
}

/**
 * Vérifie si c'est une recouche
 */
export function isQuickCleaning(type: string | undefined | null): boolean {
  return normalizeCleaningType(type) === 'recouche';
}

/**
 * Labels français pour les types de nettoyage
 */
export const CLEANING_TYPE_LABELS: Record<string, string> = {
  'a_blanc': 'À Blanc',
  'recouche': 'Recouche',
  'none': 'Aucun',
  'full': 'À Blanc',
  'quick': 'Recouche',
};

/**
 * Labels courts pour les types de nettoyage
 */
export const CLEANING_TYPE_SHORT_LABELS: Record<string, string> = {
  'a_blanc': 'Blanc',
  'recouche': 'Rec.',
  'none': '-',
  'full': 'Blanc',
  'quick': 'Rec.',
};

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
        return { cleaningType: 'a_blanc', status: 'checkout', reason: `Dernière nuit (${currentNight}/${totalNights})` };
      } else if (currentNight === 1 && totalNights === 1) {
        // Une seule nuit = départ
        return { cleaningType: 'a_blanc', status: 'checkout', reason: 'Séjour 1 nuit - départ' };
      } else if (currentNight > 1) {
        // Client en séjour
        return { cleaningType: 'recouche', status: 'stayover', reason: `En séjour (nuit ${currentNight}/${totalNights})` };
      }
    }
  }
  
  // Analyse avec les dates
  if (departure) {
    const depStr = departure.toISOString().split('T')[0];
    if (depStr === todayStr) {
      return { cleaningType: 'a_blanc', status: 'checkout', reason: 'Départ aujourd\'hui' };
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
          return { cleaningType: 'a_blanc', status: 'checkout_arrival', reason: 'Arrivée et départ même jour' };
        }
      }
      return { cleaningType: 'a_blanc', status: 'arrival', reason: 'Arrivée aujourd\'hui' };
    } else if (arrival < today && (!departure || departure > today)) {
      // Client en cours de séjour
      return { cleaningType: 'recouche', status: 'stayover', reason: 'Client en séjour' };
    }
  }
  
  // Pas assez d'info
  return { cleaningType: 'a_blanc', status: 'unknown', reason: 'Informations insuffisantes' };
}

export interface ExtractionDebugInfo {
  rawLine: string;
  cleanedLine: string;
  detectedKeywords: string[];
  appliedRule?: string;
  source: 'regex' | 'pattern' | 'ai' | 'fallback' | 'structured-parser';
  confidence: number;
}

export interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: CleaningType;
  // Dates
  arrivalDate?: string;
  departureDate?: string;
  // Heures (HH:MM)
  arrivalTime?: string;
  departureTime?: string;
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

// ========== TYPES POUR LES RÈGLES DE NETTOYAGE ==========

/**
 * Types de conditions disponibles pour les règles
 */
export type RuleConditionType = 
  | 'status'           // Statut de la chambre (départ, arrivée, etc.)
  | 'night_info'       // Info nuit (dernière nuit, première nuit, etc.)
  | 'room_pattern'     // Pattern sur le numéro de chambre
  | 'floor'            // Étage
  | 'rate_code'        // Code tarif (BB, HB, etc.)
  | 'room_type'        // Type de chambre
  | 'keyword'          // Mot-clé présent dans le texte
  | 'date';            // Conditions sur les dates

/**
 * Opérateurs pour les conditions
 */
export type RuleOperator = 
  | 'equals'           // Égal à
  | 'not_equals'       // Différent de
  | 'contains'         // Contient
  | 'not_contains'     // Ne contient pas
  | 'starts_with'      // Commence par
  | 'ends_with'        // Finit par
  | 'range'            // Dans une plage (pour les numéros)
  | 'last_night'       // Dernière nuit du séjour
  | 'first_night'      // Première nuit du séjour
  | 'is_today'         // Date est aujourd'hui
  | 'greater_than'     // Supérieur à
  | 'less_than';       // Inférieur à

/**
 * Condition d'une règle de nettoyage
 */
export interface CleaningRuleCondition {
  type: RuleConditionType;
  operator: RuleOperator;
  value: string | number | { min: number; max: number };
  // Label lisible pour l'utilisateur (généré automatiquement si non fourni)
  label?: string;
}

/**
 * Règle de nettoyage complète
 */
export interface CleaningRule {
  id: string;
  hotelId: string;
  name: string;
  description?: string;
  conditions: CleaningRuleCondition[];
  conditionLogic: 'AND' | 'OR'; // Comment combiner les conditions
  resultCleaningType: CleaningType;
  resultStatus?: string;
  priority: number; // Plus élevé = plus prioritaire
  isActive: boolean;
  isSystem: boolean; // Règle système non supprimable
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Labels français pour les statuts de chambre
 */
export const STATUS_LABELS: Record<string, string> = {
  'checkout': 'Départ',
  'departure': 'Départ',
  'checkout_arrival': 'Départ + Arrivée',
  'arrival': 'Arrivée',
  'stayover': 'Client en séjour',
  'occupied': 'Occupée',
  'dirty': 'Sale',
  'clean': 'Propre',
  'vacant': 'Libre',
  'out-of-order': 'Hors service',
  'maintenance': 'Maintenance',
  'unknown': 'Inconnu',
};

/**
 * Labels français pour les conditions
 */
export const CONDITION_TYPE_LABELS: Record<RuleConditionType, string> = {
  'status': 'Statut',
  'night_info': 'Info nuit',
  'room_pattern': 'N° chambre',
  'floor': 'Étage',
  'rate_code': 'Code tarif',
  'room_type': 'Type de chambre',
  'keyword': 'Mot-clé',
  'date': 'Date',
};

/**
 * Labels français pour les opérateurs
 */
export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  'equals': 'est égal à',
  'not_equals': 'est différent de',
  'contains': 'contient',
  'not_contains': 'ne contient pas',
  'starts_with': 'commence par',
  'ends_with': 'finit par',
  'range': 'entre',
  'last_night': 'dernière nuit',
  'first_night': 'première nuit',
  'is_today': 'est aujourd\'hui',
  'greater_than': 'supérieur à',
  'less_than': 'inférieur à',
};

/**
 * Options de statut prédéfinies (pour les selects)
 */
export const STATUS_OPTIONS = [
  { value: 'checkout', label: 'Départ' },
  { value: 'arrival', label: 'Arrivée' },
  { value: 'checkout_arrival', label: 'Départ + Arrivée' },
  { value: 'stayover', label: 'Client en séjour' },
  { value: 'dirty', label: 'Sale' },
  { value: 'clean', label: 'Propre' },
  { value: 'vacant', label: 'Libre' },
  { value: 'out-of-order', label: 'Hors service' },
];

/**
 * Templates de patterns pour les numéros de chambre
 */
export const ROOM_PATTERN_TEMPLATES = [
  { label: 'Commence par...', value: 'starts_with', example: 'A ou 1' },
  { label: 'Plage de numéros', value: 'range', example: '100 à 199' },
  { label: 'Étage spécifique', value: 'floor', example: 'Étage 3' },
  { label: 'Contient...', value: 'contains', example: 'VIP ou Suite' },
];

/**
 * Règles système par défaut
 */
export const DEFAULT_SYSTEM_RULES: Omit<CleaningRule, 'id' | 'hotelId'>[] = [
  {
    name: 'Départ → À Blanc',
    description: 'Les chambres en départ doivent être nettoyées à blanc',
    conditions: [{ type: 'status', operator: 'equals', value: 'checkout' }],
    conditionLogic: 'AND',
    resultCleaningType: 'a_blanc',
    resultStatus: 'checkout',
    priority: 100,
    isActive: true,
    isSystem: true,
  },
  {
    name: 'Client en séjour → Recouche',
    description: 'Les chambres occupées reçoivent un nettoyage recouche',
    conditions: [{ type: 'status', operator: 'equals', value: 'stayover' }],
    conditionLogic: 'AND',
    resultCleaningType: 'recouche',
    resultStatus: 'stayover',
    priority: 90,
    isActive: true,
    isSystem: true,
  },
  {
    name: 'Arrivée → À Blanc',
    description: 'Les chambres en arrivée doivent être préparées à blanc',
    conditions: [{ type: 'status', operator: 'equals', value: 'arrival' }],
    conditionLogic: 'AND',
    resultCleaningType: 'a_blanc',
    resultStatus: 'arrival',
    priority: 95,
    isActive: true,
    isSystem: true,
  },
  {
    name: 'Dernière nuit → À Blanc',
    description: 'Si c\'est la dernière nuit du séjour, préparer pour le départ',
    conditions: [{ type: 'night_info', operator: 'last_night', value: '' }],
    conditionLogic: 'AND',
    resultCleaningType: 'a_blanc',
    resultStatus: 'checkout',
    priority: 85,
    isActive: true,
    isSystem: true,
  },
  {
    name: 'Sale → À Blanc',
    description: 'Les chambres sales sont nettoyées à blanc',
    conditions: [{ type: 'status', operator: 'equals', value: 'dirty' }],
    conditionLogic: 'AND',
    resultCleaningType: 'a_blanc',
    resultStatus: 'dirty',
    priority: 80,
    isActive: true,
    isSystem: true,
  },
  {
    name: 'Propre → Aucun',
    description: 'Les chambres propres n\'ont pas besoin de nettoyage',
    conditions: [{ type: 'status', operator: 'equals', value: 'clean' }],
    conditionLogic: 'AND',
    resultCleaningType: 'none',
    resultStatus: 'clean',
    priority: 70,
    isActive: true,
    isSystem: true,
  },
];
