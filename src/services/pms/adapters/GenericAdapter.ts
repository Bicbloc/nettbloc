/**
 * Adapter générique pour PMS inconnus
 * Utilise des patterns communs et regex universelle
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType, ExtractionDebugInfo } from '../types';

export class GenericAdapter extends PmsAdapter {
  readonly name = 'generic';
  
  readonly keywords: string[] = [];
  readonly criticalKeywords: string[] = [];

  readonly config: PmsConfig = {
    pmsType: 'generic',
    keywords: [],
    criticalKeywords: [],
    // Regex universelle améliorée: supporte numérique, alphanumérique, avec tirets
    roomNumberRegex: '(?<![\/\\-\\.\\d:])(?:(?:Room|Ch\\.?|Chambre|R|#)\\s*)?([A-Z]?-?0*[1-9]\\d{0,3}[A-Z]?)(?![\/\\-\\.\\d:])',
    statusMappings: {
      // Français - Priorité haute (statuts principaux)
      'PARTI': { status: 'checkout', cleaning: 'full', priority: 22 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 22 },
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 22 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 22 },
      'CHECK-OUT': { status: 'checkout', cleaning: 'full', priority: 22 },
      'EN ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 20 },
      'EN ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 20 },
      'ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 18 },
      'ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 18 },
      'ARRIVAL': { status: 'arrival', cleaning: 'full', priority: 18 },
      'CHECK-IN': { status: 'arrival', cleaning: 'full', priority: 18 },
      'DUE IN': { status: 'arrival', cleaning: 'full', priority: 18 },
      'DUE OUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      
      // Statuts "sale" / dirty
      'SALE': { status: 'dirty', cleaning: 'full', priority: 20 },
      'SAL': { status: 'dirty', cleaning: 'full', priority: 20 },
      'DIR': { status: 'dirty', cleaning: 'full', priority: 20 },
      'DIRTY': { status: 'dirty', cleaning: 'full', priority: 20 },
      'VD': { status: 'dirty', cleaning: 'full', priority: 20 },
      'VACANT DIRTY': { status: 'dirty', cleaning: 'full', priority: 21 },
      
      // Recouche / Stayover
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'STAYOVER': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'STAY OVER': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'DRAPS': { status: 'stayover', cleaning: 'quick', priority: 14 },
      'OD': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'OCCUPIED DIRTY': { status: 'stayover', cleaning: 'quick', priority: 16 },
      
      // Propre / Clean / Inspecté
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'INS': { status: 'clean', cleaning: 'none', priority: 8 },
      'INSPECTED': { status: 'clean', cleaning: 'none', priority: 8 },
      'VC': { status: 'clean', cleaning: 'none', priority: 8 },
      'VACANT CLEAN': { status: 'clean', cleaning: 'none', priority: 9 },
      'A CONTROLER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
      'A CONTRÔLER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
      'TO INSPECT': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
      
      // Occupé
      'OCCUPÉ': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPE': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OC': { status: 'occupied', cleaning: 'none', priority: 5 },
      
      // Libre / Vacant
      'LIBRE': { status: 'vacant', cleaning: 'full', priority: 15 },
      'VACANT': { status: 'vacant', cleaning: 'full', priority: 15 },
      
      // Hors service
      'HS': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'HORS SERVICE': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'MAINTENANCE': { status: 'maintenance', cleaning: 'none', priority: 25 },
    },
    combinationRules: [
      { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DUE OUT', 'DUE IN'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy', 'yyyy-MM-dd', 'MM/dd/yyyy']
  };

  /**
   * Détection avec fallback basé sur des patterns génériques
   */
  detect(text: string): { pmsType: string; confidence: number; matchedKeywords: string[] } {
    return {
      pmsType: 'generic',
      confidence: 10,
      matchedKeywords: []
    };
  }

  /**
   * Pré-traite le texte pour séparer les chambres concaténées (PDF copié)
   */
  private preprocessText(text: string): string {
    let processed = text;
    
    // Pattern: espace(s) + numéro de chambre (01-999) + espaces + "Chambre"
    processed = processed.replace(/(\s)(0?\d{1,3}\s{2,}Chambre)/gi, '\n$2');
    
    // Pattern alternatif: après un statut suivi d'un numéro
    processed = processed.replace(/(Sale|Parti|Recouche|Arrivé|En arrivée|A contrôler|Dirty|Clean|Checkout|Arrival)\s+(0?\d{1,3}\s)/gi, '$1\n$2');
    
    // Pattern: Room/Ch suivi d'un numéro
    processed = processed.replace(/(Room|Ch\.?)\s*(\d+)/gi, '\n$1 $2');
    
    return processed;
  }

  extractRooms(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    // Pré-traitement pour séparer les chambres concaténées
    const preprocessedText = this.preprocessText(text);
    const lines = preprocessedText.split('\n');
    const seenRooms = new Map<string, ExtractedRoom[]>();

    // Patterns de dates à exclure
    const datePatterns = [
      /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
      /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,
      /\b\d{1,2}:\d{2}\b/g,
      /\b(19|20)\d{2}\b/g,
    ];

    for (const line of lines) {
      // Ignorer lignes d'en-tête ou de date
      if (this.isHeaderOrDateLine(line)) continue;
      
      // Nettoyer la ligne en remplaçant les dates par des espaces
      let cleanedLine = line;
      for (const pattern of datePatterns) {
        cleanedLine = cleanedLine.replace(pattern, ' ');
      }

      // Extraire les numéros de chambre potentiels
      const roomNumbers = this.extractRoomNumbers(cleanedLine);
      
      for (const roomNumber of roomNumbers) {
        // Vérifier que c'est un numéro de chambre valide
        if (!this.isValidRoomNumber(roomNumber, line)) continue;
        
        const { status, cleaning, keyword } = this.detectStatus(line);
        
        const debugInfo: ExtractionDebugInfo = {
          rawLine: line,
          cleanedLine: cleanedLine.trim(),
          detectedKeywords: keyword ? [keyword] : [],
          source: 'regex',
          confidence: status === 'unknown' ? 50 : 75
        };
        
        // Créer la chambre même si statut inconnu (sera "needs-cleaning" par défaut)
        const room: ExtractedRoom = {
          roomNumber,
          status: status === 'unknown' ? 'needs-cleaning' : status,
          cleaningType: status === 'unknown' ? 'full' : cleaning,
          originalText: line.trim(),
          validated: false,
          confidence: status === 'unknown' ? 50 : 75,
          debugInfo
        };

        if (!seenRooms.has(roomNumber)) {
          seenRooms.set(roomNumber, []);
        }
        seenRooms.get(roomNumber)!.push(room);
      }
    }

    // Appliquer les règles de combinaison et dédupliquer
    for (const [roomNumber, roomEntries] of seenRooms) {
      if (roomEntries.length > 1) {
        const combined = this.applyCombinationRules(roomEntries);
        rooms.push(combined);
      } else {
        rooms.push(roomEntries[0]);
      }
    }

    return rooms;
  }

  /**
   * Extrait les numéros de chambre d'une ligne nettoyée
   * Supporte: numériques (01, 101), alphanumériques (1A, R101), avec tirets (P-202)
   */
  private extractRoomNumbers(line: string): string[] {
    const numbers: string[] = [];
    
    // Regex universelle améliorée
    const regex = /(?<![\/\-\.\d:])(?:(?:Room|Ch\.?|Chambre|R|#)\s*)?([A-Z]?-?0*[1-9]\d{0,3}[A-Z]?)(?![\/\-\.\d:])/gi;
    
    let match;
    while ((match = regex.exec(line)) !== null) {
      const roomNum = match[1];
      
      // Normaliser: "05" → "5", "01" → "1" (seulement pour les purement numériques)
      const numMatch = roomNum.match(/^0*(\d+)$/);
      if (numMatch) {
        numbers.push(numMatch[1]);
      } else {
        // Garder le format pour les alphanumériques
        numbers.push(roomNum.replace(/^0+/, '') || roomNum);
      }
    }
    
    return [...new Set(numbers)]; // Dédupliquer
  }

  /**
   * Vérifie si un numéro est un numéro de chambre valide
   */
  protected isValidRoomNumber(num: string, originalLine: string): boolean {
    // Vérifier d'abord avec la méthode parente
    if (!super.isValidRoomNumber(num, originalLine)) return false;
    
    const n = parseInt(num, 10);
    
    // Pour les numéros purement numériques
    if (!isNaN(n)) {
      // Exclure les années
      if (n >= 1900 && n <= 2100) return false;
      
      // Les chambres sont généralement entre 1 et 9999
      if (n < 1 || n > 9999) return false;
    }
    
    return true;
  }

  /**
   * Détecte si une ligne est un en-tête ou contient principalement des dates
   */
  private isHeaderOrDateLine(line: string): boolean {
    const lowerLine = line.toLowerCase();
    
    // Mots-clés d'en-tête
    const headerKeywords = [
      'date', 'rapport', 'report', 'hôtel', 'hotel', 'page', 
      'total', 'généré', 'generated', 'imprimé', 'printed',
      'housekeeping', 'cleaning list', 'room list'
    ];
    
    if (headerKeywords.some(kw => lowerLine.includes(kw))) {
      // Vérifier si c'est vraiment un en-tête (pas beaucoup de chiffres)
      const digitCount = (line.match(/\d/g) || []).length;
      const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
      if (letterCount > digitCount * 2) return true;
    }
    
    return false;
  }
}
