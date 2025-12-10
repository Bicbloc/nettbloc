/**
 * Adapter générique pour PMS inconnus
 * Utilise des patterns communs pour extraire les données
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType } from '../types';

export class GenericAdapter extends PmsAdapter {
  readonly name = 'generic';
  
  readonly keywords: string[] = [];

  readonly config: PmsConfig = {
    pmsType: 'generic',
    keywords: [],
    // Regex amélioré: chambres avec zéros initiaux (01, 02, 06, 10, 101, etc.)
    roomNumberRegex: '(?<![/\\-\\.\\d])\\b(0*[1-9]\\d{0,3})\\b(?![/\\-\\.\\d])',
    statusMappings: {
      // Français
      'SALE': { status: 'dirty', cleaning: 'full', priority: 20 },
      'DIRTY': { status: 'dirty', cleaning: 'full', priority: 20 },
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'OCCUPÉ': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPE': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 20 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      'ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVAL': { status: 'arrival', cleaning: 'full', priority: 15 },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'STAYOVER': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'LIBRE': { status: 'vacant', cleaning: 'full', priority: 15 },
      'VACANT': { status: 'vacant', cleaning: 'full', priority: 15 },
      'HS': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'HORS SERVICE': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none', priority: 25 },
    },
    combinationRules: [
      { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy', 'yyyy-MM-dd']
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
   * Extraction avec filtrage intelligent des faux positifs
   */
  /**
   * Pré-traite le texte pour séparer les chambres concaténées (PDF copié)
   */
  private preprocessText(text: string): string {
    // Pattern: espace(s) + numéro de chambre (01-999) + espaces + "Chambre"
    let processed = text.replace(/(\s)(0?\d{1,3}\s{2,}Chambre)/gi, '\n$2');
    
    // Pattern alternatif: après un statut suivi d'un numéro
    processed = processed.replace(/(Sale|Parti|Recouche|Arrivé|En arrivée|A contrôler|Dirty|Clean|Checkout|Arrival)\s+(0?\d{1,3}\s)/gi, '$1\n$2');
    
    return processed;
  }

  extractRooms(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    // Pré-traitement pour séparer les chambres concaténées
    const preprocessedText = this.preprocessText(text);
    const lines = preprocessedText.split('\n');
    const seenRooms = new Map<string, ExtractedRoom[]>();

    // Patterns à exclure (dates, années, heures, etc.)
    const datePatterns = [
      /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,  // 12/01/2024
      /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,    // 2024-01-12
      /\b\d{1,2}:\d{2}\b/g,                           // 14:30
      /\b(19|20)\d{2}\b/g,                            // années 1900-2099
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
        
        const { status, cleaning } = this.detectStatus(line);
        
        // Ignorer si aucun statut détecté (probablement pas une ligne de chambre)
        if (status === 'unknown') continue;
        
        const room: ExtractedRoom = {
          roomNumber,
          status,
          cleaningType: cleaning,
          originalText: line.trim(),
          validated: false,
          confidence: 75
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
   */
  private extractRoomNumbers(line: string): string[] {
    const numbers: string[] = [];
    // Pattern: numéro avec zéros initiaux possibles (01, 02, 06, 10, 101, etc.)
    const regex = /(?<![\/\-\.\d])\b(0*[1-9]\d{0,3})\b(?![\/\-\.\d])/g;
    
    let match;
    while ((match = regex.exec(line)) !== null) {
      numbers.push(match[1]);
    }
    
    return numbers;
  }

  /**
   * Vérifie si un numéro est un numéro de chambre valide
   */
  private isValidRoomNumber(num: string, originalLine: string): boolean {
    const n = parseInt(num, 10);
    
    // Exclure les années
    if (n >= 1900 && n <= 2100) return false;
    
    // Exclure les heures (combinées avec :)
    if (originalLine.includes(num + ':') || originalLine.includes(':' + num)) return false;
    
    // Exclure si fait partie d'une date (DD/MM ou MM/DD)
    const dateContext = new RegExp(`\\b${num}[\/\\-\\.]\\d|\\d[\/\\-\\.]${num}\\b`);
    if (dateContext.test(originalLine)) return false;
    
    // Les chambres sont généralement entre 1 et 9999
    if (n < 1 || n > 9999) return false;
    
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
      'total', 'généré', 'generated', 'imprimé', 'printed'
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
