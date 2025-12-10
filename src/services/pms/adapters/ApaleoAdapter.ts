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
   * Pré-traite le texte pour séparer les chambres concaténées (PDF copié)
   * Ex: "01   Chambre twin...Sale 02   Chambre triple" → lignes séparées
   */
  private preprocessText(text: string): string {
    let processed = text;
    
    // Pattern 1: Début de ligne ou après espace - numéro + "Chambre" (format tableau)
    processed = processed.replace(/(^|\s)(0?\d{1,2})\s+(Chambre\s+(?:twin|triple|double|simple|quadruple))/gim, '\n$2 $3');
    
    // Pattern 2: Après un statut (Sale, Parti, etc.) suivi d'un numéro de chambre
    processed = processed.replace(/(Sale|Parti|Recouche|Arrivé|En arrivée|A contrôler|Propre)\s+(0?\d{1,3})\s+(Chambre)/gi, '$1\n$2 $3');
    
    // Pattern 3: Format "Ch. NN" ou "Ch NN"
    processed = processed.replace(/(\s)(Ch\.?\s*)(0?\d{1,3})(\s+(?:Chambre|Type))/gi, '\n$2$3$4');
    
    // Pattern 4: Après info de facture ou référence, numéro de chambre
    processed = processed.replace(/(\))\s*(0?\d{1,2})\s+(Chambre)/gi, '$1\n$2 $3');
    
    // Pattern 5: Après code (NR, RO, BB, FLEX) suivi d'un numéro
    processed = processed.replace(/(NR|RO|BB|FLEX)\s+(0?\d{1,2})\s+(Chambre)/gi, '$1\n$2 $3');
    
    return processed;
  }

  /**
   * Extrait le premier numéro de chambre valide d'une ligne (format tableau Apaleo)
   */
  private extractFirstRoomNumber(line: string): string | null {
    // Pattern 1: Format tableau strict au début - "01 Chambre twin", "02 Chambre triple"
    const tableMatch = line.match(/^\s*(0?\d{1,2})\s+Chambre\s+(?:twin|triple|double|simple|quadruple|standard)/i);
    if (tableMatch) {
      return tableMatch[1];
    }
    
    // Pattern 2: Numéro + "Chambre" n'importe où dans la ligne (avec \b pour word boundary)
    const flexMatch = line.match(/\b(0?[1-9]\d?)\s+Chambre\s+(?:twin|triple|double|simple|quadruple|standard)/i);
    if (flexMatch) {
      return flexMatch[1];
    }
    
    // Pattern 3: Format "Ch. NN" ou "CH NN" 
    const chMatch = line.match(/\bCh\.?\s*(0?\d{1,3})\b/i);
    if (chMatch) {
      return chMatch[1];
    }
    
    // Pattern 4: Numéro suivi de type de chambre sans mot "Chambre"
    // Ex: "01 twin", "02 double"
    const shortMatch = line.match(/^\s*(0?\d{1,2})\s+(?:twin|triple|double|simple|quadruple|standard)\b/i);
    if (shortMatch) {
      return shortMatch[1];
    }
    
    return null;
  }

  /**
   * Détecte le statut dans une ligne, en cherchant n'importe où dans la ligne
   */
  private detectStatusInLine(line: string): { status: string; cleaning: CleaningType } {
    const upperLine = line.toUpperCase();
    
    // Priorité aux statuts les plus spécifiques
    const statusOrder = [
      { pattern: /\bPARTI\b/i, status: 'checkout', cleaning: 'full' as CleaningType },
      { pattern: /\bEN ARRIVÉE?\b/i, status: 'arrival', cleaning: 'full' as CleaningType },
      { pattern: /\bRECOUCHE\b/i, status: 'stayover', cleaning: 'quick' as CleaningType },
      { pattern: /\bARRIVÉ?\b/i, status: 'occupied', cleaning: 'none' as CleaningType },
      { pattern: /\bSALE\b/i, status: 'dirty', cleaning: 'full' as CleaningType },
      { pattern: /\bA CONTRÔLER\b|\bA CONTROLER\b/i, status: 'to_check', cleaning: 'none' as CleaningType },
      { pattern: /\bPROPRE\b/i, status: 'clean', cleaning: 'none' as CleaningType },
    ];
    
    for (const { pattern, status, cleaning } of statusOrder) {
      if (pattern.test(line)) {
        return { status, cleaning };
      }
    }
    
    return { status: 'unknown', cleaning: 'none' as CleaningType };
  }

  extractRooms(text: string): ExtractedRoom[] {
    // Pré-traitement pour séparer les chambres concaténées
    const preprocessedText = this.preprocessText(text);
    const lines = preprocessedText.split('\n');
    
    console.log(`🔍 [ApaleoAdapter] ${lines.length} lignes à analyser`);
    
    // DEBUG: Afficher les 20 premières lignes non-vides
    const nonEmptyLines = lines.filter(l => l.trim().length > 3).slice(0, 20);
    console.log('📝 [DEBUG] Premières lignes:');
    nonEmptyLines.forEach((l, i) => console.log(`  ${i}: "${l.substring(0, 100)}"`));
    
    // Map pour stocker les chambres avec leurs statuts (gère Parti + Arrivée)
    const roomsMap = new Map<string, { statuses: string[]; cleanings: CleaningType[]; originalText: string }>();
    
    // DEBUG: Compteurs pour diagnostic
    let skippedEmpty = 0;
    let skippedHeader = 0;
    let skippedNoRoom = 0;
    let skippedDate = 0;
    let skippedNoStatus = 0;

    for (const originalLine of lines) {
      // Ignorer les lignes vides ou trop courtes
      if (!originalLine || originalLine.trim().length < 3) {
        skippedEmpty++;
        continue;
      }
      
      // Ignorer les en-têtes et métadonnées
      if (this.isHeaderOrMetadataLine(originalLine)) {
        skippedHeader++;
        continue;
      }
      
      // Extraire le numéro de chambre (format tableau Apaleo)
      let roomNum = this.extractFirstRoomNumber(originalLine);
      let extractionMethod = 'main';
      
      // Fallback: chercher n'importe quel numéro suivi de "Chambre" dans la ligne
      if (!roomNum) {
        const fallbackMatch = originalLine.match(/\b(0?[1-9]\d?)\b.*Chambre/i);
        if (fallbackMatch) {
          roomNum = fallbackMatch[1];
          extractionMethod = 'fallback1';
        }
      }
      
      // Fallback 2: chercher un numéro 1-2 chiffres au début de la ligne
      if (!roomNum) {
        const startMatch = originalLine.match(/^\s*(0?[1-9]\d?)\s+/);
        if (startMatch && this.lineHasValidStatus(originalLine)) {
          roomNum = startMatch[1];
          extractionMethod = 'fallback2';
        }
      }
      
      if (!roomNum) {
        // DEBUG: Afficher les lignes contenant "Chambre" mais sans numéro extrait
        if (originalLine.toLowerCase().includes('chambre')) {
          console.log(`⚠️ [DEBUG] Ligne avec "Chambre" ignorée: "${originalLine.substring(0, 80)}..."`);
        }
        skippedNoRoom++;
        continue;
      }
      
      // Nettoyer le numéro (garder le format original pour l'affichage)
      const numValue = parseInt(roomNum, 10);
      
      // Filtrer les numéros invalides
      if (this.isDateOrTime(numValue, originalLine)) {
        console.log(`⏰ [DEBUG] Numéro ${roomNum} ignoré (date/heure) dans: "${originalLine.substring(0, 60)}..."`);
        skippedDate++;
        continue;
      }
      if (numValue < 1 || numValue > 999) {
        skippedDate++;
        continue;
      }
      
      // Utiliser le numéro normalisé comme clé (sans zéro initial)
      const roomKey = String(numValue);
      
      // Détecter le statut dans la ligne
      const statusInfo = this.detectStatusInLine(originalLine);
      if (statusInfo.status === 'unknown') {
        console.log(`❓ [DEBUG] Chambre ${roomNum} sans statut: "${originalLine.substring(0, 80)}..."`);
        skippedNoStatus++;
        continue;
      }
      
      // DEBUG: Log des chambres extraites
      console.log(`✅ [DEBUG] Chambre ${roomNum} (${extractionMethod}) → ${statusInfo.status}/${statusInfo.cleaning}`);
      
      // Ajouter ou mettre à jour la chambre
      if (roomsMap.has(roomKey)) {
        const existing = roomsMap.get(roomKey)!;
        existing.statuses.push(statusInfo.status);
        existing.cleanings.push(statusInfo.cleaning);
      } else {
        roomsMap.set(roomKey, {
          statuses: [statusInfo.status],
          cleanings: [statusInfo.cleaning],
          originalText: originalLine.trim()
        });
      }
    }
    
    console.log(`📊 [DEBUG] Stats: vides=${skippedEmpty}, headers=${skippedHeader}, noRoom=${skippedNoRoom}, date=${skippedDate}, noStatus=${skippedNoStatus}`);
    console.log(`📊 [DEBUG] Chambres uniques trouvées: ${roomsMap.size}`);

    // Convertir la map en tableau de chambres avec gestion des combinaisons
    const rooms: ExtractedRoom[] = [];
    
    for (const [roomNum, data] of roomsMap) {
      let finalStatus = data.statuses[0];
      let finalCleaning = data.cleanings[0];
      
      // Gérer les combinaisons (Parti + En arrivée = checkout_arrival)
      if (data.statuses.includes('checkout') && data.statuses.includes('arrival')) {
        finalStatus = 'checkout_arrival';
        finalCleaning = 'full';
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
        confidence: 85
      });
    }

    // Trier par numéro de chambre
    rooms.sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber));

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
