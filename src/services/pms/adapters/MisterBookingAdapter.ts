/**
 * Adapter pour MisterBooking PMS
 * Format flexible: colonnes multiples, cases cochées, statuts variés
 * Supporte les formats: tableaux, cases à cocher, texte libre
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
    'Planning Housekeeping',
    'Mister-Booking'
  ];
  
  readonly keywords = [
    'Ménage', 'MÉNAGE', 'Menage',
    'Type chambre', 'Catégorie',
    // Statuts spécifiques MisterBooking
    'À faire', 'A faire', 'Fait', 'À vérifier', 'A vérifier',
    'Départ du jour', 'Arrivée du jour', 'Prolongation',
    'En séjour', 'En cours', 'Séjour',
    // Cases cochées (différents formats)
    '☑', '☐', '✓', '✗', '[x]', '[ ]', '[X]',
    // Colonnes
    'Blanc', 'Recouche', 'Complet', 'Simple',
    'Statut occupation', 'Statut ménage', 'Type de ménage',
    // Indicateurs visuels
    'X', 'O', '●', '○'
  ];

  readonly config: PmsConfig = {
    pmsType: 'misterbooking',
    keywords: this.keywords,
    roomNumberRegex: '(?:^|\\s|Ch\\.?\\s*|N°\\s*)(\\d{2,4}[A-Z]?)(?:\\s|$|\\t|\\||,)',
    statusMappings: {
      // Cases cochées pour À blanc
      '☑ BLANC': { status: 'checkout', cleaning: 'full', priority: 30 },
      '✓ BLANC': { status: 'checkout', cleaning: 'full', priority: 30 },
      '[X] BLANC': { status: 'checkout', cleaning: 'full', priority: 30 },
      'X BLANC': { status: 'checkout', cleaning: 'full', priority: 28 },
      'BLANC': { status: 'checkout', cleaning: 'full', priority: 25 },
      'À BLANC': { status: 'checkout', cleaning: 'full', priority: 26 },
      'A BLANC': { status: 'checkout', cleaning: 'full', priority: 26 },
      
      // Cases cochées pour Recouche
      '☑ RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 30 },
      '✓ RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 30 },
      '[X] RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 30 },
      'X RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 28 },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 25 },
      
      // Départs
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 24 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 24 },
      'DÉPART DU JOUR': { status: 'checkout', cleaning: 'full', priority: 25 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 24 },
      'LIBRE': { status: 'checkout', cleaning: 'full', priority: 20 },
      'COMPLET': { status: 'checkout', cleaning: 'full', priority: 22 },
      'SALE': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DIRTY': { status: 'checkout', cleaning: 'full', priority: 20 },
      
      // Arrivées
      'ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 23 },
      'ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 23 },
      'ARRIVÉE DU JOUR': { status: 'arrival', cleaning: 'full', priority: 24 },
      'CHECKIN': { status: 'arrival', cleaning: 'full', priority: 23 },
      
      // Séjour
      'EN SÉJOUR': { status: 'stayover', cleaning: 'quick', priority: 18 },
      'EN SEJOUR': { status: 'stayover', cleaning: 'quick', priority: 18 },
      'SÉJOUR': { status: 'stayover', cleaning: 'quick', priority: 16 },
      'PROLONGATION': { status: 'stayover', cleaning: 'quick', priority: 17 },
      'OCCUPÉ': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'EN COURS': { status: 'stayover', cleaning: 'quick', priority: 14 },
      
      // Fait / Propre
      'FAIT': { status: 'clean', cleaning: 'none', priority: 8 },
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'OK': { status: 'clean', cleaning: 'none', priority: 7 },
      
      // Pas de ménage
      'REFUS': { status: 'no-service', cleaning: 'none', priority: 6 },
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
      { conditions: ['BLANC', 'X'], result: { status: 'checkout', cleaning: 'full' } },
      { conditions: ['RECOUCHE', 'X'], result: { status: 'stayover', cleaning: 'quick' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM', 'dd-MM-yyyy', 'dd.MM.yyyy']
  };

  /**
   * Override extractRooms pour supporter plusieurs formats MisterBooking
   */
  extractRooms(text: string): ExtractedRoom[] {
    // Essayer d'abord le format cases cochées
    const checkboxRooms = this.extractFromCheckboxFormat(text);
    if (checkboxRooms.length > 0) {
      return checkboxRooms;
    }
    
    // Essayer le format tabulaire
    const structuredRooms = this.extractFromStructuredFormat(text);
    if (structuredRooms.length > 0) {
      return structuredRooms;
    }
    
    // Fallback sur le parsing standard
    return super.extractRooms(text);
  }

  /**
   * Extraction depuis format avec cases cochées
   * Ex: "101  ☑ Blanc  ☐ Recouche" ou "101  X   O" 
   */
  private extractFromCheckboxFormat(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split('\n');
    
    // Patterns pour détecter les cases cochées
    const checkPatterns = [
      { pattern: /[☑✓\[X\]]\s*(blanc|à blanc|a blanc)/i, type: 'a_blanc' as CleaningType },
      { pattern: /[☑✓\[X\]]\s*(recouche|séjour|sejour)/i, type: 'recouche' as CleaningType },
      { pattern: /(blanc|à blanc|a blanc)\s*[☑✓X]/i, type: 'a_blanc' as CleaningType },
      { pattern: /(recouche|séjour)\s*[☑✓X]/i, type: 'recouche' as CleaningType },
      // Format colonnes avec X/O
      { pattern: /\bX\s+(?:O|\s|$)/i, type: 'a_blanc' as CleaningType }, // X dans première colonne
      { pattern: /\b(?:O|\s)\s+X/i, type: 'recouche' as CleaningType }, // X dans deuxième colonne
    ];

    const roomPattern = /\b(\d{2,4}[A-Z]?)\b/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue;
      
      const roomMatch = trimmed.match(roomPattern);
      if (!roomMatch) continue;
      
      const roomNumber = roomMatch[1];
      if (!this.isValidRoomNumber(roomNumber, trimmed)) continue;
      
      // Chercher le type de nettoyage via les cases cochées
      let cleaningType: CleaningType = 'recouche'; // défaut
      let matched = false;
      
      for (const { pattern, type } of checkPatterns) {
        if (pattern.test(trimmed)) {
          cleaningType = type;
          matched = true;
          break;
        }
      }
      
      // Si pas de case cochée trouvée, utiliser les mots-clés standards
      if (!matched) {
        const upperLine = trimmed.toUpperCase();
        if (upperLine.includes('BLANC') || upperLine.includes('DÉPART') || upperLine.includes('DEPART')) {
          cleaningType = 'a_blanc';
        } else if (upperLine.includes('RECOUCHE') || upperLine.includes('SÉJOUR') || upperLine.includes('OCCUP')) {
          cleaningType = 'recouche';
        } else if (upperLine.includes('PROPRE') || upperLine.includes('FAIT') || upperLine.includes('OK')) {
          cleaningType = 'none';
        }
      }

      rooms.push({
        roomNumber,
        status: cleaningType === 'a_blanc' ? 'checkout' : 
                cleaningType === 'recouche' ? 'stayover' : 'clean',
        cleaningType: normalizeCleaningType(cleaningType),
        originalText: trimmed,
        validated: false,
        confidence: matched ? 90 : 75,
        debugInfo: {
          rawLine: trimmed,
          cleanedLine: trimmed,
          detectedKeywords: [],
          source: 'pattern',
          confidence: matched ? 90 : 75
        }
      });
    }

    return this.deduplicateRooms(rooms);
  }

  /**
   * Extraction depuis format tabulaire
   */
  private extractFromStructuredFormat(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split('\n');
    
    const roomPattern = /^(\d{2,4}[A-Z]?)\s+(.+)/i;
    const departurePatterns = /\b(départ|depart|checkout|check-out|parti|libre|complet|blanc|sale)\b/i;
    const stayoverPatterns = /\b(séjour|sejour|prolongation|recouche|occupé|occupe|en cours)\b/i;
    const noServicePatterns = /\b(fait|propre|ok|terminé|clean)\b/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) continue;
      
      const match = trimmed.match(roomPattern);
      if (!match) continue;
      
      const roomNumber = match[1];
      if (!this.isValidRoomNumber(roomNumber, trimmed)) continue;
      
      let cleaningType: CleaningType = 'recouche';
      let status = 'stayover';
      
      if (departurePatterns.test(trimmed)) {
        status = 'checkout';
        cleaningType = 'a_blanc';
      } else if (stayoverPatterns.test(trimmed)) {
        status = 'stayover';
        cleaningType = 'recouche';
      } else if (noServicePatterns.test(trimmed)) {
        status = 'clean';
        cleaningType = 'none';
      }

      rooms.push({
        roomNumber,
        status,
        cleaningType: normalizeCleaningType(cleaningType),
        originalText: trimmed,
        validated: false,
        confidence: 80,
        debugInfo: {
          rawLine: trimmed,
          cleanedLine: trimmed,
          detectedKeywords: [],
          source: 'structured-parser',
          confidence: 80
        }
      });
    }

    return this.deduplicateRooms(rooms);
  }

  /**
   * Dédupliquer les chambres
   */
  private deduplicateRooms(rooms: ExtractedRoom[]): ExtractedRoom[] {
    const roomMap = new Map<string, ExtractedRoom>();
    for (const room of rooms) {
      const existing = roomMap.get(room.roomNumber);
      if (!existing || (room.confidence || 0) > (existing.confidence || 0)) {
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
    if (isNaN(n) || n < 1 || n > 9999) return false;
    
    // Exclure les contextes non-chambre
    const patterns = [
      /\d+\s*(adultes?|enfants?|personnes?|pax)/i,
      /\d+\s*(nuit|jour)/i,
      /page\s*\d+/i,
      /total\s*[:=]?\s*\d+/i,
      /\d+[h:]\d+/i,
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(originalLine) && originalLine.indexOf(num) > 5) {
        return false;
      }
    }
    
    return true;
  }
}
