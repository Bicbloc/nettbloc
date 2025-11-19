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
  isConnected?: boolean;
  connectedRooms?: string[];
  originalText?: string;
}

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
  mews: {
    pms_type: 'mews',
    room_number_regex: '\\b([1-9]\\d{2})\\b',
    status_keywords: {
      'Dirty': { status: 'dirty', cleaning: 'full' },
      'Clean': { status: 'clean', cleaning: 'none' },
      'Inspected': { status: 'inspected', cleaning: 'none' },
      'Out of Service': { status: 'out-of-order', cleaning: 'none' },
      'Occupied Clean': { status: 'occupied', cleaning: 'none' },
      'Occupied Dirty': { status: 'occupied', cleaning: 'quick' }
    },
    date_formats: ['dd/MM/yyyy', 'yyyy-MM-dd'],
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
  private connectedRoomPatterns = [
    /(\d{3,4})\s*[-–—]\s*(\d{3,4})/g,
    /(\d{3,4})\s*[+&]\s*(\d{3,4})/g,
    /(\d{3,4})\s*\/\s*(\d{3,4})/g,
    /(\d{3,4})\s*et\s*(\d{3,4})/gi,
    /(\d{3,4})\s*,\s*(\d{3,4})/g,
  ];

  constructor() {
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
    this.analyzeAndUpdatePatterns();
  }

  private analyzeAndUpdatePatterns(): void {
    const pmsGroups = new Map<string, any[]>();
    
    this.learnedPatterns.forEach(pattern => {
      const pmsType = pattern.pms_type || 'unknown';
      if (!pmsGroups.has(pmsType)) {
        pmsGroups.set(pmsType, []);
      }
      pmsGroups.get(pmsType)!.push(pattern);
    });

    pmsGroups.forEach((patterns, pmsType) => {
      if (pmsType === 'unknown' || patterns.length < 3) return;

      const statusCounts = new Map<string, { cleaning: string; count: number }>();

      patterns.forEach(p => {
        const extractedData = Array.isArray(p.extracted_data) ? p.extracted_data : [];
        extractedData.forEach((room: any) => {
          const key = room.status;
          if (!statusCounts.has(key)) {
            statusCounts.set(key, { cleaning: room.cleaningType, count: 0 });
          }
          statusCounts.get(key)!.count++;
        });
      });

      const existingPattern = this.patterns.get(pmsType);
      if (existingPattern) {
        const newKeywords = { ...existingPattern.status_keywords };
        statusCounts.forEach((data, status) => {
          if (data.count >= 2) {
            newKeywords[status] = {
              status,
              cleaning: data.cleaning as 'full' | 'quick' | 'none'
            };
          }
        });
        existingPattern.status_keywords = newKeywords;
      }
    });
  }

  detectPmsType(text: string): string {
    const scores = new Map<string, number>();

    this.patterns.forEach((pattern, pmsType) => {
      let score = 0;
      Object.keys(pattern.status_keywords).forEach(keyword => {
        if (text.toUpperCase().includes(keyword.toUpperCase())) {
          score += 1;
        }
      });
      scores.set(pmsType, score);
    });

    let maxScore = 0;
    let detectedType = 'unknown';
    scores.forEach((score, pmsType) => {
      if (score > maxScore) {
        maxScore = score;
        detectedType = pmsType;
      }
    });

    return maxScore >= 2 ? detectedType : 'unknown';
  }

  extractRooms(text: string, pmsType?: string): ExtractedRoom[] {
    const selectedPattern = pmsType
      ? this.patterns.get(pmsType)
      : this.patterns.get(this.detectPmsType(text));

    if (!selectedPattern) {
      return this.extractWithGenericPattern(text);
    }

    return this.extractWithPattern(text, selectedPattern);
  }

  private extractWithPattern(text: string, pattern: PmsPattern): ExtractedRoom[] {
    const lines = text.split('\n').filter(line => line.trim());
    const rooms: ExtractedRoom[] = [];

    for (const line of lines) {
      const connectedInfo = this.detectConnectedRooms(line);
      
      if (connectedInfo.isConnected) {
        const room = this.extractRoomFromLine(line, pattern);
        if (room) {
          room.isConnected = true;
          room.connectedRooms = connectedInfo.rooms;
          room.roomNumber = connectedInfo.rooms.join('-');
          room.originalText = line;
          
          const context = this.getContext(lines, lines.indexOf(line), pattern.context_window);
          const dates = this.extractDates(context);
          room.arrivalDate = dates.checkIn || '';
          room.departureDate = dates.checkOut || '';
          
          rooms.push(room);
        }
        continue;
      }

      const room = this.extractRoomFromLine(line, pattern);
      if (room) {
        const context = this.getContext(lines, lines.indexOf(line), pattern.context_window);
        const dates = this.extractDates(context);
        room.arrivalDate = dates.checkIn || '';
        room.departureDate = dates.checkOut || '';
        room.originalText = line;
        rooms.push(room);
      }
    }

    return rooms;
  }

  private extractRoomFromLine(line: string, pattern: PmsPattern): ExtractedRoom | null {
    const regex = new RegExp(pattern.room_number_regex);
    const roomMatch = line.match(regex);
    if (!roomMatch) return null;

    const roomNumber = roomMatch[1] || roomMatch[0];
    const { status, cleaningType } = this.detectStatus(line, pattern);

    if (!status) return null;

    return {
      roomNumber,
      status,
      arrivalDate: '',
      departureDate: '',
      cleaningType,
      validated: false,
      confidence: 0.8
    };
  }

  private detectConnectedRooms(line: string): { isConnected: boolean; rooms: string[] } {
    for (const pattern of this.connectedRoomPatterns) {
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        const rooms = matches.flatMap(m => [m[1], m[2]]);
        return { isConnected: true, rooms };
      }
    }
    return { isConnected: false, rooms: [] };
  }

  private getContext(lines: string[], lineIndex: number, windowSize: number): string {
    const start = Math.max(0, lineIndex - 1);
    const end = Math.min(lines.length, lineIndex + 2);
    return lines.slice(start, end).join(' ');
  }

  private detectStatus(context: string, pattern: PmsPattern): {
    status: string;
    cleaningType: 'full' | 'quick' | 'none';
  } {
    const contextUpper = context.toUpperCase();

    for (const [keyword, config] of Object.entries(pattern.status_keywords)) {
      if (contextUpper.includes(keyword.toUpperCase())) {
        return {
          status: config.status,
          cleaningType: config.cleaning
        };
      }
    }

    return { status: '', cleaningType: 'none' };
  }

  private extractDates(context: string): { checkIn?: string; checkOut?: string } {
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /(\d{1,2}-\d{1,2}-\d{2,4})/g
    ];

    const dates: string[] = [];
    datePatterns.forEach(pattern => {
      const matches = context.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    });

    return {
      checkIn: dates[0],
      checkOut: dates[1]
    };
  }

  private extractWithGenericPattern(text: string): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const roomMatch = line.match(/\b([1-9]\d{2,3})\b/);
      if (!roomMatch) continue;

      const roomNumber = roomMatch[1];
      const status = this.guessStatus(line);

      if (status) {
        rooms.push({
          roomNumber,
          status,
          arrivalDate: '',
          departureDate: '',
          cleaningType: 'full',
          validated: false,
          confidence: 0.5
        });
      }
    }

    return rooms;
  }

  private guessStatus(line: string): string {
    const lineUpper = line.toUpperCase();
    if (lineUpper.includes('DIRTY') || lineUpper.includes('SALE')) return 'dirty';
    if (lineUpper.includes('CLEAN') || lineUpper.includes('PROPRE')) return 'clean';
    if (lineUpper.includes('CHECKOUT') || lineUpper.includes('DEPART')) return 'checkout';
    if (lineUpper.includes('OCCUPIED') || lineUpper.includes('OCCUP')) return 'occupied';
    return '';
  }

  async savePattern(hotelId: string, pmsType: string, patternData: any): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('report_training_patterns').insert([{
      hotel_id: hotelId,
      pms_type: pmsType,
      detection_rules: patternData,
      validated: false,
      created_by: user?.id || '',
      report_name: 'pattern',
      raw_text: '',
      extracted_data: []
    }]);
  }

  getAvailablePmsTypes(): string[] {
    return Array.from(this.patterns.keys());
  }
}

export const smartExtractionService = new SmartExtractionService();
