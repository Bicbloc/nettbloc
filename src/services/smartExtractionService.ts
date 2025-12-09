import { supabase } from "@/integrations/supabase/client";

export interface PmsPattern {
  pms_type: string;
  room_number_regex: string;
  status_keywords: Record<string, { status: string; cleaning: 'full' | 'quick' | 'none'; priority?: number }>;
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
  linkedRooms?: string[];
  originalText?: string;
}

// Règles de combinaison pour Apaleo (et autres PMS si nécessaire)
interface CombinationRule {
  conditions: string[];
  result: { status: string; cleaning: 'full' | 'quick' | 'none' };
}

const APALEO_COMBINATION_RULES: CombinationRule[] = [
  // Départ + Arrivée même chambre = À blanc (ménage complet)
  { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'full' } },
  { conditions: ['PARTI', 'EN ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
  { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
  
  // Arrivée + À contrôler = Propre (chambre déjà prête)
  { conditions: ['arrival', 'to_inspect'], result: { status: 'clean', cleaning: 'none' } },
  { conditions: ['EN ARRIVEE', 'A CONTROLER'], result: { status: 'clean', cleaning: 'none' } },
  { conditions: ['ARRIVEE', 'CONTROLER'], result: { status: 'clean', cleaning: 'none' } },
  
  // Arrivé (client présent) + Sale = À blanc
  { conditions: ['arrived', 'dirty'], result: { status: 'dirty', cleaning: 'full' } },
  
  // Recouche + Sale = Recouche prioritaire
  { conditions: ['stayover', 'dirty'], result: { status: 'stayover', cleaning: 'quick' } },
];

const DEFAULT_PATTERNS: Record<string, PmsPattern> = {
  apaleo: {
    pms_type: 'apaleo',
    // Regex corrigé: capture chambres 01, 02, 03... jusqu'à 99999
    room_number_regex: '\\b(0?[1-9]\\d{0,4}|[1-9]\\d{1,4})\\b',
    status_keywords: {
      'DIR': { status: 'dirty', cleaning: 'full' },
      'DIRTY': { status: 'dirty', cleaning: 'full' },
      'INS': { status: 'inspected', cleaning: 'none' },
      'INSPECTED': { status: 'inspected', cleaning: 'none' },
      'OCC': { status: 'occupied', cleaning: 'none' },
      'OCCUPIED': { status: 'occupied', cleaning: 'none' },
      'CLEANING': { status: 'to-clean', cleaning: 'full' },
      'DEPART': { status: 'checkout', cleaning: 'full' },
      'DEPARTURE': { status: 'checkout', cleaning: 'full' },
      'PARTI': { status: 'checkout', cleaning: 'full' },
      'CHECKOUT': { status: 'checkout', cleaning: 'full' },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick' },
      'STAYOVER': { status: 'stayover', cleaning: 'quick' },
      'SALE': { status: 'dirty', cleaning: 'full' },
      'EN ARRIVEE': { status: 'arrival', cleaning: 'full' },
      'ARRIVAL': { status: 'arrival', cleaning: 'full' },
      'ARRIVEE': { status: 'arrival', cleaning: 'full' },
      'A CONTROLER': { status: 'to_inspect', cleaning: 'none' },
      'CONTROLER': { status: 'to_inspect', cleaning: 'none' },
      'CONTROLE': { status: 'to_inspect', cleaning: 'none' },
      'ARRIVÉ': { status: 'arrived', cleaning: 'none' },
      'ARRIVE': { status: 'arrived', cleaning: 'none' },
      'PROPRE': { status: 'clean', cleaning: 'none' },
      'CLEAN': { status: 'clean', cleaning: 'none' }
    },
    date_formats: ['dd/MM/yyyy', 'dd/MM/yy', 'dd.MM.yyyy', 'dd-MM-yyyy'],
    context_window: 300,
    priority: 1
  },
  mews: {
    pms_type: 'mews',
    room_number_regex: '\\b([1-9]\\d{2,4})\\b',
    status_keywords: {
      // English keywords
      'Dirty': { status: 'dirty', cleaning: 'full' },
      'Clean': { status: 'clean', cleaning: 'none' },
      'Inspected': { status: 'inspected', cleaning: 'none' },
      'Out of Service': { status: 'out-of-order', cleaning: 'none' },
      'Occupied Clean': { status: 'occupied', cleaning: 'none' },
      'Occupied Dirty': { status: 'occupied', cleaning: 'quick' },
      // French keywords (common in Mews reports)
      'SAL': { status: 'dirty', cleaning: 'full' },
      'INS': { status: 'inspected', cleaning: 'none' },
      'COC': { status: 'occupied', cleaning: 'none' },
      'CLA': { status: 'clean', cleaning: 'none' },
      'DLX': { status: 'clean', cleaning: 'none' },
      'SUP': { status: 'clean', cleaning: 'none' },
      'FAM': { status: 'clean', cleaning: 'none' }
    },
    date_formats: ['dd/MM/yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy'],
    context_window: 300,
    priority: 1
  },
  medialog: {
    pms_type: 'medialog',
    room_number_regex: '\\b([1-9]\\d{1,3})\\b',
    status_keywords: {
      'DRAPS': { status: 'change-sheets', cleaning: 'full' },
      'RECOUCHE': { status: 'stayover', cleaning: 'quick' },
      'BLANC': { status: 'dirty', cleaning: 'full' },
      'À BLANC': { status: 'dirty', cleaning: 'full' },
      'NE PAS NETTOYER': { status: 'occupied', cleaning: 'none' },
      'DEPART': { status: 'checkout', cleaning: 'full' },
      'DÉPART': { status: 'checkout', cleaning: 'full' }
    },
    date_formats: ['dd/MM/yyyy', 'dd/MM/yy'],
    context_window: 250,
    priority: 2
  },
  opera: {
    pms_type: 'opera',
    room_number_regex: '\\b([1-9]\\d{2,4})\\b',
    status_keywords: {
      'DIRTY': { status: 'dirty', cleaning: 'full' },
      'CLEAN': { status: 'clean', cleaning: 'none' },
      'INSPECTED': { status: 'inspected', cleaning: 'none' },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none' },
      'OOO': { status: 'out-of-order', cleaning: 'none' },
      'PICKUP': { status: 'stayover', cleaning: 'quick' },
      'VACANT': { status: 'vacant', cleaning: 'full' },
      'OCCUPIED': { status: 'occupied', cleaning: 'none' },
      'DUE OUT': { status: 'checkout', cleaning: 'full' },
      'CHECKOUT': { status: 'checkout', cleaning: 'full' }
    },
    date_formats: ['dd-MMM-yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy'],
    context_window: 300,
    priority: 1
  },
  protel: {
    pms_type: 'protel',
    room_number_regex: '\\b([1-9]\\d{2,4})\\b',
    status_keywords: {
      'DIRTY': { status: 'dirty', cleaning: 'full' },
      'CLEAN': { status: 'clean', cleaning: 'none' },
      'CHECKED OUT': { status: 'checkout', cleaning: 'full' },
      'OCCUPIED': { status: 'occupied', cleaning: 'none' },
      'VACANT': { status: 'vacant', cleaning: 'full' },
      'OUT OF ORDER': { status: 'out-of-order', cleaning: 'none' },
      'BLOCKED': { status: 'blocked', cleaning: 'none' }
    },
    date_formats: ['dd.MM.yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'],
    context_window: 300,
    priority: 2
  },
  fidelio: {
    pms_type: 'fidelio',
    room_number_regex: '\\b([1-9]\\d{2,4})\\b',
    status_keywords: {
      'DRT': { status: 'dirty', cleaning: 'full' },
      'CLN': { status: 'clean', cleaning: 'none' },
      'INS': { status: 'inspected', cleaning: 'none' },
      'OOO': { status: 'out-of-order', cleaning: 'none' },
      'OCC': { status: 'occupied', cleaning: 'none' },
      'VAC': { status: 'vacant', cleaning: 'full' },
      'DEP': { status: 'checkout', cleaning: 'full' }
    },
    date_formats: ['dd-MMM-yy', 'dd/MM/yy', 'ddMMMyy'],
    context_window: 250,
    priority: 2
  },
  rms: {
    pms_type: 'rms',
    room_number_regex: '\\b([1-9]\\d{2,4})\\b',
    status_keywords: {
      'SALE': { status: 'dirty', cleaning: 'full' },
      'PROPRE': { status: 'clean', cleaning: 'none' },
      'CONTRÔLÉ': { status: 'inspected', cleaning: 'none' },
      'CONTROLE': { status: 'inspected', cleaning: 'none' },
      'HS': { status: 'out-of-order', cleaning: 'none' },
      'OCCUPÉ': { status: 'occupied', cleaning: 'none' },
      'OCCUPE': { status: 'occupied', cleaning: 'none' },
      'LIBRE': { status: 'vacant', cleaning: 'full' },
      'DÉPART': { status: 'checkout', cleaning: 'full' },
      'DEPART': { status: 'checkout', cleaning: 'full' }
    },
    date_formats: ['dd/MM/yyyy', 'dd/MM/yy'],
    context_window: 300,
    priority: 2
  },
  space: {
    pms_type: 'space',
    room_number_regex: '\\b([1-9]\\d{2,4})\\b',
    status_keywords: {
      'Dirty': { status: 'dirty', cleaning: 'full' },
      'Clean': { status: 'clean', cleaning: 'none' },
      'Inspected': { status: 'inspected', cleaning: 'none' },
      'Out of Order': { status: 'out-of-order', cleaning: 'none' },
      'Occupied': { status: 'occupied', cleaning: 'none' },
      'Vacant': { status: 'vacant', cleaning: 'full' },
      'Checkout': { status: 'checkout', cleaning: 'full' }
    },
    date_formats: ['dd/MM/yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy'],
    context_window: 300,
    priority: 3
  }
};

export class SmartExtractionService {
  private patterns: Map<string, PmsPattern> = new Map();
  private learnedPatterns: any[] = [];
  private customConnectedRoomPatterns: RegExp[] = [];
  private connectedRoomPatterns = [
    /(\d{2,4})\s*[-–—]\s*(\d{2,4})/g,           // 101-102, 101–102
    /(\d{2,4})\s*[+&]\s*(\d{2,4})/g,            // 101+102, 101&102
    /(\d{2,4})\s*\/\s*(\d{2,4})/g,              // 101/102
    /(\d{2,4})\s*et\s*(\d{2,4})/gi,             // 101 et 102
    /(\d{2,4})\s*and\s*(\d{2,4})/gi,            // 101 and 102
    /(\d{2,4})\s*,\s*(\d{2,4})/g,               // 101, 102
    /(\d{2,4})\s*→\s*(\d{2,4})/g,               // 101→102
    /(\d{2,4})\s*<->\s*(\d{2,4})/g,             // 101<->102
    /(?:chambre|room|rm)?\s*(\d{2,4})\s*(?:avec|with)\s*(?:chambre|room|rm)?\s*(\d{2,4})/gi, // chambre 101 avec 102
  ];

  constructor() {
    Object.values(DEFAULT_PATTERNS).forEach(pattern => {
      this.patterns.set(pattern.pms_type, pattern);
    });
  }

  async loadLearnedPatterns(hotelId: string): Promise<void> {
    console.log(`🔍 Chargement des patterns pour l'hôtel: ${hotelId}`);
    
    // Charger les patterns: créés par cet hôtel OU assignés à cet hôtel OU patterns par défaut
    const { data, error } = await supabase
      .from('report_training_patterns')
      .select('*')
      .or(`hotel_id.eq.${hotelId},assigned_to_hotel_id.eq.${hotelId},is_default.eq.true`)
      .eq('validated', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur chargement patterns:', error);
      return;
    }

    console.log(`✅ ${data?.length || 0} pattern(s) chargé(s):`);
    data?.forEach(p => {
      console.log(`   📋 ${p.pattern_name || 'Sans nom'} - PMS: ${p.pms_type || 'auto'} - Créé par: ${p.hotel_id} - Assigné à: ${p.assigned_to_hotel_id || 'aucun'}`);
    });

    this.learnedPatterns = data || [];
    this.analyzeAndUpdatePatterns();
    
    // Also load custom connected room rules
    await this.loadCustomConnectedRoomRules(hotelId);
  }

  async loadCustomConnectedRoomRules(hotelId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('connected_room_rules')
        .select('pattern_regex, priority')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error loading custom connected room rules:', error);
        return;
      }

      // Add custom patterns with higher priority (at the beginning)
      if (data && data.length > 0) {
        this.customConnectedRoomPatterns = data.map(rule => {
          try {
            return new RegExp(rule.pattern_regex, 'gi');
          } catch (e) {
            console.error(`Invalid regex pattern: ${rule.pattern_regex}`, e);
            return null;
          }
        }).filter((pattern): pattern is RegExp => pattern !== null);
        
        console.log(`✅ Loaded ${this.customConnectedRoomPatterns.length} custom connected room rules`);
      }
    } catch (error) {
      console.error('Error in loadCustomConnectedRoomRules:', error);
    }
  }

  private analyzeAndUpdatePatterns(): void {
    console.log(`📊 Analyse de ${this.learnedPatterns.length} pattern(s) appris...`);
    
    const pmsGroups = new Map<string, any[]>();
    
    this.learnedPatterns.forEach(pattern => {
      const pmsType = pattern.pms_type || 'unknown';
      if (!pmsGroups.has(pmsType)) {
        pmsGroups.set(pmsType, []);
      }
      pmsGroups.get(pmsType)!.push(pattern);
    });

    pmsGroups.forEach((patterns, pmsType) => {
      console.log(`   📋 PMS ${pmsType}: ${patterns.length} pattern(s)`);
      
      // Même avec 1 pattern, on l'applique si validé
      if (pmsType === 'unknown') return;

      const statusCounts = new Map<string, { cleaning: string; count: number }>();
      let detectedRoomFormat: string | null = null;

      patterns.forEach(p => {
        // Extraire le format de chambre détecté par l'IA - vérifier plusieurs emplacements
        const patternsData = p.detection_rules || p.extracted_data?.patterns || p.patterns;
        if (patternsData?.roomFormat && !detectedRoomFormat) {
          detectedRoomFormat = patternsData.roomFormat;
          console.log(`   🔢 Format chambre détecté depuis detection_rules: ${detectedRoomFormat}`);
        }
        // Aussi essayer d'extraire depuis extracted_data.patterns
        if (!detectedRoomFormat && p.extracted_data?.patterns?.roomFormat) {
          detectedRoomFormat = p.extracted_data.patterns.roomFormat;
          console.log(`   🔢 Format chambre détecté depuis extracted_data.patterns: ${detectedRoomFormat}`);
        }
        
        const extractedData = Array.isArray(p.extracted_data) 
          ? p.extracted_data 
          : (p.extracted_data?.rooms || []);
          
        extractedData.forEach((room: any) => {
          const key = room.status;
          if (!statusCounts.has(key)) {
            statusCounts.set(key, { cleaning: room.cleaningType, count: 0 });
          }
          statusCounts.get(key)!.count++;
        });
      });

      let existingPattern = this.patterns.get(pmsType);
      
      // Si le pattern n'existe pas encore, le créer à partir du pattern par défaut ou d'un nouveau
      if (!existingPattern && this.patterns.has('apaleo') && pmsType.toLowerCase().includes('apaleo')) {
        existingPattern = { ...this.patterns.get('apaleo')! };
        this.patterns.set(pmsType, existingPattern);
      }
      
      if (existingPattern) {
        // Mettre à jour le regex si un format spécifique a été détecté
        if (detectedRoomFormat) {
          // Analyser le format de chambre appris
          const formatLength = detectedRoomFormat.replace(/[^X]/g, '').length || detectedRoomFormat.length;
          const startsWithZero = detectedRoomFormat.startsWith('0') || detectedRoomFormat.includes('01') || detectedRoomFormat.includes('02');
          
          if (startsWithZero) {
            // Format 2 chiffres commençant par 0 (ex: 01, 02, 09)
            existingPattern.room_number_regex = '\\b(0[1-9])\\b';
            console.log(`   ✅ Regex mis à jour pour chambres 2 chiffres (01-09)`);
          } else if (formatLength >= 3 || detectedRoomFormat === 'XXX') {
            // Format 3+ chiffres (ex: 101, 102, 301)
            existingPattern.room_number_regex = '\\b([1-9]\\d{2,4})\\b';
            console.log(`   ✅ Regex mis à jour pour chambres 3+ chiffres (100-99999)`);
          } else {
            // Format générique
            existingPattern.room_number_regex = '\\b([1-9]\\d{1,4})\\b';
            console.log(`   ✅ Regex générique pour chambres 2-5 chiffres`);
          }
        }
        
        const newKeywords = { ...existingPattern.status_keywords };
        statusCounts.forEach((data, status) => {
          // Appliquer même avec 1 occurrence si le pattern est validé
          if (data.count >= 1) {
            newKeywords[status] = {
              status,
              cleaning: data.cleaning as 'full' | 'quick' | 'none'
            };
          }
        });
        existingPattern.status_keywords = newKeywords;
        console.log(`   ✅ Pattern ${pmsType} mis à jour avec ${Object.keys(newKeywords).length} mots-clés`);
      }
    });
  }

  detectPmsType(text: string): string {
    const textUpper = text.toUpperCase();
    
    // Mots-clés spécifiques par PMS
    const pmsKeywords: Record<string, string[]> = {
      'opera': ['OPERA', 'ORACLE HOSPITALITY', 'MICROS', 'OPERA PMS', 'OPERA CLOUD'],
      'protel': ['PROTEL', 'PROTEL PMS', 'PROTEL HOTELSOFTWARE', 'PROTEL AIR'],
      'fidelio': ['FIDELIO', 'FIDELIO SUITE 8', 'FIDELIO V8'],
      'mews': ['MEWS', 'COMMANDER', 'MEWS SYSTEMS', 'MEWS COMMANDER', 'STATUT DES ESPACES'],
      'apaleo': ['APALEO', 'CLOUD PMS', 'HOUSEKEEPING REPORT'],
      'medialog': ['MEDIALOG', 'PLANNING MENAGE', 'PLANNING MÉNAGE'],
      'rms': ['RMS HOTEL', 'RMS CLOUD', 'RMS HOSPITALITY'],
      'space': ['SPACE PMS', 'ROOM MANAGEMENT', 'GUESTLINE']
    };

    // Vérifier les mots-clés spécifiques d'abord
    let maxKeywordMatches = 0;
    let detectedFromKeywords = '';

    for (const [pmsType, keywords] of Object.entries(pmsKeywords)) {
      const matches = keywords.filter(keyword => textUpper.includes(keyword)).length;
      if (matches > maxKeywordMatches) {
        maxKeywordMatches = matches;
        detectedFromKeywords = pmsType;
      }
    }

    // Si un PMS est détecté par mots-clés, le retourner
    if (maxKeywordMatches > 0) {
      console.log(`🔍 PMS détecté par mots-clés: ${detectedFromKeywords}`);
      return detectedFromKeywords;
    }

    // Sinon, utiliser le scoring basé sur les status keywords
    const scores = new Map<string, number>();

    this.patterns.forEach((pattern, pmsType) => {
      let score = 0;
      Object.keys(pattern.status_keywords).forEach(keyword => {
        if (textUpper.includes(keyword.toUpperCase())) {
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

    const result = maxScore >= 2 ? detectedType : 'unknown';
    console.log(`🔍 PMS détecté par scoring: ${result} (score: ${maxScore})`);
    return result;
  }

  extractRooms(text: string, pmsType?: string): ExtractedRoom[] {
    const detectedPmsType = pmsType || this.detectPmsType(text);
    const selectedPattern = this.patterns.get(detectedPmsType);

    if (!selectedPattern) {
      return this.extractWithGenericPattern(text);
    }

    let rooms = this.extractWithPattern(text, selectedPattern);
    
    // Appliquer la logique de fusion des doublons pour Apaleo
    if (detectedPmsType === 'apaleo') {
      rooms = this.mergeApaleoRoomDuplicates(rooms);
    }
    
    return rooms;
  }

  /**
   * Fusionne les chambres en doublon pour Apaleo
   * Ex: Si une chambre a Départ + Arrivée le même jour → fusionner en "À Blanc"
   * Ex: Si une chambre a Arrivée + À contrôler → marquer comme "Propre"
   */
  private mergeApaleoRoomDuplicates(rooms: ExtractedRoom[]): ExtractedRoom[] {
    // Grouper les chambres par numéro
    const roomsByNumber = new Map<string, ExtractedRoom[]>();
    
    rooms.forEach(room => {
      const existing = roomsByNumber.get(room.roomNumber) || [];
      existing.push(room);
      roomsByNumber.set(room.roomNumber, existing);
    });
    
    const mergedRooms: ExtractedRoom[] = [];
    
    roomsByNumber.forEach((roomEntries, roomNumber) => {
      if (roomEntries.length === 1) {
        // Pas de doublon, garder tel quel
        mergedRooms.push(roomEntries[0]);
      } else {
        // Chambres en doublon - appliquer les règles de combinaison
        const mergedRoom = this.applyCombinationRules(roomEntries, roomNumber);
        mergedRooms.push(mergedRoom);
      }
    });
    
    console.log(`🔀 Apaleo: ${rooms.length} entrées → ${mergedRooms.length} chambres après fusion`);
    
    return mergedRooms;
  }
  
  /**
   * Applique les règles de combinaison pour déterminer le statut final d'une chambre
   */
  private applyCombinationRules(roomEntries: ExtractedRoom[], roomNumber: string): ExtractedRoom {
    const statuses = roomEntries.map(r => r.status.toLowerCase());
    const statusesUpper = roomEntries.map(r => r.status.toUpperCase());
    
    console.log(`🔍 Chambre ${roomNumber}: combinaison de statuts [${statuses.join(', ')}]`);
    
    // Vérifier les règles de combinaison
    for (const rule of APALEO_COMBINATION_RULES) {
      const conditionsLower = rule.conditions.map(c => c.toLowerCase());
      
      // Vérifier si tous les statuts de la règle sont présents
      const allConditionsMet = conditionsLower.every(condition => 
        statuses.some(status => status.includes(condition) || condition.includes(status))
      );
      
      if (allConditionsMet) {
        console.log(`✅ Règle appliquée pour ${roomNumber}: [${rule.conditions.join(' + ')}] → ${rule.result.status}`);
        
        // Créer la chambre fusionnée
        const baseRoom = roomEntries[0];
        return {
          ...baseRoom,
          roomNumber,
          status: rule.result.status,
          cleaningType: rule.result.cleaning,
          validated: false,
          confidence: 0.9,
          originalText: roomEntries.map(r => r.originalText).filter(Boolean).join(' | ')
        };
      }
    }
    
    // Règles spécifiques par défaut
    const hasCheckout = statuses.some(s => ['checkout', 'parti', 'depart', 'departure'].includes(s));
    const hasArrival = statuses.some(s => ['arrival', 'arrivee', 'en arrivee'].includes(s));
    const hasToInspect = statuses.some(s => ['to_inspect', 'a controler', 'controler'].includes(s));
    const hasArrived = statuses.some(s => ['arrived', 'arrivé', 'arrive'].includes(s));
    
    // Départ + Arrivée = À Blanc
    if (hasCheckout && hasArrival) {
      console.log(`✅ Chambre ${roomNumber}: Départ + Arrivée = À Blanc`);
      return {
        ...roomEntries[0],
        roomNumber,
        status: 'checkout_arrival',
        cleaningType: 'full',
        validated: false,
        confidence: 0.95,
        originalText: roomEntries.map(r => r.originalText).filter(Boolean).join(' | ')
      };
    }
    
    // Arrivée + À contrôler = Propre (chambre déjà prête)
    if (hasArrival && hasToInspect) {
      console.log(`✅ Chambre ${roomNumber}: Arrivée + À contrôler = Propre`);
      return {
        ...roomEntries[0],
        roomNumber,
        status: 'clean',
        cleaningType: 'none',
        validated: false,
        confidence: 0.9,
        originalText: roomEntries.map(r => r.originalText).filter(Boolean).join(' | ')
      };
    }
    
    // Arrivé (client présent) + À contrôler = Propre
    if (hasArrived && hasToInspect) {
      console.log(`✅ Chambre ${roomNumber}: Arrivé + À contrôler = Propre`);
      return {
        ...roomEntries[0],
        roomNumber,
        status: 'clean',
        cleaningType: 'none',
        validated: false,
        confidence: 0.9,
        originalText: roomEntries.map(r => r.originalText).filter(Boolean).join(' | ')
      };
    }
    
    // Par défaut, prendre l'entrée avec le nettoyage le plus prioritaire
    const priorityOrder: Record<string, number> = { 'full': 3, 'quick': 2, 'none': 1 };
    roomEntries.sort((a, b) => (priorityOrder[b.cleaningType] || 0) - (priorityOrder[a.cleaningType] || 0));
    
    console.log(`⚠️ Chambre ${roomNumber}: pas de règle spécifique, utilisation du statut prioritaire: ${roomEntries[0].status}`);
    
    return {
      ...roomEntries[0],
      originalText: roomEntries.map(r => r.originalText).filter(Boolean).join(' | ')
    };
  }

  private extractWithPattern(text: string, pattern: PmsPattern): ExtractedRoom[] {
    const lines = text.split('\n').filter(line => line.trim());
    const rooms: ExtractedRoom[] = [];

    for (const line of lines) {
      const connectedInfo = this.detectConnectedRooms(line);
      
      if (connectedInfo.isConnected) {
        // Create separate room entries for each room in connected pairs
        for (const roomPair of connectedInfo.roomPairs) {
          const baseRoom = this.extractRoomFromLine(line, pattern);
          if (baseRoom) {
            const context = this.getContext(lines, lines.indexOf(line), pattern.context_window);
            const dates = this.extractDates(context);
            
            // Create one room entry for each room number in the pair
            roomPair.forEach((roomNum, index) => {
              const linkedRoom = { ...baseRoom };
              linkedRoom.roomNumber = roomNum;
              linkedRoom.isConnected = true;
              linkedRoom.linkedRooms = [roomPair[1 - index]]; // Link to the other room
              linkedRoom.arrivalDate = dates.checkIn || '';
              linkedRoom.departureDate = dates.checkOut || '';
              linkedRoom.originalText = line;
              rooms.push(linkedRoom);
            });
          }
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

  private detectConnectedRooms(line: string): { isConnected: boolean; roomPairs: string[][] } {
    // Try custom patterns first (higher priority)
    for (const pattern of this.customConnectedRoomPatterns) {
      // Reset regex state
      pattern.lastIndex = 0;
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        const roomPairs = matches.map(m => [m[1], m[2]]).filter(pair => pair[0] && pair[1]);
        if (roomPairs.length > 0) {
          console.log(`🔗 Detected connected rooms using custom rule: ${roomPairs.map(p => p.join('-')).join(', ')}`);
          return { isConnected: true, roomPairs };
        }
      }
    }
    
    // Fallback to default patterns
    for (const pattern of this.connectedRoomPatterns) {
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        // Create an array of pairs instead of flattening everything
        const roomPairs = matches.map(m => [m[1], m[2]]);
        return { isConnected: true, roomPairs };
      }
    }
    return { isConnected: false, roomPairs: [] };
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
    // Patterns pour différents formats de dates
    const datePatterns = [
      // dd/MM/yyyy, dd-MM-yyyy, dd.MM.yyyy
      /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,
      // yyyy-MM-dd, yyyy/MM/dd
      /\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/g,
      // dd MMM yyyy (ex: 15 Jan 2024, 15 Janv 2024)
      /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Janv|Févr|Mars|Avr|Mai|Juin|Juil|Août|Sept)[a-z]*\.?\s+(\d{2,4})\b/gi,
      // dd-MMM-yy (ex: 15-Jan-24)
      /\b(\d{1,2})[-\/]([A-Z][a-z]{2})[-\/](\d{2})\b/g,
      // MMM dd, yyyy (ex: Jan 15, 2024)
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi,
      // ddMMMyy (ex: 15Jan24)
      /\b(\d{2})([A-Z][a-z]{2})(\d{2})\b/g
    ];

    const dates: string[] = [];
    const uniqueDates = new Set<string>();
    
    // Extraire toutes les dates trouvées
    datePatterns.forEach(pattern => {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(context)) !== null) {
        const dateStr = match[0].trim();
        // Éviter les doublons
        if (!uniqueDates.has(dateStr)) {
          uniqueDates.add(dateStr);
          dates.push(dateStr);
        }
      }
    });

    console.log(`📅 Dates extraites du contexte (${dates.length}):`, dates);

    return {
      checkIn: dates[0],
      checkOut: dates[1] || dates[0] // Si une seule date, l'utiliser pour les deux
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
    
    // Chambre sale / à nettoyer
    if (lineUpper.match(/\b(DIRTY|SALE|DIR|DRAPS?|BLANC|À\s*BLANC|DRT)\b/)) {
      return 'dirty';
    }
    
    // Chambre propre
    if (lineUpper.match(/\b(CLEAN|PROPRE|CLN|INSPEC|INS)\b/)) {
      return 'clean';
    }
    
    // Départ / checkout
    if (lineUpper.match(/\b(CHECKOUT|CHECK-OUT|D[ÉE]PART|DEPARTED?|DEP|VACATING|DUE\s*OUT)\b/)) {
      return 'checkout';
    }
    
    // Occupée
    if (lineUpper.match(/\b(OCCUPIED?|OCCUP[ÉE]E?|OCC|STAY)\b/)) {
      return 'occupied';
    }
    
    // Recouche / stayover
    if (lineUpper.match(/\b(RECOUCHE|STAY\s*OVER|PICK\s*UP|REFRESH)\b/)) {
      return 'stayover';
    }
    
    // Arrivée
    if (lineUpper.match(/\b(ARRIVAL|ARRIV[ÉE]E?|ARR|CHECKING\s*IN|DUE\s*IN)\b/)) {
      return 'arrival';
    }
    
    // Hors service
    if (lineUpper.match(/\b(OUT\s*OF\s*ORDER|OOO|OUT\s*OF\s*SERVICE|H\.?S\.?|BLOCKED?)\b/)) {
      return 'out-of-order';
    }
    
    // Vacant / libre
    if (lineUpper.match(/\b(VACANT|LIBRE|VAC|EMPTY|AVAILABLE)\b/)) {
      return 'vacant';
    }
    
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
