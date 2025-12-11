/**
 * Extracteur de champs communs des rapports PMS
 * Extrait: dates, nuits, client, commentaires de manière standardisée
 */

import { CleaningType, parseDate, inferCleaningFromDates } from './types';

export interface ExtractedFields {
  roomNumber: string;
  arrivalDate: string | null;
  departureDate: string | null;
  nightInfo: string | null;  // "2/3" ou "Night 2 of 3"
  currentNight: number | null;
  totalNights: number | null;
  guestName: string | null;
  guestCount: number | null;
  comment: string | null;
  rateCode: string | null;  // BB, HB, RO, etc.
  roomType: string | null;  // twin, double, suite, etc.
  rawStatuses: string[];    // Tous les statuts trouvés sur la ligne
}

export interface FieldExtractionResult {
  fields: ExtractedFields;
  inferredCleaning: CleaningType;
  inferredStatus: string;
  reason: string;
  confidence: number;
}

// Patterns pour l'extraction
const PATTERNS = {
  // Dates - formats courants
  DATE_DMY: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,
  DATE_YMD: /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g,
  
  // Nuits
  NIGHT_FR: /(?:Nuit|N)\s*(\d+)\s*[\/\\]\s*(\d+)/i,
  NIGHT_EN: /(?:Night|Nt)\s*(\d+)\s*(?:of|\/)\s*(\d+)/i,
  NIGHT_COUNT: /(\d+)\s*(?:nuit|night)s?\b/i,
  
  // Nombre de personnes
  ADULTS: /(\d+)\s*(?:adult|adulte)s?/i,
  PAX: /(\d+)\s*(?:pax|pers|personne)/i,
  
  // Code tarif
  RATE_CODE: /\b(RO|BB|HB|FB|AI|FLEX|NR|BAR|RACK)\b/i,
  
  // Type de chambre
  ROOM_TYPE: /\b(twin|double|single|triple|quadruple|suite|studio|deluxe|superior|standard|chambre\s+\w+)\b/i,
  
  // Noms (pattern simple - Prénom Nom ou NOM Prénom)
  NAME_PATTERN: /\b([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç]+)\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]{2,})\b/,
  NAME_PATTERN_ALT: /\b([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]{2,})\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç]+)\b/,
  
  // Statuts à détecter
  STATUS_KEYWORDS: [
    'PARTI', 'DEPART', 'CHECKOUT', 'CHECK-OUT', 'DEP', 'CO', 'DUE OUT',
    'ARRIVÉE', 'ARRIVEE', 'ARRIVAL', 'CHECK-IN', 'ARR', 'CI', 'DUE IN', 'EN ARRIVÉE',
    'RECOUCHE', 'STAYOVER', 'STAY', 'OCCUPIED',
    'SALE', 'DIRTY', 'DIR', 'SAL', 'VD', 'OD',
    'PROPRE', 'CLEAN', 'INS', 'VC', 'OC',
    'A CONTROLER', 'A CONTRÔLER', 'TO INSPECT',
    'HS', 'OOO', 'OUT OF ORDER', 'MAINTENANCE',
    'LIBRE', 'VACANT', 'FREE'
  ],
  
  // Mots à ignorer comme noms (staff, headers, etc.)
  IGNORE_NAMES: [
    'staff', 'superviseur', 'manager', 'admin', 'maintenance', 'housekeeping',
    'reception', 'chambre', 'room', 'type', 'statut', 'status', 'date',
    'arrival', 'departure', 'guest', 'client', 'name', 'nom', 'arrivée', 'départ'
  ]
};

class FieldExtractor {
  /**
   * Extrait tous les champs d'une ligne de rapport
   */
  extractFromLine(line: string, roomNumber: string): FieldExtractionResult {
    const fields: ExtractedFields = {
      roomNumber,
      arrivalDate: null,
      departureDate: null,
      nightInfo: null,
      currentNight: null,
      totalNights: null,
      guestName: null,
      guestCount: null,
      comment: null,
      rateCode: null,
      roomType: null,
      rawStatuses: []
    };
    
    // Extraire les dates
    const dates = this.extractDates(line);
    if (dates.length >= 2) {
      // Supposer que la première date est l'arrivée, la seconde le départ
      fields.arrivalDate = dates[0];
      fields.departureDate = dates[1];
    } else if (dates.length === 1) {
      // Une seule date - contexte nécessaire pour déterminer
      fields.arrivalDate = dates[0];
    }
    
    // Extraire les nuits
    const nightInfo = this.extractNightInfo(line);
    if (nightInfo) {
      fields.nightInfo = nightInfo.raw;
      fields.currentNight = nightInfo.current;
      fields.totalNights = nightInfo.total;
    }
    
    // Extraire le nombre de personnes
    fields.guestCount = this.extractGuestCount(line);
    
    // Extraire le nom du client
    fields.guestName = this.extractGuestName(line);
    
    // Extraire le code tarif
    fields.rateCode = this.extractRateCode(line);
    
    // Extraire le type de chambre
    fields.roomType = this.extractRoomType(line);
    
    // Extraire les statuts bruts
    fields.rawStatuses = this.extractStatuses(line);
    
    // Inférer le type de nettoyage depuis les données
    const inference = inferCleaningFromDates(
      fields.arrivalDate,
      fields.departureDate,
      fields.nightInfo
    );
    
    // Ajuster avec les statuts détectés
    const statusBasedInference = this.inferFromStatuses(fields.rawStatuses);
    
    // Combiner les deux inférences (statuts ont priorité si présents)
    let finalCleaning = inference.cleaningType;
    let finalStatus = inference.status;
    let finalReason = inference.reason;
    
    if (statusBasedInference.confidence > 70 && fields.rawStatuses.length > 0) {
      finalCleaning = statusBasedInference.cleaningType;
      finalStatus = statusBasedInference.status;
      finalReason = `Statut: ${fields.rawStatuses.join(' + ')}`;
    } else if (inference.status === 'unknown' && statusBasedInference.status !== 'unknown') {
      finalCleaning = statusBasedInference.cleaningType;
      finalStatus = statusBasedInference.status;
      finalReason = statusBasedInference.reason;
    }
    
    // Calculer la confiance
    let confidence = 50;
    if (fields.arrivalDate || fields.departureDate) confidence += 15;
    if (fields.nightInfo) confidence += 20;
    if (fields.rawStatuses.length > 0) confidence += 15;
    if (fields.guestName) confidence += 5;
    confidence = Math.min(confidence, 95);
    
    return {
      fields,
      inferredCleaning: finalCleaning,
      inferredStatus: finalStatus,
      reason: finalReason,
      confidence
    };
  }
  
  /**
   * Extrait les dates d'une ligne
   */
  private extractDates(line: string): string[] {
    const dates: string[] = [];
    
    // Format DD/MM/YYYY
    const dmyMatches = line.matchAll(PATTERNS.DATE_DMY);
    for (const match of dmyMatches) {
      dates.push(match[0]);
    }
    
    // Format YYYY-MM-DD
    const ymdMatches = line.matchAll(PATTERNS.DATE_YMD);
    for (const match of ymdMatches) {
      dates.push(match[0]);
    }
    
    // Dédupliquer et retourner max 2 dates
    return [...new Set(dates)].slice(0, 2);
  }
  
  /**
   * Extrait les informations de nuit
   */
  private extractNightInfo(line: string): { raw: string; current: number; total: number } | null {
    // Pattern français: Nuit 2/3
    let match = line.match(PATTERNS.NIGHT_FR);
    if (match) {
      return { raw: match[0], current: parseInt(match[1]), total: parseInt(match[2]) };
    }
    
    // Pattern anglais: Night 2 of 3
    match = line.match(PATTERNS.NIGHT_EN);
    if (match) {
      return { raw: match[0], current: parseInt(match[1]), total: parseInt(match[2]) };
    }
    
    // Pattern simple: 3 nuits
    match = line.match(PATTERNS.NIGHT_COUNT);
    if (match) {
      return { raw: match[0], current: 1, total: parseInt(match[1]) };
    }
    
    return null;
  }
  
  /**
   * Extrait le nombre de personnes
   */
  private extractGuestCount(line: string): number | null {
    let match = line.match(PATTERNS.ADULTS);
    if (match) return parseInt(match[1]);
    
    match = line.match(PATTERNS.PAX);
    if (match) return parseInt(match[1]);
    
    return null;
  }
  
  /**
   * Extrait le nom du client
   */
  private extractGuestName(line: string): string | null {
    // Essayer le pattern Prénom NOM
    let match = line.match(PATTERNS.NAME_PATTERN);
    if (match) {
      const name = `${match[1]} ${match[2]}`;
      if (!this.isIgnoredName(name)) return name;
    }
    
    // Essayer le pattern NOM Prénom
    match = line.match(PATTERNS.NAME_PATTERN_ALT);
    if (match) {
      const name = `${match[1]} ${match[2]}`;
      if (!this.isIgnoredName(name)) return name;
    }
    
    return null;
  }
  
  /**
   * Vérifie si un nom doit être ignoré (staff, headers, etc.)
   */
  private isIgnoredName(name: string): boolean {
    const lower = name.toLowerCase();
    return PATTERNS.IGNORE_NAMES.some(ignore => lower.includes(ignore));
  }
  
  /**
   * Extrait le code tarif
   */
  private extractRateCode(line: string): string | null {
    const match = line.match(PATTERNS.RATE_CODE);
    return match ? match[1].toUpperCase() : null;
  }
  
  /**
   * Extrait le type de chambre
   */
  private extractRoomType(line: string): string | null {
    const match = line.match(PATTERNS.ROOM_TYPE);
    return match ? match[1].toLowerCase() : null;
  }
  
  /**
   * Extrait les statuts bruts présents dans la ligne
   */
  private extractStatuses(line: string): string[] {
    const upper = line.toUpperCase();
    const found: string[] = [];
    
    for (const keyword of PATTERNS.STATUS_KEYWORDS) {
      if (upper.includes(keyword.toUpperCase())) {
        found.push(keyword);
      }
    }
    
    return found;
  }
  
  /**
   * Infère le nettoyage depuis les statuts détectés
   */
  private inferFromStatuses(statuses: string[]): { cleaningType: CleaningType; status: string; reason: string; confidence: number } {
    const upper = statuses.map(s => s.toUpperCase());
    
    // Checkout + Arrival = à blanc (full clean)
    const hasCheckout = upper.some(s => ['PARTI', 'DEPART', 'CHECKOUT', 'CHECK-OUT', 'DEP', 'CO', 'DUE OUT'].includes(s));
    const hasArrival = upper.some(s => ['ARRIVÉE', 'ARRIVEE', 'ARRIVAL', 'CHECK-IN', 'ARR', 'CI', 'DUE IN', 'EN ARRIVÉE'].includes(s));
    
    if (hasCheckout && hasArrival) {
      return { cleaningType: 'a_blanc', status: 'checkout_arrival', reason: 'Départ + Arrivée', confidence: 90 };
    }
    
    if (hasCheckout) {
      return { cleaningType: 'a_blanc', status: 'checkout', reason: 'Départ', confidence: 85 };
    }
    
    if (hasArrival) {
      // Arrivée seule - vérifier si clean ou à préparer
      const hasClean = upper.some(s => ['PROPRE', 'CLEAN', 'INS', 'VC', 'A CONTROLER', 'A CONTRÔLER'].includes(s));
      if (hasClean) {
        return { cleaningType: 'none', status: 'clean', reason: 'Arrivée + Propre', confidence: 85 };
      }
      return { cleaningType: 'a_blanc', status: 'arrival', reason: 'Arrivée', confidence: 80 };
    }
    
    // Stayover/Recouche
    const hasStayover = upper.some(s => ['RECOUCHE', 'STAYOVER', 'STAY', 'OD', 'OCCUPIED DIRTY'].includes(s));
    if (hasStayover) {
      return { cleaningType: 'recouche', status: 'stayover', reason: 'Recouche', confidence: 85 };
    }
    
    // Dirty
    const hasDirty = upper.some(s => ['SALE', 'DIRTY', 'DIR', 'SAL', 'VD'].includes(s));
    if (hasDirty) {
      return { cleaningType: 'a_blanc', status: 'dirty', reason: 'Sale', confidence: 80 };
    }
    
    // Clean
    const hasClean = upper.some(s => ['PROPRE', 'CLEAN', 'INS', 'VC', 'OC'].includes(s));
    if (hasClean) {
      return { cleaningType: 'none', status: 'clean', reason: 'Propre', confidence: 80 };
    }
    
    // Out of order
    const hasOOO = upper.some(s => ['HS', 'OOO', 'OUT OF ORDER', 'MAINTENANCE'].includes(s));
    if (hasOOO) {
      return { cleaningType: 'none', status: 'out-of-order', reason: 'Hors service', confidence: 90 };
    }
    
    return { cleaningType: 'a_blanc', status: 'unknown', reason: 'Pas de statut clair', confidence: 40 };
  }
}

// Singleton
export const fieldExtractor = new FieldExtractor();
