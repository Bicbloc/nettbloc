/**
 * Adapter pour MisterBooking PMS
 * Format avec colonnes multiples: Chambre | Type | Dates | Statuts | Nettoyage
 * Exemple: rapport_hk.pdf
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType, normalizeCleaningType } from '../types';

export class MisterBookingAdapter extends PmsAdapter {
  readonly name = 'misterbooking';
  
  readonly criticalKeywords = [
    'MisterBooking',
    'Mister Booking',
    'misterbooking.com',
    'rapport_hk',
    'Rapport HK',
    'Planning Housekeeping'
  ];
  
  readonly keywords = [
    'Ménage', 'MÉNAGE', 'Menage',
    'Type chambre', 'Catégorie',
    // Statuts spécifiques MisterBooking
    'À faire', 'A faire', 'Fait', 'À vérifier', 'A vérifier',
    'Départ du jour', 'Arrivée du jour', 'Prolongation',
    'En séjour', 'En cours', 'Séjour',
    // Statuts nettoyage
    'Lit fait', 'Recouche', 'Complet', 'Refait',
    // Colonnes
    'Statut occupation', 'Statut ménage', 'Type de ménage',
    'Heure arrivée', 'Heure départ'
  ];

  readonly config: PmsConfig = {
    pmsType: 'misterbooking',
    keywords: this.keywords,
    roomNumberRegex: '(?:^|\\s|Ch\\.?\\s*)(\\d{2,4}[A-Z]?)(?:\\s|$|\\n)',
    statusMappings: {
      // Départs = À blanc
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 25 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 25 },
      'DÉPART DU JOUR': { status: 'checkout', cleaning: 'full', priority: 26 },
      'DEPART DU JOUR': { status: 'checkout', cleaning: 'full', priority: 26 },
      'CHECK-OUT': { status: 'checkout', cleaning: 'full', priority: 25 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 25 },
      'PARTI': { status: 'checkout', cleaning: 'full', priority: 25 },
      'LIBRE': { status: 'checkout', cleaning: 'full', priority: 20 },
      'COMPLET': { status: 'checkout', cleaning: 'full', priority: 22 },
      
      // Arrivées = À blanc (préparation)
      'ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 24 },
      'ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 24 },
      'ARRIVÉE DU JOUR': { status: 'arrival', cleaning: 'full', priority: 25 },
      'ARRIVEE DU JOUR': { status: 'arrival', cleaning: 'full', priority: 25 },
      'CHECK-IN': { status: 'arrival', cleaning: 'full', priority: 24 },
      'CHECKIN': { status: 'arrival', cleaning: 'full', priority: 24 },
      
      // Séjour = Recouche
      'EN SÉJOUR': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'EN SEJOUR': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'SÉJOUR': { status: 'stayover', cleaning: 'quick', priority: 14 },
      'SEJOUR': { status: 'stayover', cleaning: 'quick', priority: 14 },
      'PROLONGATION': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 16 },
      'OCCUPÉ': { status: 'stayover', cleaning: 'quick', priority: 12 },
      'OCCUPE': { status: 'stayover', cleaning: 'quick', priority: 12 },
      'EN COURS': { status: 'stayover', cleaning: 'quick', priority: 12 },
      'LIT FAIT': { status: 'stayover', cleaning: 'quick', priority: 14 },
      
      // À vérifier
      'À VÉRIFIER': { status: 'needs-inspection', cleaning: 'none', priority: 8 },
      'A VERIFIER': { status: 'needs-inspection', cleaning: 'none', priority: 8 },
      'FAIT': { status: 'clean', cleaning: 'none', priority: 5 },
      
      // Pas de ménage
      'REFUS': { status: 'no-service', cleaning: 'none', priority: 6 },
      'NE PAS DÉRANGER': { status: 'no-service', cleaning: 'none', priority: 6 },
      'DND': { status: 'no-service', cleaning: 'none', priority: 6 },
      
      // Hors service
      'HORS SERVICE': { status: 'out-of-order', cleaning: 'none', priority: 3 },
      'MAINTENANCE': { status: 'out-of-order', cleaning: 'none', priority: 3 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 3 },
    },
    combinationRules: [
      { conditions: ['DÉPART', 'ARRIVÉE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['CHECKOUT', 'CHECKIN'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM', 'dd-MM-yyyy']
  };

  /**
   * Override extractRooms pour MisterBooking format multi-colonnes
   */
  extractRooms(text: string): ExtractedRoom[] {
    // Essayer d'abord le parsing structuré en colonnes
    const structuredRooms = this.extractFromStructuredFormat(text);
    if (structuredRooms.length > 0) {
      return structuredRooms;
    }
    
    // Fallback sur le parsing standard
    return super.extractRooms(text);
  }

  /**
   * Extraction depuis format tabulaire MisterBooking
   */
  private extractFromStructuredFormat(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split('\n');
    
    // Pattern pour détecter une ligne de chambre MisterBooking
    // Format attendu: "101   Double   Dupont   12/01   13/01   Départ   À faire"
    const roomPattern = /^(\d{2,4}[A-Z]?)\s+(.+)/i;
    
    // Patterns pour dates
    const datePattern = /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/g;
    
    // Patterns pour statuts
    const departurePatterns = /\b(départ|depart|checkout|check-out|parti|libre|complet)\b/i;
    const arrivalPatterns = /\b(arrivée|arrivee|checkin|check-in|prévu)\b/i;
    const stayoverPatterns = /\b(en séjour|en sejour|séjour|sejour|prolongation|recouche|occupé|occupe|en cours)\b/i;
    const donePatterns = /\b(fait|propre|ok|terminé|vérifié)\b/i;
    const todoPatterns = /\b(à faire|a faire|à vérifier|a verifier|sale)\b/i;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.length < 3) continue;
      
      const match = trimmedLine.match(roomPattern);
      if (!match) continue;
      
      const roomNumber = match[1];
      const restOfLine = match[2];
      
      // Ignorer les lignes non-chambres
      if (!this.isValidRoomNumber(roomNumber, trimmedLine)) continue;
      
      // Extraire les dates
      const dates = trimmedLine.match(datePattern) || [];
      const arrivalDate = dates[0] || '';
      const departureDate = dates[1] || dates[0] || '';
      
      // Détecter le statut d'occupation
      let status: string = 'unknown';
      let cleaningType: CleaningType = 'recouche';
      
      const upperLine = trimmedLine.toUpperCase();
      
      // Détecter départ + arrivée (turnover)
      if (departurePatterns.test(trimmedLine) && arrivalPatterns.test(trimmedLine)) {
        status = 'checkout_arrival';
        cleaningType = 'a_blanc';
      } else if (departurePatterns.test(trimmedLine)) {
        status = 'checkout';
        cleaningType = 'a_blanc';
      } else if (arrivalPatterns.test(trimmedLine)) {
        status = 'arrival';
        cleaningType = 'a_blanc';
      } else if (stayoverPatterns.test(trimmedLine)) {
        status = 'stayover';
        cleaningType = 'recouche';
      } else if (donePatterns.test(trimmedLine)) {
        status = 'clean';
        cleaningType = 'none';
      }
      
      // Extraire le nom du client (optionnel)
      const guestMatch = restOfLine.match(/([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?)/);
      const guestName = guestMatch?.[1] || '';
      
      // Extraire le type de chambre
      const roomTypeMatch = restOfLine.match(/\b(Double|Twin|Single|Suite|Familiale|Triple|Quadruple|Studio)\b/i);
      const roomType = roomTypeMatch?.[1] || '';

      rooms.push({
        roomNumber,
        status,
        cleaningType: normalizeCleaningType(cleaningType),
        roomType,
        arrivalDate,
        departureDate,
        guestName,
        originalText: trimmedLine,
        validated: false,
        confidence: 85,
        debugInfo: {
          rawLine: trimmedLine,
          cleanedLine: restOfLine,
          detectedKeywords: [
            ...(departurePatterns.test(trimmedLine) ? ['DEPART'] : []),
            ...(arrivalPatterns.test(trimmedLine) ? ['ARRIVEE'] : []),
            ...(stayoverPatterns.test(trimmedLine) ? ['SEJOUR'] : []),
          ],
          appliedRule: `MisterBooking: ${status}`,
          source: 'structured-parser',
          confidence: 85
        }
      });
    }

    // Dédupliquer par numéro de chambre (garder celui avec le plus d'info)
    const roomMap = new Map<string, ExtractedRoom>();
    for (const room of rooms) {
      const existing = roomMap.get(room.roomNumber);
      if (!existing || (room.originalText?.length || 0) > (existing.originalText?.length || 0)) {
        roomMap.set(room.roomNumber, room);
      }
    }

    return Array.from(roomMap.values()).sort((a, b) => {
      const numA = parseInt(a.roomNumber, 10) || 0;
      const numB = parseInt(b.roomNumber, 10) || 0;
      return numA - numB;
    });
  }

  /**
   * Valide qu'un numéro est bien un numéro de chambre
   */
  protected isValidRoomNumber(num: string, originalLine: string): boolean {
    const n = parseInt(num, 10);
    
    // Range typique des chambres d'hôtel
    if (isNaN(n) || n < 1 || n > 9999) return false;
    
    // Exclure les contextes non-chambre
    const lowerLine = originalLine.toLowerCase();
    const patterns = [
      /\d+\s*(adultes?|enfants?|personnes?|pax)/i,
      /\d+\s*(nuit|jour)/i,
      /page\s*\d+/i,
      /total\s*[:=]?\s*\d+/i,
      /\d+[h:]\d+/i, // Heures
      /\d{1,2}\/\d{1,2}\/\d{2,4}/i, // Date au début
    ];
    
    // Vérifier si le numéro apparaît dans un contexte non-chambre
    for (const pattern of patterns) {
      if (pattern.test(originalLine) && originalLine.indexOf(num) > 0) {
        // Le numéro n'est pas au début de la ligne
        return false;
      }
    }
    
    return true;
  }
}
