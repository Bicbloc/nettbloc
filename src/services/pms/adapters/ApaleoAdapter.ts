/**
 * Adapter pour Apaleo PMS - Format "Space status" avec codes DIR/INS/OCC
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType, ExtractionDebugInfo } from '../types';

export class ApaleoAdapter extends PmsAdapter {
  readonly name = 'apaleo';
  
  // Mots-clés critiques (50+ points chacun)
  readonly criticalKeywords = [
    'APALEO', 
    'CLOUD PMS',
    'Space status',  // Format typique Apaleo
  ];
  
  // Mots-clés normaux (10 points chacun)
  readonly keywords = [
    'HOUSEKEEPING REPORT',
    'Floor', 'Spaces', 'Assignee',  // En-têtes Apaleo
    'DIR', 'INS', 'OCC', 'VAC', 'CLN',  // Codes statut Apaleo
    'TWS', 'SGL', 'DBS', 'DBL', 'TPL', 'QUAD',  // Codes type chambre
    'Night',  // Pattern séjour
    'Adults', 'adultes',
  ];

  readonly config: PmsConfig = {
    pmsType: 'apaleo',
    keywords: this.keywords,
    criticalKeywords: this.criticalKeywords,
    roomNumberRegex: '(?<![/\\-.:\\d])\\b(\\d{2,4})\\b(?![/\\-.:\\d])',
    statusMappings: {
      // Codes courts Apaleo
      // RÈGLE: "occupé et sale" ou "arrivé sale" = à blanc
      'DIR': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'INS': { status: 'inspected', cleaning: 'none', priority: 10 },
      'OCC': { status: 'occupied', cleaning: 'a_blanc', priority: 15 },  // Occupé sale = à blanc
      'VAC': { status: 'vacant', cleaning: 'a_blanc', priority: 18 },
      'CLN': { status: 'clean', cleaning: 'none', priority: 8 },
      'DIRTY': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'INSPECTED': { status: 'inspected', cleaning: 'none', priority: 10 },
      'OCCUPIED': { status: 'occupied', cleaning: 'a_blanc', priority: 15 },  // Occupé sale = à blanc
      'VACANT': { status: 'vacant', cleaning: 'a_blanc', priority: 18 },
      'CLEAN': { status: 'clean', cleaning: 'none', priority: 8 },
    },
    combinationRules: [],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy']
  };

  /**
   * Détecte si c'est le format "Space status" d'Apaleo
   */
  private isSpaceStatusFormat(text: string): boolean {
    return /Space\s+status/i.test(text) && /Floor\s+Spaces/i.test(text);
  }

  extractRooms(text: string): ExtractedRoom[] {
    console.log('🔍 ApaleoAdapter: Extraction démarrée');
    
    if (this.isSpaceStatusFormat(text)) {
      console.log('📊 Format Space Status détecté');
      return this.extractFromSpaceStatus(text);
    }
    
    // Fallback sur extraction générique
    return this.extractGeneric(text);
  }

  /**
   * Extraction depuis format "Space status"
   * Format: Floor  Spaces  Assignee
   *         1      101  TWS  DIR  Farid GAOUTARA
   */
  private extractFromSpaceStatus(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split(/\n|\r\n?/);
    
    // Pattern pour extraire: numéro chambre, type, statut, assigné
    // Ex: "101   TWS   DIR   Farid  GAOUTARA"
    const roomPattern = /\b(\d{2,4})\s+([A-Z]{2,4})\s+(DIR|INS|OCC|VAC|CLN)\s+(.+?)(?=\d{2}\/\d{2}\/\d{4}|$|\n)/i;
    
    // Pattern alternatif pour lignes avec dates intégrées
    // Ex: "102   SGL   DIR   Farid  GAOUTARA   04/05/2025   1 ×   Adults"
    const roomWithDatePattern = /\b(\d{2,4})\s+([A-Z]{2,4})\s+(DIR|INS|OCC|VAC|CLN)\s+([A-Za-z\s]+?)(?:\s+\d{2}\/\d{2}\/\d{4}|\s+Night|\s*$)/i;

    for (const line of lines) {
      if (!line || line.trim().length < 5) continue;
      if (this.isHeaderLine(line)) continue;
      
      let match = line.match(roomPattern) || line.match(roomWithDatePattern);
      
      // Pattern plus flexible pour lignes fragmentées
      if (!match) {
        const flexMatch = line.match(/\b(\d{2,4})\s+([A-Z]{2,4})\s+(DIR|INS|OCC|VAC|CLN)/i);
        if (flexMatch) {
          match = [flexMatch[0], flexMatch[1], flexMatch[2], flexMatch[3], ''];
        }
      }
      
      if (match) {
        const [, roomNumber, roomType, statusCode, assignee] = match;
        
        // Vérifier que c'est un numéro de chambre valide (pas une date/heure)
        const roomNum = parseInt(roomNumber, 10);
        if (this.isDateOrTime(roomNum, line)) continue;
        
        const { status, cleaning } = this.mapStatusCode(statusCode.toUpperCase());
        
        rooms.push({
          roomNumber: roomNumber,
          status,
          cleaningType: cleaning,
          roomType: this.mapRoomType(roomType),
          originalText: line.trim(),
          confidence: 90,
          debugInfo: {
            rawLine: line,
            cleanedLine: line.trim(),
            detectedKeywords: [statusCode, roomType],
            source: 'regex',
            confidence: 90
          }
        });
      }
    }
    
    // Si aucune chambre trouvée avec les patterns stricts, essayer extraction plus permissive
    if (rooms.length === 0) {
      console.log('⚠️ Aucune chambre avec pattern strict, essai permissif...');
      return this.extractPermissive(text);
    }
    
    console.log(`✅ ${rooms.length} chambres extraites (Space Status)`);
    return this.deduplicateRooms(rooms);
  }

  /**
   * Extraction permissive pour formats non standards
   */
  private extractPermissive(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const seenRooms = new Set<string>();
    
    // Chercher tous les patterns: nombre + statut connu
    const lines = text.split(/\n|\r\n?/);
    
    for (const line of lines) {
      if (!line || line.trim().length < 5) continue;
      if (this.isHeaderLine(line)) continue;
      
      // Pattern: numéro 3 chiffres suivi ou précédé de DIR/INS/OCC
      const matches = line.matchAll(/(\d{3})\s+[A-Z]{2,4}\s+(DIR|INS|OCC|VAC|CLN)|(DIR|INS|OCC|VAC|CLN)\s+(\d{3})/gi);
      
      for (const match of matches) {
        const roomNumber = match[1] || match[4];
        const statusCode = (match[2] || match[3] || '').toUpperCase();
        
        if (!roomNumber || seenRooms.has(roomNumber)) continue;
        
        const roomNum = parseInt(roomNumber, 10);
        if (this.isDateOrTime(roomNum, line)) continue;
        
        seenRooms.add(roomNumber);
        const { status, cleaning } = this.mapStatusCode(statusCode);
        
        rooms.push({
          roomNumber,
          status,
          cleaningType: cleaning,
          originalText: line.trim(),
          confidence: 75,
          debugInfo: {
            rawLine: line,
            cleanedLine: line.trim(),
            detectedKeywords: [statusCode],
            source: 'regex',
            confidence: 75
          }
        });
      }
    }
    
    console.log(`✅ ${rooms.length} chambres extraites (permissif)`);
    return rooms;
  }

  /**
   * Extraction générique fallback
   */
  private extractGeneric(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split(/\n|\r\n?/);
    
    for (const line of lines) {
      if (!line || line.trim().length < 5) continue;
      if (this.isHeaderLine(line)) continue;
      
      // Chercher numéros de chambre 3 chiffres avec statut
      const match = line.match(/\b(\d{3})\b.*?\b(DIR|INS|OCC|VAC|CLN|DIRTY|CLEAN|OCCUPIED)\b/i);
      if (match) {
        const [, roomNumber, statusCode] = match;
        const { status, cleaning } = this.mapStatusCode(statusCode.toUpperCase());
        
        rooms.push({
          roomNumber,
          status,
          cleaningType: cleaning,
          originalText: line.trim(),
          confidence: 70,
          debugInfo: {
            rawLine: line,
            cleanedLine: line.trim(),
            detectedKeywords: [statusCode],
            source: 'regex',
            confidence: 70
          }
        });
      }
    }
    
    return this.deduplicateRooms(rooms);
  }

  /**
   * Mappe un code de statut vers status/cleaning
   * RÈGLE: "occupé et sale" ou "arrivé sale" = à blanc (pas recouche)
   */
  private mapStatusCode(code: string): { status: string; cleaning: CleaningType } {
    const mapping = this.config.statusMappings[code];
    if (mapping) {
      return { status: mapping.status, cleaning: mapping.cleaning as CleaningType };
    }
    
    // Fallback basé sur le code
    switch (code) {
      case 'DIR':
      case 'DIRTY':
        return { status: 'dirty', cleaning: 'a_blanc' };
      case 'INS':
      case 'INSPECTED':
        return { status: 'inspected', cleaning: 'none' };
      case 'OCC':
      case 'OCCUPIED':
        // CORRECTION: Occupé = à blanc (chambre occupée et sale)
        return { status: 'occupied', cleaning: 'a_blanc' };
      case 'VAC':
      case 'VACANT':
        return { status: 'vacant', cleaning: 'a_blanc' };
      case 'CLN':
      case 'CLEAN':
        return { status: 'clean', cleaning: 'none' };
      default:
        return { status: 'unknown', cleaning: 'none' };
    }
  }

  /**
   * Mappe les codes de type de chambre
   */
  private mapRoomType(code: string): string {
    const types: Record<string, string> = {
      'TWS': 'Twin',
      'TW': 'Twin',
      'SGL': 'Single',
      'DBS': 'Double',
      'DBL': 'Double',
      'TPL': 'Triple',
      'QUAD': 'Quadruple',
      'STD': 'Standard',
    };
    return types[code.toUpperCase()] || code;
  }

  /**
   * Vérifie si un numéro est une date/année/heure
   */
  private isDateOrTime(num: number, originalLine: string): boolean {
    // Années
    if (num >= 1900 && num <= 2100) return true;
    
    // Vérifier si le numéro est dans un contexte de date
    const dateRegexes = [
      new RegExp(`\\b${num}[/\\-.:]\\d`),
      new RegExp(`\\d[/\\-.:]${num}\\b`),
      new RegExp(`\\b${num}\\s*×`),  // Pattern "1 × Adults"
    ];
    
    return dateRegexes.some(regex => regex.test(originalLine));
  }

  /**
   * Vérifie si une ligne est un en-tête
   */
  private isHeaderLine(line: string): boolean {
    const headerPatterns = [
      /^Space\s+status/i,
      /^Floor\s+Spaces/i,
      /^(date|room|chambre|status|statut|type)/i,
      /housekeeping\s*(report|list)/i,
      /^\s*(total|summary)/i,
      /page\s*\d+/i,
      /^Assignee\s*$/i,
    ];
    
    return headerPatterns.some(pattern => pattern.test(line.trim()));
  }

  /**
   * Déduplique les chambres en gardant la plus haute priorité
   */
  private deduplicateRooms(rooms: ExtractedRoom[]): ExtractedRoom[] {
    const roomsMap = new Map<string, ExtractedRoom>();
    
    for (const room of rooms) {
      const existing = roomsMap.get(room.roomNumber);
      if (!existing || (room.confidence || 0) > (existing.confidence || 0)) {
        roomsMap.set(room.roomNumber, room);
      }
    }
    
    return Array.from(roomsMap.values())
      .sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber));
  }
}
