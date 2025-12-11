/**
 * Service de parsing local simplifié
 * Logique claire basée sur les dates et patterns
 */

import { isSameDay, isAfter, parse, isValid } from 'date-fns';
import { ExtractedRoom, NormalizedCleaningType, normalizeCleaningType } from './types';

interface ParsedRoom {
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

interface ParseResult {
  rooms: ParsedRoom[];
  reportDate: Date;
  detectedPms: string;
  confidence: number;
}

// Regex patterns
const ROOM_REGEX = /\b(\d{1,4}[A-Z]?)\b/;
const DATE_REGEX = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
const NIGHT_REGEX = /(?:Nuit|Night|N)\s*(\d+)\s*[\/\\]\s*(\d+)/i;

// Status keywords mapping
const STATUS_KEYWORDS = {
  checkout: ['parti', 'départ', 'checkout', 'check-out', 'dep', 'dir'],
  arrival: ['arrivée', 'arrival', 'arr', 'en arrivée'],
  stayover: ['recouche', 'stayover', 'sal', 'séjour'],
  clean: ['propre', 'clean', 'ins', 'inspecté', 'a controler', 'contrôlé'],
  outOfOrder: ['hs', 'hors service', 'ooo', 'out of order', 'maintenance', 'blocked']
};

class LocalRoomParser {
  private debugLogs: string[] = [];

  private log(message: string): void {
    this.debugLogs.push(`[LocalParser] ${message}`);
    console.log(`[LocalParser] ${message}`);
  }

  /**
   * Extrait la date du rapport depuis le texte
   */
  extractReportDate(text: string): Date {
    // Format: "Statut des espaces - 20/11/2025"
    const titleMatch = text.match(/(?:Statut|Status|Report).*?(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (titleMatch) {
      const parsed = this.parseDate(titleMatch[1]);
      if (parsed) return parsed;
    }
    
    // Format: "Hôtel Acanthe 20/11/2025 15:32:05"
    const footerMatch = text.match(/Hôtel.*?(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{2}:\d{2}/i);
    if (footerMatch) {
      const parsed = this.parseDate(footerMatch[1]);
      if (parsed) return parsed;
    }
    
    // Première date trouvée
    const firstDate = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (firstDate) {
      const parsed = this.parseDate(firstDate[1]);
      if (parsed) return parsed;
    }
    
    return new Date();
  }

  /**
   * Parse une date au format DD/MM/YYYY
   */
  private parseDate(dateStr: string): Date | null {
    try {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        if (isValid(date)) return date;
      }
    } catch {}
    return null;
  }

  /**
   * Détermine le type de nettoyage basé sur les règles claires
   */
  determineCleaningType(
    reportDate: Date,
    departureDate: Date | null,
    nightInfo: { current: number; total: number } | null,
    statuses: string[]
  ): { cleaningType: NormalizedCleaningType; status: string; reason: string } {
    const statusLower = statuses.map(s => s.toLowerCase()).join(' ');

    // Règle 1: Hors service
    if (STATUS_KEYWORDS.outOfOrder.some(k => statusLower.includes(k))) {
      return { cleaningType: 'none', status: 'out_of_order', reason: 'Hors service' };
    }

    // Règle 2: Checkout + Arrivée même jour = À Blanc
    const hasCheckout = STATUS_KEYWORDS.checkout.some(k => statusLower.includes(k));
    const hasArrival = STATUS_KEYWORDS.arrival.some(k => statusLower.includes(k));
    
    if (hasCheckout && hasArrival) {
      return { cleaningType: 'a_blanc', status: 'checkout_arrival', reason: 'Départ + Arrivée = À Blanc' };
    }

    // Règle 3: Date de départ == date du rapport → À Blanc
    if (departureDate && isSameDay(departureDate, reportDate)) {
      return { cleaningType: 'a_blanc', status: 'checkout', reason: `Départ aujourd'hui (${departureDate.toLocaleDateString('fr-FR')})` };
    }

    // Règle 4: Nuit X/Y où X == Y → À Blanc (dernière nuit)
    if (nightInfo && nightInfo.current === nightInfo.total) {
      return { cleaningType: 'a_blanc', status: 'checkout', reason: `Dernière nuit (${nightInfo.current}/${nightInfo.total})` };
    }

    // Règle 5: Date de départ > date du rapport → Recouche
    if (departureDate && isAfter(departureDate, reportDate)) {
      return { cleaningType: 'recouche', status: 'stayover', reason: `Client reste (départ ${departureDate.toLocaleDateString('fr-FR')})` };
    }

    // Règle 6: Nuit X/Y où X < Y → Recouche
    if (nightInfo && nightInfo.current < nightInfo.total) {
      return { cleaningType: 'recouche', status: 'stayover', reason: `Séjour en cours (${nightInfo.current}/${nightInfo.total})` };
    }

    // Règle 7: Stayover keywords → Recouche
    if (STATUS_KEYWORDS.stayover.some(k => statusLower.includes(k))) {
      return { cleaningType: 'recouche', status: 'stayover', reason: 'Mot-clé recouche détecté' };
    }

    // Règle 8: Checkout seul → À Blanc
    if (hasCheckout) {
      return { cleaningType: 'a_blanc', status: 'checkout', reason: 'Départ détecté' };
    }

    // Règle 9: Arrivée seule → À Blanc (préparation)
    if (hasArrival) {
      return { cleaningType: 'a_blanc', status: 'arrival', reason: 'Arrivée prévue' };
    }

    // Règle 10: Propre
    if (STATUS_KEYWORDS.clean.some(k => statusLower.includes(k))) {
      return { cleaningType: 'none', status: 'clean', reason: 'Chambre propre' };
    }

    // Par défaut → À Blanc
    return { cleaningType: 'a_blanc', status: 'unknown', reason: 'Type par défaut' };
  }

  /**
   * Parse le rapport et extrait les chambres
   */
  parseReport(text: string, reportDateOverride?: Date): ParseResult {
    this.debugLogs = [];
    const reportDate = reportDateOverride || this.extractReportDate(text);
    this.log(`Date du rapport: ${reportDate.toLocaleDateString('fr-FR')}`);

    const lines = text.split('\n').filter(l => l.trim().length > 3);
    const roomsMap = new Map<string, ParsedRoom>();

    for (const line of lines) {
      const roomMatch = line.match(ROOM_REGEX);
      if (!roomMatch) continue;

      const roomNumber = roomMatch[1];
      
      // Ignorer les lignes qui ne sont pas des chambres
      if (this.shouldIgnoreLine(line)) continue;

      // Extraire les infos
      const nightInfo = this.extractNightInfo(line);
      const dates = this.extractDates(line);
      const statuses = this.extractStatuses(line);
      const guestName = this.extractGuestName(line);

      // Déterminer la date de départ
      let departureDate: Date | null = null;
      if (nightInfo && dates.length > 0) {
        // La date à côté de Nuit X/Y est souvent la date de départ
        departureDate = dates[dates.length - 1];
      } else if (dates.length >= 2) {
        departureDate = dates[1]; // Deuxième date = départ
      } else if (dates.length === 1 && statuses.some(s => 
        STATUS_KEYWORDS.checkout.some(k => s.toLowerCase().includes(k))
      )) {
        departureDate = dates[0];
      }

      // Déterminer le type de nettoyage
      const result = this.determineCleaningType(reportDate, departureDate, nightInfo, statuses);

      // Fusionner si la chambre existe déjà
      const existing = roomsMap.get(roomNumber);
      if (existing) {
        // Fusionner les statuts
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

    this.log(`${rooms.length} chambres extraites, confiance moyenne: ${avgConfidence.toFixed(0)}%`);

    return {
      rooms,
      reportDate,
      detectedPms: this.detectPms(text),
      confidence: avgConfidence
    };
  }

  /**
   * Extrait les infos Nuit X/Y
   */
  private extractNightInfo(line: string): { current: number; total: number } | null {
    const match = line.match(NIGHT_REGEX);
    if (match) {
      return {
        current: parseInt(match[1], 10),
        total: parseInt(match[2], 10)
      };
    }
    return null;
  }

  /**
   * Extrait toutes les dates d'une ligne
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
   * Extrait les statuts d'une ligne
   */
  private extractStatuses(line: string): string[] {
    const statuses: string[] = [];
    const allKeywords = [
      ...STATUS_KEYWORDS.checkout,
      ...STATUS_KEYWORDS.arrival,
      ...STATUS_KEYWORDS.stayover,
      ...STATUS_KEYWORDS.clean,
      ...STATUS_KEYWORDS.outOfOrder
    ];
    
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
    // Pattern: chercher des noms propres (Majuscule suivie de minuscules)
    const nameMatch = line.match(/\b([A-Z][a-zéèêëàâäôöùûü]+(?:\s+[A-Z][a-zéèêëàâäôöùûü]+)?)\b/);
    if (nameMatch) {
      const name = nameMatch[1];
      // Ignorer les mots-clés connus
      const ignoreList = ['Statut', 'Chambre', 'Room', 'Nuit', 'Night', 'Hotel', 'Hôtel', 'Arrivée', 'Départ'];
      if (!ignoreList.some(w => name.includes(w))) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * Détermine si une ligne doit être ignorée
   */
  private shouldIgnoreLine(line: string): boolean {
    const ignorePatterns = [
      /superviseur|supervisor|manager|chef|responsable/i,
      /^(total|summary|rapport|report|page|date)/i,
      /^\s*$/
    ];
    return ignorePatterns.some(p => p.test(line));
  }

  /**
   * Détecte le type de PMS
   */
  private detectPms(text: string): string {
    const textUpper = text.toUpperCase();
    
    if (textUpper.includes('APALEO') || (textUpper.includes('PARTI') && textUpper.includes('EN ARRIVÉE'))) {
      return 'apaleo';
    }
    if (textUpper.includes('MEWS')) {
      return 'mews';
    }
    if (textUpper.includes('OPERA')) {
      return 'opera';
    }
    if (textUpper.includes('PROTEL')) {
      return 'protel';
    }
    return 'generic';
  }

  /**
   * Retourne les logs de debug
   */
  getDebugLogs(): string[] {
    return this.debugLogs;
  }
}

export const localRoomParser = new LocalRoomParser();
export type { ParsedRoom, ParseResult };
