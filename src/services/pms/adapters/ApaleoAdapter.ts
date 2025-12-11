/**
 * Adapter pour Apaleo PMS - Optimisé avec scoring pondéré
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType, ExtractionDebugInfo } from '../types';

export class ApaleoAdapter extends PmsAdapter {
  readonly name = 'apaleo';
  
  // Mots-clés critiques (50+ points chacun)
  readonly criticalKeywords = [
    'APALEO', 
    'CLOUD PMS'
  ];
  
  // Mots-clés normaux (10 points chacun)
  readonly keywords = [
    'HOUSEKEEPING REPORT',
    'Recouche', 'Parti', 'En arrivée', 'Arrivé', 
    'A contrôler', 'Propre', 'Chambre twin', 'Chambre triple'
  ];

  // Patterns de dates à exclure
  private readonly datePatterns = [
    /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g,
    /\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/g,
    /\b\d{1,2}:\d{2}(:\d{2})?\b/g,
  ];

  readonly config: PmsConfig = {
    pmsType: 'apaleo',
    keywords: this.keywords,
    criticalKeywords: this.criticalKeywords,
    // Regex pour chambres 1-999 avec zéros optionnels
    roomNumberRegex: '(?<![/\\-.:\\d])\\b(0?[1-9]\\d{0,2})\\b(?![/\\-.:\\d])',
    statusMappings: {
      'RECOUCHE': { status: 'stayover', cleaning: 'recouche', priority: 10 },
      'Recouche': { status: 'stayover', cleaning: 'recouche', priority: 10 },
      'PARTI': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'Parti': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'DEPART': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'DEPARTURE': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'CHECKOUT': { status: 'checkout', cleaning: 'a_blanc', priority: 20 },
      'EN ARRIVEE': { status: 'arrival', cleaning: 'a_blanc', priority: 15 },
      'EN ARRIVÉE': { status: 'arrival', cleaning: 'a_blanc', priority: 15 },
      'ARRIVAL': { status: 'arrival', cleaning: 'a_blanc', priority: 15 },
      'ARRIVEE': { status: 'arrival', cleaning: 'a_blanc', priority: 15 },
      'ARRIVÉ': { status: 'occupied', cleaning: 'none', priority: 5 },
      'ARRIVE': { status: 'occupied', cleaning: 'none', priority: 5 },
      'A CONTROLER': { status: 'to_check', cleaning: 'none', priority: 8 },
      'A CONTRÔLER': { status: 'to_check', cleaning: 'none', priority: 8 },
      'CONTROLER': { status: 'to_check', cleaning: 'none', priority: 8 },
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
      'DIR': { status: 'dirty', cleaning: 'a_blanc', priority: 18 },
      'DIRTY': { status: 'dirty', cleaning: 'a_blanc', priority: 18 },
      'SALE': { status: 'dirty', cleaning: 'a_blanc', priority: 18 },
      'INS': { status: 'inspected', cleaning: 'none', priority: 7 },
      'INSPECTED': { status: 'inspected', cleaning: 'none', priority: 7 },
      'OCC': { status: 'occupied', cleaning: 'none', priority: 5 },
      'OCCUPIED': { status: 'occupied', cleaning: 'none', priority: 5 },
    },
    combinationRules: [
      { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      { conditions: ['PARTI', 'EN ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      { conditions: ['arrival', 'clean'], result: { status: 'clean', cleaning: 'none' } },
      { conditions: ['EN ARRIVEE', 'A CONTROLER'], result: { status: 'clean', cleaning: 'none' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy', 'dd.MM.yyyy', 'dd-MM-yyyy']
  };

  /**
   * Pré-traite le texte pour séparer les chambres concaténées
   */
  private preprocessText(text: string): string {
    let processed = text;
    
    // Pattern 1: Numéro + "Chambre" (format tableau)
    processed = processed.replace(/(^|\s)(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple|standard))/gim, '\n$2 $3');
    
    // Pattern 2: Après un statut suivi d'un numéro
    processed = processed.replace(/(Sale|Parti|Recouche|Arrivé|En arrivée|A contrôler|Propre)\s+(0?\d{1,3})\s+(Chambre)/gi, '$1\n$2 $3');
    
    // Pattern 3: Format "Ch. NN"
    processed = processed.replace(/(Ch\.?\s*)(0?\d{1,3})(\s+(?:Chambre|Type))/gi, '\n$1$2$3');
    
    // Pattern 4: Après info de facture
    processed = processed.replace(/(\))\s*(0?\d{1,2})\s+(Chambre)/gi, '$1\n$2 $3');
    
    // Pattern 5: Après code (NR, RO, BB, FLEX)
    processed = processed.replace(/(NR|RO|BB|FLEX)\s+(0?\d{1,2})\s+(Chambre)/gi, '$1\n$2 $3');
    
    return processed;
  }

  /**
   * Extrait le premier numéro de chambre valide d'une ligne (format tableau Apaleo)
   */
  private extractApaleoRoomNumber(line: string): string | null {
    // Pattern 1: Format tableau strict "01 Chambre twin"
    const tableMatch = line.match(/^\s*(0?\d{1,2})\s+Chambre\s+(?:twin|triple|double|simple|quadruple|standard)/i);
    if (tableMatch) return tableMatch[1];
    
    // Pattern 2: Numéro + "Chambre" flexible
    const flexMatch = line.match(/\b(0?[1-9]\d?)\s+Chambre\s+(?:twin|triple|double|simple|quadruple|standard)/i);
    if (flexMatch) return flexMatch[1];
    
    // Pattern 3: Format "Ch. NN"
    const chMatch = line.match(/\bCh\.?\s*(0?\d{1,3})\b/i);
    if (chMatch) return chMatch[1];
    
    // Pattern 4: Numéro + type sans "Chambre"
    const shortMatch = line.match(/^\s*(0?\d{1,2})\s+(?:twin|triple|double|simple|quadruple|standard)\b/i);
    if (shortMatch) return shortMatch[1];
    
    return null;
  }

  /**
   * Vérifie si la ligne contient un statut valide Apaleo
   */
  private hasValidApaleoStatus(line: string): boolean {
    const upperLine = line.toUpperCase();
    const validStatuses = [
      'RECOUCHE', 'PARTI', 'DEPART', 'CHECKOUT',
      'EN ARRIVEE', 'EN ARRIVÉE', 'ARRIVAL', 'ARRIVEE', 'ARRIVÉ',
      'A CONTROLER', 'A CONTRÔLER', 'PROPRE', 'CLEAN',
      'DIR', 'DIRTY', 'SALE', 'INS', 'OCC', 'OCCUPIED'
    ];
    return validStatuses.some(s => upperLine.includes(s));
  }

  extractRooms(text: string): ExtractedRoom[] {
    // Pré-traitement
    const preprocessedText = this.preprocessText(text);
    const lines = preprocessedText.split('\n');
    
    // Map pour gérer les chambres avec multiples statuts
    const roomsMap = new Map<string, { statuses: string[]; cleanings: CleaningType[]; originalText: string; debugInfo: ExtractionDebugInfo }>();

    for (const originalLine of lines) {
      if (!originalLine || originalLine.trim().length < 3) continue;
      if (this.isHeaderLine(originalLine)) continue;
      
      // Extraire le numéro de chambre (format Apaleo spécifique)
      let roomNum = this.extractApaleoRoomNumber(originalLine);
      
      // Fallback: chercher pattern générique avec statut valide
      if (!roomNum) {
        const fallbackMatch = originalLine.match(/\b(0?[1-9]\d?)\b.*Chambre/i);
        if (fallbackMatch && this.hasValidApaleoStatus(originalLine)) {
          roomNum = fallbackMatch[1];
        }
      }
      
      // Fallback 2: numéro au début de ligne avec statut valide
      if (!roomNum) {
        const startMatch = originalLine.match(/^\s*(0?[1-9]\d?)\s+/);
        if (startMatch && this.hasValidApaleoStatus(originalLine)) {
          roomNum = startMatch[1];
        }
      }
      
      if (!roomNum) continue;
      
      // Normaliser le numéro
      const numValue = parseInt(roomNum, 10);
      if (this.isDateOrTime(numValue, originalLine)) continue;
      if (numValue < 1 || numValue > 999) continue;
      
      const roomKey = String(numValue);
      
      // Détecter le statut
      const { status, cleaning, keyword } = this.detectStatus(originalLine);
      if (status === 'unknown') continue;
      
      const debugInfo: ExtractionDebugInfo = {
        rawLine: originalLine,
        cleanedLine: originalLine.trim(),
        detectedKeywords: keyword ? [keyword] : [],
        source: 'regex',
        confidence: 85
      };
      
      // Ajouter ou mettre à jour
      if (roomsMap.has(roomKey)) {
        const existing = roomsMap.get(roomKey)!;
        existing.statuses.push(status);
        existing.cleanings.push(cleaning);
      } else {
        roomsMap.set(roomKey, {
          statuses: [status],
          cleanings: [cleaning],
          originalText: originalLine.trim(),
          debugInfo
        });
      }
    }

    // Convertir en tableau avec gestion des combinaisons
    const rooms: ExtractedRoom[] = [];
    
    for (const [roomNum, data] of roomsMap) {
      let finalStatus = data.statuses[0];
      let finalCleaning = data.cleanings[0];
      let appliedRule = '';
      
      // Gérer les combinaisons
      if (data.statuses.includes('checkout') && data.statuses.includes('arrival')) {
        finalStatus = 'checkout_arrival';
        finalCleaning = 'full';
        appliedRule = 'Combination: checkout + arrival';
      } else if (data.statuses.length > 1) {
        // Prendre le statut avec le nettoyage le plus important
        const cleaningPriority = { 'full': 3, 'quick': 2, 'none': 1 };
        let maxPriority = 0;
        for (let i = 0; i < data.statuses.length; i++) {
          const priority = cleaningPriority[data.cleanings[i]] || 0;
          if (priority > maxPriority) {
            maxPriority = priority;
            finalStatus = data.statuses[i];
            finalCleaning = data.cleanings[i];
          }
        }
      }
      
      rooms.push({
        roomNumber: roomNum,
        status: finalStatus,
        cleaningType: finalCleaning,
        originalText: data.originalText,
        confidence: 85,
        debugInfo: {
          ...data.debugInfo,
          appliedRule,
          confidence: 85
        }
      });
    }

    // Trier par numéro
    rooms.sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber));

    // Détecter les chambres communicantes
    return this.detectConnectedRooms(rooms, text);
  }

  /**
   * Vérifie si un numéro est une date/année/heure
   */
  private isDateOrTime(num: number, originalLine: string): boolean {
    if (num >= 1900 && num <= 2100) return true;
    
    const dateRegexes = [
      new RegExp(`\\b${num}[/\\-.:]\\d`),
      new RegExp(`\\d[/\\-.:]${num}\\b`),
    ];
    
    return dateRegexes.some(regex => regex.test(originalLine));
  }

  /**
   * Vérifie si une ligne est un en-tête
   */
  private isHeaderLine(line: string): boolean {
    const headerPatterns = [
      /^(date|room|chambre|status|statut|type|floor|étage|guest|client|name|nom|report|rapport)/i,
      /housekeeping\s*(report|list)/i,
      /^\s*(total|summary|résumé)/i,
      /page\s*\d+/i,
    ];
    
    return headerPatterns.some(pattern => pattern.test(line));
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
