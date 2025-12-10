/**
 * Adapter pour Apaleo PMS - avec filtrage intelligent des dates
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType } from '../types';

export class ApaleoAdapter extends PmsAdapter {
  readonly name = 'apaleo';
  
  readonly keywords = [
    'APALEO', 'CLOUD PMS', 'HOUSEKEEPING REPORT',
    'Recouche', 'Parti', 'En arrivée', 'Arrivé', 'A contrôler', 'Propre'
  ];

  // Patterns de dates à exclure
  private readonly datePatterns = [
    /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g,  // 01/12/2024, 1-12-24
    /\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/g,    // 2024-12-01
    /\b\d{1,2}:\d{2}(:\d{2})?\b/g,               // 14:30, 14:30:00
  ];

  // Mots-clés de statut valides
  private readonly validStatusKeywords = [
    'RECOUCHE', 'PARTI', 'DEPART', 'DEPARTURE', 'CHECKOUT',
    'EN ARRIVEE', 'EN ARRIVÉE', 'ARRIVAL', 'ARRIVEE', 'ARRIVÉ', 'ARRIVE',
    'A CONTROLER', 'CONTROLER', 'PROPRE', 'CLEAN',
    'DIR', 'DIRTY', 'SALE', 'INS', 'INSPECTED', 'OCC', 'OCCUPIED',
    'STAYOVER', 'DUE OUT', 'DUE IN', 'VACANT', 'VD', 'VC', 'OD', 'OC'
  ];

  readonly config: PmsConfig = {
    pmsType: 'apaleo',
    keywords: this.keywords,
    // Accepte les chambres 01, 02, 06, 10, 101, etc. (1-4 chiffres avec zéros possibles)
    roomNumberRegex: '(?<![/\\-.:\\d])\\b(0?[1-9]\\d{0,3}|[1-9]\\d{0,3})\\b(?![/\\-.:\\d])',
    statusMappings: {
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'Recouche': { status: 'stayover', cleaning: 'quick', priority: 10 },
      'PARTI': { status: 'checkout', cleaning: 'full', priority: 20 },
      'Parti': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 20 },
      'DEPARTURE': { status: 'checkout', cleaning: 'full', priority: 20 },
      'CHECKOUT': { status: 'checkout', cleaning: 'full', priority: 20 },
      'EN ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'EN ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVAL': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 15 },
      'ARRIVÉ': { status: 'occupied', cleaning: 'none', priority: 5 },
      'ARRIVE': { status: 'occupied', cleaning: 'none', priority: 5 },
      'A CONTROLER': { status: 'clean', cleaning: 'none', priority: 8 },
      'CONTROLER': { status: 'clean', cleaning: 'none', priority: 8 },
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'DIR': { status: 'dirty', cleaning: 'full', priority: 18 },
      'DIRTY': { status: 'dirty', cleaning: 'full', priority: 18 },
      'SALE': { status: 'dirty', cleaning: 'full', priority: 18 },
      'INS': { status: 'inspected', cleaning: 'none', priority: 7 },
      'INSPECTED': { status: 'inspected', cleaning: 'none', priority: 7 },
      'OCC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
    },
    combinationRules: [
      { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['PARTI', 'EN ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['arrival', 'clean'], result: { status: 'clean', cleaning: 'none' } },
      { conditions: ['EN ARRIVEE', 'A CONTROLER'], result: { status: 'clean', cleaning: 'none' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy', 'dd.MM.yyyy', 'dd-MM-yyyy']
  };

  /**
   * Nettoie une ligne en supprimant les dates et heures
   */
  private cleanLineFromDates(line: string): string {
    let cleaned = line;
    for (const pattern of this.datePatterns) {
      cleaned = cleaned.replace(new RegExp(pattern.source, 'g'), ' ');
    }
    return cleaned;
  }

  /**
   * Vérifie si une ligne contient un statut valide
   */
  private lineHasValidStatus(line: string): boolean {
    const upperLine = line.toUpperCase();
    return this.validStatusKeywords.some(keyword => upperLine.includes(keyword));
  }

  /**
   * Vérifie si un numéro est une date/année/heure
   */
  private isDateOrTime(num: number, originalLine: string): boolean {
    // Années
    if (num >= 1900 && num <= 2100) return true;
    
    // Vérifier si le numéro fait partie d'une date dans la ligne originale
    const dateRegexes = [
      new RegExp(`\\b${num}[/\\-.:]\\d`),
      new RegExp(`\\d[/\\-.:]${num}\\b`),
    ];
    
    return dateRegexes.some(regex => regex.test(originalLine));
  }

  /**
   * Vérifie si une ligne est un en-tête ou une ligne de métadonnées
   */
  private isHeaderOrMetadataLine(line: string): boolean {
    const headerPatterns = [
      /^(date|room|chambre|status|statut|type|floor|étage|guest|client|name|nom|report|rapport)/i,
      /housekeeping\s*(report|list)/i,
      /^\s*(total|summary|résumé)/i,
      /page\s*\d+/i,
      /^\s*\d+\s*\/\s*\d+\s*$/,  // Pagination like 1/5
    ];
    
    return headerPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Extraction spécifique pour Apaleo avec filtrage amélioré
   */
  /**
   * Pré-traite le texte pour séparer les chambres concaténées (PDF copié)
   * Ex: "01   Chambre twin...Sale 02   Chambre triple" → lignes séparées
   */
  private preprocessText(text: string): string {
    // Pattern: espace(s) + numéro de chambre (01-999) + espaces + "Chambre"
    // Insère un retour à la ligne avant chaque entrée de chambre
    let processed = text.replace(/(\s)(0?\d{1,3}\s{2,}Chambre)/gi, '\n$2');
    
    // Pattern alternatif: après un statut (Sale, Parti, etc.) suivi d'un numéro
    processed = processed.replace(/(Sale|Parti|Recouche|Arrivé|En arrivée|A contrôler)\s+(0?\d{1,3}\s{2,}Chambre)/gi, '$1\n$2');
    
    return processed;
  }

  extractRooms(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    // Pré-traitement pour séparer les chambres concaténées
    const preprocessedText = this.preprocessText(text);
    const lines = preprocessedText.split('\n');
    const seenRooms = new Set<string>();
    
    // Regex pour extraire les numéros de chambre (avec zéros initiaux possibles: 01, 02, 06, 10, etc.)
    const roomRegex = /(?<![/\-.:\d])\b(0*[1-9]\d{0,3})\b(?![/\-.:\d])/g;

    for (const originalLine of lines) {
      // Ignorer les lignes vides ou trop courtes
      if (!originalLine || originalLine.trim().length < 3) continue;
      
      // Ignorer les en-têtes et métadonnées
      if (this.isHeaderOrMetadataLine(originalLine)) continue;
      
      // La ligne doit contenir un statut valide
      if (!this.lineHasValidStatus(originalLine)) continue;
      
      // Nettoyer la ligne des dates pour l'extraction
      const cleanedLine = this.cleanLineFromDates(originalLine);
      
      // Détecter le statut
      const statusInfo = this.detectStatus(originalLine);
      if (!statusInfo || statusInfo.status === 'unknown') continue;
      
      // Extraire les numéros de la ligne nettoyée
      let match;
      const lineRoomRegex = new RegExp(roomRegex.source, 'g');
      
      while ((match = lineRoomRegex.exec(cleanedLine)) !== null) {
        const roomNum = match[1];
        const numValue = parseInt(roomNum, 10);
        
        // Filtrer les numéros invalides
        if (this.isDateOrTime(numValue, originalLine)) continue;
        
        // Éviter les doublons
        if (seenRooms.has(roomNum)) continue;
        seenRooms.add(roomNum);
        
        rooms.push({
          roomNumber: roomNum,
          status: statusInfo.status,
          cleaningType: statusInfo.cleaning as CleaningType,
          originalText: originalLine.trim(),
          confidence: 0.85
        });
      }
    }

    // Détecter les chambres communicantes
    return this.detectConnectedRooms(rooms, text);
  }

  /**
   * Détection des chambres communicantes
   */
  private detectConnectedRooms(rooms: ExtractedRoom[], text: string): ExtractedRoom[] {
    const connectedPatterns = [
      /(\d{2,4})\s*[-–—]\s*(\d{2,4})/g,
      /(\d{2,4})\s*[+&]\s*(\d{2,4})/g,
      /(\d{2,4})\s*\/\s*(\d{2,4})/g,
      /(\d{2,4})\s*et\s*(\d{2,4})/gi,
    ];

    for (const pattern of connectedPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, room1, room2] = match;
        
        const r1 = rooms.find(r => r.roomNumber === room1);
        const r2 = rooms.find(r => r.roomNumber === room2);
        
        if (r1) {
          r1.isConnected = true;
          r1.linkedRooms = [...(r1.linkedRooms || []), room2];
        }
        if (r2) {
          r2.isConnected = true;
          r2.linkedRooms = [...(r2.linkedRooms || []), room1];
        }
      }
    }

    return rooms;
  }
}
