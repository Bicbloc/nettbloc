/**
 * LocalRoomParser v2 - Service de parsing local amélioré
 * - Meilleure détection des numéros de chambre
 * - Logique date/nuit corrigée
 * - Support des chambres liées (107+108)
 */

import { isSameDay, isAfter, isBefore, isValid } from 'date-fns';
import { NormalizedCleaningType, normalizeCleaningType } from './types';

export interface ParsedRoom {
  roomNumber: string;
  cleaningType: NormalizedCleaningType;
  status: string;
  nightInfo?: string;
  departureDate?: string;
  arrivalDate?: string;
  guestName?: string;
  reason: string;
  confidence: number;
  originalLine: string;
}

export interface ParseResult {
  rooms: ParsedRoom[];
  reportDate: Date;
  detectedPms: string;
  confidence: number;
}

// Patterns améliorés pour les numéros de chambre
const ROOM_PATTERNS = [
  /\b(\d{1,4}[A-Za-z]?)\b/,                    // 101, 215B, 107a
  /\b(\d{1,4}\s*\+\s*\d{1,4})\b/,              // 107+108 (chambres liées)
  /\bRoom\s*(\d{1,4}[A-Za-z]?)/i,              // Room 101
  /\bCh\.?\s*(\d{1,4}[A-Za-z]?)/i,             // Ch. 101, Ch101
  /\bChambre\s*(\d{1,4}[A-Za-z]?)/i,           // Chambre 101
];

// Patterns à ignorer (faux positifs)
const IGNORE_PATTERNS = [
  /\d{2}\/\d{2}\/\d{4}/,                       // Dates
  /\d{2}:\d{2}/,                               // Heures
  /\d+\s*[×x]\s*\w+/i,                         // "1 × Adultes"
  /Nuit\s*\d+/i,                               // "Nuit 2"
  /^\d{4}$/,                                   // Années seules (2025)
  /^\d{2}$/,                                   // 2 chiffres seuls
  /page\s*\d+/i,                               // Numéros de page
  /total/i,                                    // Totaux
];

// Date patterns
const DATE_REGEX = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
const NIGHT_REGEX = /(?:Nuit|Night|N)\s*(\d+)\s*[\/\\-]\s*(\d+)/i;

// Status keywords
const STATUS_KEYWORDS = {
  checkout: ['parti', 'départ', 'checkout', 'check-out', 'dep', 'dir', 'out', 'leaving'],
  arrival: ['arrivée', 'arrival', 'arr', 'en arrivée', 'coming', 'check-in'],
  stayover: ['recouche', 'stayover', 'sal', 'séjour', 'stay', 'occupied'],
  clean: ['propre', 'clean', 'ins', 'inspecté', 'a controler', 'contrôlé', 'inspected', 'ready'],
  outOfOrder: ['hs', 'hors service', 'ooo', 'out of order', 'maintenance', 'blocked', 'bloqué']
};

class LocalRoomParser {
  private debugLogs: string[] = [];

  private log(message: string): void {
    this.debugLogs.push(`[Parser] ${message}`);
    console.debug(`[LocalParser] ${message}`);
  }

  /**
   * Extrait la date du rapport
   */
  extractReportDate(text: string): Date {
    // Patterns par ordre de priorité
    const patterns = [
      /(?:Statut|Status|Report|Rapport).*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /(?:Date|Le)\s*[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Hôtel.*?(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{2}:\d{2}/i,
      /(\d{1,2}\/\d{1,2}\/\d{4})/  // Première date trouvée (fallback)
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const parsed = this.parseDate(match[1]);
        if (parsed) {
          this.log(`Date extraite: ${match[1]}`);
          return parsed;
        }
      }
    }

    this.log('Date non trouvée, utilisation de la date du jour');
    return new Date();
  }

  /**
   * Parse une date DD/MM/YYYY
   */
  private parseDate(dateStr: string): Date | null {
    try {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        if (isValid(date) && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
          return date;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Extrait le numéro de chambre d'une ligne
   */
  private extractRoomNumber(line: string): string | null {
    // Vérifier si c'est une ligne à ignorer
    if (this.shouldIgnoreLine(line)) return null;

    // Chercher avec les patterns
    for (const pattern of ROOM_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const roomNum = match[1].replace(/\s+/g, '').toUpperCase();
        
        // Vérifier que ce n'est pas un faux positif
        if (this.isValidRoomNumber(roomNum, line)) {
          return roomNum;
        }
      }
    }
    return null;
  }

  /**
   * Vérifie si un numéro de chambre est valide
   */
  private isValidRoomNumber(roomNum: string, line: string): boolean {
    // Ignorer les années
    if (/^(19|20)\d{2}$/.test(roomNum)) return false;
    
    // Ignorer les numéros trop courts sans contexte
    if (roomNum.length <= 1) return false;

    // Ignorer si le numéro fait partie d'un pattern ignoré
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.test(line) && line.match(pattern)?.[0]?.includes(roomNum)) {
        return false;
      }
    }

    // Préférer les numéros entre 100 et 9999
    const num = parseInt(roomNum.replace(/[A-Za-z]/g, ''), 10);
    if (num >= 100 && num <= 9999) return true;
    
    // Accepter les numéros < 100 si le contexte suggère une chambre
    if (num < 100 && num > 0) {
      const hasRoomContext = /chambre|room|ch\./i.test(line);
      return hasRoomContext;
    }

    return true;
  }

  /**
   * Détermine le type de nettoyage - LOGIQUE CORRIGÉE
   */
  determineCleaningType(
    reportDate: Date,
    departureDate: Date | null,
    nightInfo: { current: number; total: number } | null,
    statuses: string[]
  ): { cleaningType: NormalizedCleaningType; status: string; reason: string } {
    const statusLower = statuses.join(' ').toLowerCase();

    // Règle 1: Hors service → Aucun nettoyage
    if (STATUS_KEYWORDS.outOfOrder.some(k => statusLower.includes(k))) {
      return { cleaningType: 'none', status: 'out_of_order', reason: 'Hors service' };
    }

    // Règle 2: Checkout + Arrivée même jour → À Blanc
    const hasCheckout = STATUS_KEYWORDS.checkout.some(k => statusLower.includes(k));
    const hasArrival = STATUS_KEYWORDS.arrival.some(k => statusLower.includes(k));

    if (hasCheckout && hasArrival) {
      return { cleaningType: 'a_blanc', status: 'checkout_arrival', reason: 'Départ + Arrivée' };
    }

    // Règle 3: CRITIQUE - Nuit X/Y avec date de départ
    if (nightInfo && departureDate) {
      // Si date de départ == date du rapport → À Blanc (part aujourd'hui)
      if (isSameDay(departureDate, reportDate)) {
        return { 
          cleaningType: 'a_blanc', 
          status: 'checkout', 
          reason: `Départ aujourd'hui (Nuit ${nightInfo.current}/${nightInfo.total})` 
        };
      }
      // Si date de départ > date du rapport → Recouche (reste encore)
      if (isAfter(departureDate, reportDate)) {
        return { 
          cleaningType: 'recouche', 
          status: 'stayover', 
          reason: `Client reste (Nuit ${nightInfo.current}/${nightInfo.total}, départ ${departureDate.toLocaleDateString('fr-FR')})` 
        };
      }
    }

    // Règle 4: Nuit X/Y sans date → Utiliser la logique X == Y
    if (nightInfo) {
      if (nightInfo.current === nightInfo.total) {
        return { 
          cleaningType: 'a_blanc', 
          status: 'checkout', 
          reason: `Dernière nuit (${nightInfo.current}/${nightInfo.total})` 
        };
      }
      if (nightInfo.current < nightInfo.total) {
        return { 
          cleaningType: 'recouche', 
          status: 'stayover', 
          reason: `Séjour en cours (${nightInfo.current}/${nightInfo.total})` 
        };
      }
    }

    // Règle 5: Date de départ seule
    if (departureDate) {
      if (isSameDay(departureDate, reportDate)) {
        return { cleaningType: 'a_blanc', status: 'checkout', reason: `Départ le ${departureDate.toLocaleDateString('fr-FR')}` };
      }
      if (isAfter(departureDate, reportDate)) {
        return { cleaningType: 'recouche', status: 'stayover', reason: `Reste jusqu'au ${departureDate.toLocaleDateString('fr-FR')}` };
      }
      if (isBefore(departureDate, reportDate)) {
        return { cleaningType: 'a_blanc', status: 'checkout', reason: 'Déjà parti' };
      }
    }

    // Règle 6: Keywords de statut
    if (STATUS_KEYWORDS.stayover.some(k => statusLower.includes(k))) {
      return { cleaningType: 'recouche', status: 'stayover', reason: 'Mot-clé séjour' };
    }

    if (hasCheckout) {
      return { cleaningType: 'a_blanc', status: 'checkout', reason: 'Départ détecté' };
    }

    if (hasArrival) {
      return { cleaningType: 'a_blanc', status: 'arrival', reason: 'Arrivée prévue' };
    }

    if (STATUS_KEYWORDS.clean.some(k => statusLower.includes(k))) {
      return { cleaningType: 'none', status: 'clean', reason: 'Déjà propre' };
    }

    // Par défaut → À Blanc (sécurité)
    return { cleaningType: 'a_blanc', status: 'unknown', reason: 'Type par défaut' };
  }

  /**
   * Parse le rapport complet
   */
  parseReport(text: string, reportDateOverride?: Date): ParseResult {
    this.debugLogs = [];
    const reportDate = reportDateOverride || this.extractReportDate(text);
    this.log(`Date du rapport: ${reportDate.toLocaleDateString('fr-FR')}`);

    const lines = text.split('\n').filter(l => l.trim().length > 3);
    const roomsMap = new Map<string, ParsedRoom>();

    for (const line of lines) {
      const roomNumber = this.extractRoomNumber(line);
      if (!roomNumber) continue;

      // Extraire les informations
      const nightInfo = this.extractNightInfo(line);
      const dates = this.extractDates(line);
      const statuses = this.extractStatuses(line);
      const guestName = this.extractGuestName(line);

      // Déterminer la date de départ intelligemment
      let departureDate: Date | null = null;
      
      // Si Nuit X/Y avec une date, c'est probablement la date de départ
      if (nightInfo && dates.length > 0) {
        // La date la plus lointaine est généralement le départ
        departureDate = dates.reduce((latest, d) => 
          !latest || isAfter(d, latest) ? d : latest
        , dates[0]);
      } else if (dates.length >= 2) {
        // 2 dates = arrivée et départ
        departureDate = dates[1];
      } else if (dates.length === 1) {
        // 1 date avec checkout = date de départ
        if (statuses.some(s => STATUS_KEYWORDS.checkout.some(k => s.toLowerCase().includes(k)))) {
          departureDate = dates[0];
        }
      }

      // Déterminer le type de nettoyage
      const result = this.determineCleaningType(reportDate, departureDate, nightInfo, statuses);

      // Gérer les doublons (fusionner les infos)
      const existing = roomsMap.get(roomNumber);
      if (existing) {
        const mergedStatuses = [...new Set([...statuses, ...this.extractStatuses(existing.originalLine)])];
        const mergedResult = this.determineCleaningType(reportDate, departureDate, nightInfo, mergedStatuses);

        roomsMap.set(roomNumber, {
          ...existing,
          cleaningType: mergedResult.cleaningType,
          status: mergedResult.status,
          reason: `${mergedResult.reason} (fusionné)`,
          confidence: Math.max(existing.confidence, 85),
          originalLine: `${existing.originalLine} | ${line}`
        });
      } else {
        roomsMap.set(roomNumber, {
          roomNumber,
          cleaningType: result.cleaningType,
          status: result.status,
          nightInfo: nightInfo ? `${nightInfo.current}/${nightInfo.total}` : undefined,
          departureDate: departureDate?.toLocaleDateString('fr-FR'),
          arrivalDate: dates[0]?.toLocaleDateString('fr-FR'),
          guestName,
          reason: result.reason,
          confidence: 80,
          originalLine: line
        });
      }
    }

    const rooms = Array.from(roomsMap.values());
    const avgConfidence = rooms.length > 0 
      ? rooms.reduce((sum, r) => sum + r.confidence, 0) / rooms.length 
      : 0;

    this.log(`${rooms.length} chambres extraites`);

    return {
      rooms,
      reportDate,
      detectedPms: this.detectPms(text),
      confidence: avgConfidence
    };
  }

  /**
   * Extrait Nuit X/Y
   */
  private extractNightInfo(line: string): { current: number; total: number } | null {
    const match = line.match(NIGHT_REGEX);
    if (match) {
      const current = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      if (current > 0 && total > 0 && current <= total) {
        return { current, total };
      }
    }
    return null;
  }

  /**
   * Extrait toutes les dates
   */
  private extractDates(line: string): Date[] {
    const dates: Date[] = [];
    const matches = line.matchAll(DATE_REGEX);
    for (const match of matches) {
      const parsed = this.parseDate(match[1]);
      if (parsed) dates.push(parsed);
    }
    return dates;
  }

  /**
   * Extrait les statuts
   */
  private extractStatuses(line: string): string[] {
    const statuses: string[] = [];
    const allKeywords = Object.values(STATUS_KEYWORDS).flat();
    const lineLower = line.toLowerCase();
    
    for (const keyword of allKeywords) {
      if (lineLower.includes(keyword)) {
        statuses.push(keyword);
      }
    }
    return statuses;
  }

  /**
   * Extrait le nom du client
   */
  private extractGuestName(line: string): string | undefined {
    // Chercher des noms (Majuscule + minuscules)
    const nameMatch = line.match(/\b([A-Z][a-zéèêëàâäôöùûü]+(?:\s+[A-Z][a-zéèêëàâäôöùûü]+)?)\b/);
    if (nameMatch) {
      const name = nameMatch[1];
      const ignore = ['Statut', 'Chambre', 'Room', 'Nuit', 'Night', 'Hotel', 'Hôtel', 'Arrivée', 'Départ', 'Adulte'];
      if (!ignore.some(w => name.includes(w))) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * Ligne à ignorer?
   */
  private shouldIgnoreLine(line: string): boolean {
    const patterns = [
      /superviseur|supervisor|manager|chef|responsable/i,
      /^(total|summary|rapport|report|page|date|hotel|hôtel)/i,
      /^\s*$/,
      /^\d+\s*chambres?/i,
      /nombre\s+de/i
    ];
    return patterns.some(p => p.test(line));
  }

  /**
   * Détecte le PMS
   */
  private detectPms(text: string): string {
    const textUpper = text.toUpperCase();
    
    if (textUpper.includes('APALEO') || (textUpper.includes('PARTI') && textUpper.includes('EN ARRIVÉE'))) {
      return 'apaleo';
    }
    if (textUpper.includes('MEWS')) return 'mews';
    if (textUpper.includes('OPERA')) return 'opera';
    if (textUpper.includes('PROTEL')) return 'protel';
    if (textUpper.includes('FIDELIO')) return 'fidelio';
    if (textUpper.includes('MEDIALOG')) return 'medialog';
    
    return 'generic';
  }

  getDebugLogs(): string[] {
    return this.debugLogs;
  }
}

export const localRoomParser = new LocalRoomParser();
