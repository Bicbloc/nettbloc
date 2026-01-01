/**
 * Extracteur de champs communs des rapports PMS
 * Extrait: dates, nuits, client, commentaires de manière standardisée
 */

import { CleaningType, parseDate, inferCleaningFromDates } from './types';

export interface ExtractedFields {
  roomNumber: string;
  arrivalDate: string | null;
  departureDate: string | null;
  arrivalTime: string | null;    // HH:MM format
  departureTime: string | null;  // HH:MM format
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
    'PARTI', 'DEPART', 'CHECKOUT', 'CHECK-OUT', 'DEP', 'CO', 'C/O', 'DUE OUT',
    'ARRIVÉE', 'ARRIVEE', 'ARRIVAL', 'CHECK-IN', 'ARR', 'CI', 'C/I', 'DUE IN', 'EN ARRIVÉE',
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
      arrivalTime: null,
      departureTime: null,
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
    
    // Extraire les horaires (HH:MM, HHhMM, HH.MM)
    const times = this.extractTimes(line);
    if (times.arrivalTime) fields.arrivalTime = times.arrivalTime;
    if (times.departureTime) fields.departureTime = times.departureTime;
    
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
    const hasDepartureTime = /\b([01]?\d|2[0-3])(?:[:hH\.]?)([0-5]\d)\b|\b([01]?\d|2[0-3])\s*h\s*([0-5]\d)\b/i.test(line);
    fields.rawStatuses = this.extractStatuses(line);

    // Si une heure est présente (souvent une heure de départ), on privilégie C/O
    if (hasDepartureTime) {
      const checkoutSignals = new Set([
        'PARTI', 'DEPART', 'CHECKOUT', 'CHECK-OUT', 'DEP', 'CO', 'C/O', 'DUE OUT'
      ]);
      const arrivalSignals = new Set([
        'ARRIVÉE', 'ARRIVEE', 'ARRIVAL', 'CHECK-IN', 'ARR', 'CI', 'C/I', 'DUE IN', 'EN ARRIVÉE'
      ]);

      const hasCheckoutStatus = fields.rawStatuses.some(s => checkoutSignals.has(s.toUpperCase()));
      if (hasCheckoutStatus) {
        fields.rawStatuses = fields.rawStatuses
          .map(s => {
            const u = s.toUpperCase();
            if (u === 'CO') return 'C/O';
            if (u === 'CI') return 'C/I';
            return s;
          })
          .filter(s => !arrivalSignals.has(s.toUpperCase()));
      }
    }

    // Inférer le type de nettoyage depuis les données
    const inference = inferCleaningFromDates(
      fields.arrivalDate,
      fields.departureDate,
      fields.nightInfo
    );

    // Ajuster avec les statuts détectés
    const statusBasedInference = this.inferFromStatuses(fields.rawStatuses, hasDepartureTime);
    
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
   * Extrait les horaires d'une ligne (HH:MM, HHhMM, HH.MM)
   * Utilise la position pour différencier arrivée (gauche) vs départ (droite)
   */
  private extractTimes(line: string): { arrivalTime: string | null; departureTime: string | null } {
    // Patterns pour trouver les horaires (pas les dates DD/MM/YYYY)
    const timePatterns = [
      /(?<!\d\/)\b(\d{1,2}):(\d{2})\b(?!\/\d)/g,    // HH:MM
      /\b(\d{1,2})h(\d{2})\b/gi,                     // HHhMM  
      /(?<!\d\/)\b(\d{1,2})\.(\d{2})\b(?!\/\d)/g,   // HH.MM (attention aux dates)
    ];
    
    const times: { time: string; index: number }[] = [];
    
    for (const pattern of timePatterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        
        // Valider que c'est une heure valide
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          const normalizedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          times.push({ time: normalizedTime, index: match.index });
        }
      }
    }
    
    if (times.length === 0) {
      return { arrivalTime: null, departureTime: null };
    }
    
    // Dédupliquer par position
    const uniqueTimes = times.filter((t, i, arr) => 
      arr.findIndex(x => Math.abs(x.index - t.index) < 3) === i
    );
    
    const lineLength = line.length;
    
    if (uniqueTimes.length === 1) {
      const timeMatch = uniqueTimes[0];
      // Si l'horaire est dans la dernière partie de la ligne (après 60%) → départ
      const isRightSide = timeMatch.index > lineLength * 0.6;
      
      return isRightSide 
        ? { arrivalTime: null, departureTime: timeMatch.time }
        : { arrivalTime: timeMatch.time, departureTime: null };
    }
    
    // 2+ horaires : le premier est arrivée, le dernier est départ
    uniqueTimes.sort((a, b) => a.index - b.index);
    return {
      arrivalTime: uniqueTimes[0].time,
      departureTime: uniqueTimes[uniqueTimes.length - 1].time
    };
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
    const found = new Set<string>();

    // Tokens courts: éviter les faux positifs via \b...\b et normaliser
    if (/\bC\s*[\/\-]\s*O\b/i.test(line) || /\bCO\b/i.test(line)) {
      found.add('C/O');
    }
    if (/\bC\s*[\/\-]\s*I\b/i.test(line) || /\bCI\b/i.test(line)) {
      found.add('C/I');
    }

    if (/\bSALE\b/i.test(line)) found.add('SALE');
    else if (/\bSAL\b/i.test(line)) found.add('SAL');

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const keyword of PATTERNS.STATUS_KEYWORDS) {
      const k = keyword.toUpperCase();

      // Déjà géré ci-dessus (et on évite CO/CI en "substring")
      if (k === 'CO' || k === 'C/O' || k === 'CI' || k === 'C/I' || k === 'SAL' || k === 'SALE') {
        continue;
      }

      if (k.length <= 3) {
        const re = new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i');
        if (re.test(line)) found.add(k);
      } else {
        if (upper.includes(k)) found.add(k);
      }
    }

    return Array.from(found);
  }
  
  /**
   * Infère le nettoyage depuis les statuts détectés
   */
  private inferFromStatuses(
    statuses: string[],
    hasDepartureTime: boolean = false
  ): { cleaningType: CleaningType; status: string; reason: string; confidence: number } {
    const upper = statuses.map(s => s.toUpperCase());

    // Checkout + Arrival = à blanc (full clean)
    const hasCheckout = upper.some(s => ['PARTI', 'DEPART', 'CHECKOUT', 'CHECK-OUT', 'DEP', 'CO', 'C/O', 'DUE OUT'].includes(s));
    const hasArrival = upper.some(s => ['ARRIVÉE', 'ARRIVEE', 'ARRIVAL', 'CHECK-IN', 'ARR', 'CI', 'C/I', 'DUE IN', 'EN ARRIVÉE'].includes(s));

    // Si une heure est présente, on considère qu'il s'agit d'un départ effectif → checkout (pas checkout_arrival)
    if (hasCheckout && hasArrival && hasDepartureTime) {
      return { cleaningType: 'a_blanc', status: 'checkout', reason: 'Départ (heure détectée)', confidence: 92 };
    }

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

    // Dirty / SAL / SALE → Toujours À BLANC (nettoyage complet)
    // Correction demandée: SAL/SALE = chambre sale = à blanc par défaut
    const hasDirty = upper.some(s => ['SALE', 'DIRTY', 'DIR', 'SAL', 'VD'].includes(s));
    if (hasDirty) {
      return { cleaningType: 'a_blanc', status: 'dirty', reason: 'Sale → À blanc', confidence: 85 };
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
