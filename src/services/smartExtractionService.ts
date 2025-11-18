import { supabase } from "@/integrations/supabase/client";

export interface PmsPattern {
  pms_type: string;
  room_number_regex: string;
  status_keywords: Record<string, { status: string; cleaning: 'full' | 'quick' | 'none' }>;
  date_formats: string[];
  context_window: number;
  priority: number;
}

export interface ExtractedRoom {
  roomNumber: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  cleaningType: 'full' | 'quick' | 'none';
  validated: boolean;
  confidence?: number;
}

// Patterns par défaut pour les PMS connus
const DEFAULT_PATTERNS: Record<string, PmsPattern> = {
  apaleo: {
    pms_type: 'apaleo',
    room_number_regex: '\\b([1-9]\\d{2})\\b',
    status_keywords: {
      'DIR': { status: 'dirty', cleaning: 'full' },
      'INS': { status: 'inspected', cleaning: 'none' },
      'OCC': { status: 'occupied', cleaning: 'none' },
      'CLEANING': { status: 'to-clean', cleaning: 'full' },
      'DEPART': { status: 'checkout', cleaning: 'full' },
      'PARTI': { status: 'checkout', cleaning: 'full' },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick' },
      'SALE': { status: 'dirty', cleaning: 'full' },
      'EN ARRIVEE': { status: 'arrival', cleaning: 'full' }
    },
    date_formats: ['dd/MM/yyyy', 'dd/MM/yy'],
    context_window: 300,
    priority: 1
  },
  medialog: {
    pms_type: 'medialog',
    room_number_regex: '\\b([1-9]\\d{1,2})\\b',
    status_keywords: {
      'DRAPS': { status: 'change-sheets', cleaning: 'full' },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick' },
      'BLANC': { status: 'dirty', cleaning: 'full' },
      'NE PAS NETTOYER': { status: 'occupied', cleaning: 'none' },
      'DEPART': { status: 'checkout', cleaning: 'full' }
    },
    date_formats: ['dd/MM/yyyy'],
    context_window: 250,
    priority: 2
  },
  space: {
    pms_type: 'space',
    room_number_regex: '\\b([1-9]\\d{2})\\b',
    status_keywords: {
      'Dirty': { status: 'dirty', cleaning: 'full' },
      'Clean': { status: 'clean', cleaning: 'none' },
      'Inspected': { status: 'inspected', cleaning: 'none' },
      'Out of Order': { status: 'out-of-order', cleaning: 'none' },
      'Occupied': { status: 'occupied', cleaning: 'none' }
    },
    date_formats: ['dd/MM/yyyy', 'yyyy-MM-dd'],
    context_window: 300,
    priority: 3
  }
};

export class SmartExtractionService {
  private patterns: Map<string, PmsPattern> = new Map();
  private learnedPatterns: any[] = [];

  constructor() {
    // Charger les patterns par défaut
    Object.values(DEFAULT_PATTERNS).forEach(pattern => {
      this.patterns.set(pattern.pms_type, pattern);
    });
  }

  async loadLearnedPatterns(hotelId: string): Promise<void> {
    const { data, error } = await supabase
      .from('report_training_patterns')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('validated', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading learned patterns:', error);
      return;
    }

    this.learnedPatterns = data || [];
    
    // Analyser les patterns validés pour améliorer les règles
    this.analyzeAndUpdatePatterns();
  }

  private analyzeAndUpdatePatterns(): void {
    const pmsGroups = new Map<string, any[]>();
    
    // Grouper par type de PMS
    this.learnedPatterns.forEach(pattern => {
      const pmsType = pattern.pms_type || 'unknown';
      if (!pmsGroups.has(pmsType)) {
        pmsGroups.set(pmsType, []);
      }
      pmsGroups.get(pmsType)!.push(pattern);
    });

    // Pour chaque type de PMS, analyser les patterns
    pmsGroups.forEach((patterns, pmsType) => {
      if (pmsType === 'unknown' || patterns.length < 3) return;

      const statusCounts = new Map<string, { cleaning: string; count: number }>();
      const extractedData = patterns.flatMap(p => p.extracted_data || []);

      extractedData.forEach((room: any) => {
        const key = room.status;
        if (!statusCounts.has(key)) {
          statusCounts.set(key, { cleaning: room.cleaningType, count: 0 });
        }
        statusCounts.get(key)!.count++;
      });

      // Mettre à jour ou créer le pattern pour ce PMS
      const existingPattern = this.patterns.get(pmsType) || DEFAULT_PATTERNS[pmsType];
      if (existingPattern) {
        const updatedKeywords = { ...existingPattern.status_keywords };
        
        statusCounts.forEach((value, status) => {
          if (value.count >= 2) {
            updatedKeywords[status.toUpperCase()] = {
              status: status.toLowerCase().replace(/\s+/g, '-'),
              cleaning: value.cleaning as 'full' | 'quick' | 'none'
            };
          }
        });

        this.patterns.set(pmsType, {
          ...existingPattern,
          status_keywords: updatedKeywords
        });
      }
    });
  }

  detectPmsType(text: string): string {
    const upperText = text.toUpperCase();
    
    // Détection par mots-clés spécifiques
    if (upperText.includes('APALEO') || 
        (upperText.includes('DIR') && upperText.includes('INS'))) {
      return 'apaleo';
    }
    
    if (upperText.includes('MEDIALOG') || 
        upperText.includes('DRAPS')) {
      return 'medialog';
    }
    
    if (upperText.includes('SPACE STATUS') || 
        upperText.includes('MEWS')) {
      return 'space';
    }

    // Scoring par patterns
    const scores = new Map<string, number>();
    
    this.patterns.forEach((pattern, pmsType) => {
      let score = 0;
      Object.keys(pattern.status_keywords).forEach(keyword => {
        if (upperText.includes(keyword)) {
          score += 1;
        }
      });
      scores.set(pmsType, score);
    });

    // Retourner le PMS avec le meilleur score
    let bestPms = 'unknown';
    let bestScore = 0;
    
    scores.forEach((score, pmsType) => {
      if (score > bestScore) {
        bestScore = score;
        bestPms = pmsType;
      }
    });

    return bestScore >= 2 ? bestPms : 'unknown';
  }

  extractRooms(text: string, pmsType?: string): ExtractedRoom[] {
    const detectedPmsType = pmsType || this.detectPmsType(text);
    const pattern = this.patterns.get(detectedPmsType) || this.getFallbackPattern();
    
    return this.extractWithPattern(text, pattern);
  }

  private extractWithPattern(text: string, pattern: PmsPattern): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const foundRooms = new Set<string>();
    const roomPattern = new RegExp(pattern.room_number_regex, 'g');
    
    let match;
    while ((match = roomPattern.exec(text)) !== null) {
      const roomNumber = match[1];
      
      if (parseInt(roomNumber) > 999 || /^20(2[0-9])$/.test(roomNumber)) continue;
      if (foundRooms.has(roomNumber)) continue;
      
      foundRooms.add(roomNumber);
      
      const start = Math.max(0, match.index - pattern.context_window);
      const end = Math.min(text.length, match.index + pattern.context_window);
      const context = text.substring(start, end).toUpperCase();
      
      const dates = this.extractDates(context);
      const { status, cleaningType, confidence } = this.detectStatus(context, pattern);
      
      rooms.push({
        roomNumber: roomNumber.padStart(3, '0'),
        status,
        arrivalDate: dates[0] || '',
        departureDate: dates[dates.length - 1] || '',
        cleaningType,
        validated: false,
        confidence
      });
    }
    
    return rooms;
  }

  private extractDates(context: string): string[] {
    const dates4 = context.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    const dates2 = context.match(/\d{2}\/\d{2}\/\d{2}/g) || [];
    return [...dates4, ...dates2];
  }

  private detectStatus(
    context: string, 
    pattern: PmsPattern
  ): { status: string; cleaningType: 'full' | 'quick' | 'none'; confidence: number } {
    let bestMatch: { status: string; cleaningType: 'full' | 'quick' | 'none'; confidence: number } = { 
      status: 'unknown', 
      cleaningType: 'none', 
      confidence: 0 
    };
    
    Object.entries(pattern.status_keywords).forEach(([keyword, mapping]) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(context)) {
        const confidence = keyword.length / 20;
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            status: mapping.status,
            cleaningType: mapping.cleaning,
            confidence: Math.min(confidence, 1)
          };
        }
      }
    });

    if (bestMatch.confidence === 0) {
      const dates = this.extractDates(context);
      if (dates.length >= 2) {
        bestMatch = { status: 'checkout', cleaningType: 'full', confidence: 0.5 };
      } else if (dates.length === 1) {
        bestMatch = { status: 'stayover', cleaningType: 'quick', confidence: 0.4 };
      }
    }

    return bestMatch;
  }

  private getFallbackPattern(): PmsPattern {
    return {
      pms_type: 'generic',
      room_number_regex: '\\b([1-9]\\d{1,2})\\b',
      status_keywords: {
        'DIR': { status: 'dirty', cleaning: 'full' },
        'CLEAN': { status: 'clean', cleaning: 'none' },
        'OCC': { status: 'occupied', cleaning: 'none' },
        'DEPART': { status: 'checkout', cleaning: 'full' }
      },
      date_formats: ['dd/MM/yyyy'],
      context_window: 250,
      priority: 99
    };
  }

  getAvailablePmsTypes(): string[] {
    return Array.from(this.patterns.keys());
  }

  getPattern(pmsType: string): PmsPattern | undefined {
    return this.patterns.get(pmsType);
  }

  async savePattern(hotelId: string, pmsType: string, pattern: Partial<PmsPattern>): Promise<boolean> {
    const { error } = await supabase
      .from('report_training_patterns')
      .insert([{
        hotel_id: hotelId,
        pms_type: pmsType,
        detection_rules: pattern as any,
        validated: true,
        report_name: `Pattern ${pmsType}`,
        raw_text: '',
        extracted_data: [],
        created_by: (await supabase.auth.getUser()).data.user?.id
      }]);

    if (error) {
      console.error('Error saving pattern:', error);
      return false;
    }

    return true;
  }
}

export const smartExtractionService = new SmartExtractionService();
