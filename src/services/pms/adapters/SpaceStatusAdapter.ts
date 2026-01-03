import { PmsAdapter } from '../PmsAdapter';
import { ExtractedRoom, CleaningType, normalizeCleaningType, PmsDetectionResult, PmsConfig } from '../types';

/**
 * SpaceStatusAdapter - Adapter pour le format "Space status" utilisé par Apaleo et d'autres PMS
 * 
 * Format typique:
 * Floor   Spaces   Assignee
 * 1  101   TWS   DIR   Farid  GAOUTARA
 *    102   SGL   DIR   Farid  GAOUTARA   04/05/2025   1 ×   Adults   Guest Name   , Night 3/3   07/05/2025
 */
export class SpaceStatusAdapter extends PmsAdapter {
  readonly name = 'space_status';
  
  readonly criticalKeywords = [
    'Space status',
    'Floor   Spaces',
    'Spaces   Assignee'
  ];
  
  readonly keywords = [
    'Space status',
    'SGL', 'DBL', 'DBS', 'TWS', 'JSU', 'TRP', 'QUA', 'SUI', 'APT',
    'DIR', 'INS', 'SAL', 'OOO', 'OOS',
    'Night', 'Nuit',
    'Adults', 'Children', 'Extra beds',
    'Out of order', 'Cleaning'
  ];

  readonly config: PmsConfig = {
    pmsType: 'space_status',
    roomNumberRegex: '\\b(\\d{1,4}[A-Z]?|[A-Z]\\d{1,4})\\b',
    keywords: this.keywords,
    statusMappings: {
      'DIR': { status: 'dirty', cleaning: 'a_blanc' as CleaningType },
      'INS': { status: 'clean', cleaning: 'none' as CleaningType },
      'SAL': { status: 'dirty', cleaning: 'a_blanc' as CleaningType },
    },
    combinationRules: [],
    dateFormats: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
  };

  private readonly ROOM_LINE_PATTERN = /\b(\d{1,4}[A-Z]?)\s+(SGL|DBL|DBS|TWS|JSU|TRP|QUA|SUI|APT|STU)\s+(DIR|INS|SAL|OOO|OOS)?/i;
  private readonly FLOOR_PREFIX_PATTERN = /^\s*(\d{1,2})\s+(\d{2,4})\s+(SGL|DBL|DBS|TWS|JSU|TRP|QUA|SUI|APT|STU)/i;
  private readonly NIGHT_PATTERN = /(?:Night|Nuit|Nacht|Notte|Noche)\s*(\d+)\s*[\/\\]\s*(\d+)/i;
  private readonly GUEST_BLOCK_PATTERN = /(\d+)\s*[×x]\s*(?:Adults?|Adultes?|Erwachsene)/gi;
  private readonly OOO_PATTERN = /Out of (?:order|service)/i;

  extractRooms(text: string): ExtractedRoom[] {
    const lines = text.split('\n');
    const rooms: ExtractedRoom[] = [];
    let currentFloor = 0;
    const seenRooms = new Set<string>();

    for (const line of lines) {
      if (!line.trim() || this.isHeaderLine(line)) continue;

      const floorMatch = line.match(this.FLOOR_PREFIX_PATTERN);
      if (floorMatch) {
        currentFloor = parseInt(floorMatch[1]);
      }

      const roomData = this.extractRoomFromLine(line, currentFloor);
      
      if (roomData && !seenRooms.has(roomData.roomNumber)) {
        seenRooms.add(roomData.roomNumber);
        rooms.push(roomData);
      }
    }

    console.log(`[SpaceStatusAdapter] Extracted ${rooms.length} rooms`);
    return rooms;
  }

  private isHeaderLine(line: string): boolean {
    const headerPatterns = [/Floor\s+Spaces/i, /Spaces\s+Assignee/i, /Space status/i, /^\s*Floor\s*$/i];
    return headerPatterns.some(p => p.test(line));
  }

  private extractRoomFromLine(line: string, currentFloor: number): ExtractedRoom | null {
    const match = line.match(this.ROOM_LINE_PATTERN);
    if (!match) return null;

    const roomNumber = match[1];
    const roomType = match[2].toUpperCase();
    const statusCode = (match[3] || 'DIR').toUpperCase();

    const numValue = parseInt(roomNumber);
    if (numValue < 10 && !line.match(new RegExp(`\\b${roomNumber}\\s+(SGL|DBL|DBS|TWS|JSU|TRP|QUA|SUI|APT|STU)`, 'i'))) {
      return null;
    }

    const nightMatch = line.match(this.NIGHT_PATTERN);
    let nightCurrent = 0, nightTotal = 0;
    if (nightMatch) {
      nightCurrent = parseInt(nightMatch[1]);
      nightTotal = parseInt(nightMatch[2]);
    }

    const guestBlocks = (line.match(this.GUEST_BLOCK_PATTERN) || []).length;
    const isOutOfOrder = this.OOO_PATTERN.test(line);

    const { status, cleaningType } = this.resolveStatusAndCleaning(statusCode, nightCurrent, nightTotal, guestBlocks, isOutOfOrder);
    const floor = currentFloor || this.inferFloor(roomNumber);

    return {
      roomNumber,
      status,
      cleaningType,
      confidence: this.calculateConfidence(line, statusCode, nightMatch !== null),
    };
  }

  private resolveStatusAndCleaning(
    statusCode: string, nightCurrent: number, nightTotal: number, guestBlocks: number, isOutOfOrder: boolean
  ): { status: string; cleaningType: CleaningType } {
    if (isOutOfOrder) return { status: 'out_of_order', cleaningType: 'none' };
    if (statusCode === 'INS') return { status: 'clean', cleaningType: 'none' };

    if (statusCode === 'DIR' || statusCode === 'SAL') {
      // Vérifier checkout/checkin (2 blocs de guests avec horaires)
      if (guestBlocks >= 2) return { status: 'checkout_checkin', cleaningType: 'a_blanc' };
      
      // Si info de nuit disponible
      if (nightTotal > 0) {
        // CORRECTION: "Dernière nuit" (X/X) = client ENCORE présent cette nuit = RECOUCHE
        // "Nuit intermédiaire" (X < Y) = client présent = RECOUCHE
        // Dans les DEUX cas, c'est RECOUCHE car le client dort encore cette nuit
        return { status: 'stayover', cleaningType: 'recouche' };
      }
      
      // Sans info de nuit, c'est une chambre sale à nettoyer à blanc
      return { status: 'dirty', cleaningType: 'a_blanc' };
    }

    if (statusCode === 'OOO' || statusCode === 'OOS') return { status: 'out_of_order', cleaningType: 'none' };
    return { status: 'unknown', cleaningType: 'a_blanc' };
  }

  private inferFloor(roomNumber: string): number {
    const num = parseInt(roomNumber);
    if (isNaN(num)) return 0;
    if (num >= 100 && num < 1000) return Math.floor(num / 100);
    return 0;
  }

  private calculateConfidence(line: string, statusCode: string, hasNightInfo: boolean): number {
    let confidence = 0.7;
    if (['DIR', 'INS', 'SAL', 'OOO', 'OOS'].includes(statusCode)) confidence += 0.1;
    if (hasNightInfo) confidence += 0.1;
    if (/Adults|Adultes|Guest/i.test(line)) confidence += 0.05;
    return Math.min(confidence, 1.0);
  }

  detect(text: string): PmsDetectionResult {
    const matchedKeywords: string[] = [];
    const criticalKeywordsMatched: string[] = [];
    let score = 0;

    const lower = text.toLowerCase();

    for (const keyword of this.criticalKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        criticalKeywordsMatched.push(keyword);
        score += 50; // Aligné sur PmsAdapter: 50 pts par mot-clé critique
      }
    }

    for (const keyword of this.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        score += 10; // Aligné sur PmsAdapter: 10 pts par mot-clé normal
      }
    }

    // Bonus si pattern de ligne de chambre détecté
    if (text.match(this.ROOM_LINE_PATTERN)) score += 20;

    const confidence = Math.min(score, 100);
    return { 
      pmsType: this.name, 
      confidence, 
      matchedKeywords, 
      criticalKeywordsMatched, 
      score 
    };
  }
}

