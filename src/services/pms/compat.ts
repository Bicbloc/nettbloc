/**
 * Module de compatibilité pour migrer depuis les anciens services
 * Fournit les interfaces et fonctions utilisées par les composants legacy
 */

import { supabase } from '@/integrations/supabase/client';
import { pmsAdapterFactory } from './PmsAdapterFactory';
import { ExtractedRoom, CleaningType, StatusMapping } from './types';

// ==================== DetectionRule (depuis mewsDetectionService) ====================
export interface DetectionRule {
  id: string;
  hotel_id: string;
  created_by: string;
  rule_name: string;
  rule_type: 'reservation_block' | 'night_info' | 'status_keyword' | 'time_pattern' | 'date_pattern' | 'combined';
  condition: {
    pattern?: string;
    field?: string;
    operator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex_match';
    value?: string | number;
    hasGuest?: boolean;
    statusPattern?: string;
    timePosition?: 'left' | 'right';
  };
  result: {
    cleaning_type: CleaningType | 'none';
    status?: string;
  };
  priority: number;
  is_active: boolean;
  description?: string;
}

// ==================== PmsMatchResult (depuis patternLearningService) ====================
export interface PmsMatchResult {
  isMatch: boolean;
  expectedPms: string | null;
  detectedPms: string;
  matchScore: number;
  missingKeywords: string[];
  unexpectedKeywords: string[];
  confidence: number;
}

// ==================== ReservationBlock (depuis mewsDetectionService) ====================
export interface ReservationBlock {
  hasArrivalBlock: boolean;
  hasDepartureBlock: boolean;
  nightInfo: { current: number; total: number } | null;
  departureTime: string | null;
  arrivalTime: string | null;
  status: string | null;
  guestName: string | null;
  hasGuest: boolean;
  guestCount: number;
  checkInDate: string | null;
  checkOutDate: string | null;
  isOutOfOrder: boolean;
  timePosition: 'left' | 'right' | null;
}

// ==================== AnalysisResult ====================
export interface AnalysisResult {
  cleaningType: CleaningType | 'a_blanc' | 'recouche';
  confidence: number;
  matchedRule: string | null;
  hasGuest: boolean;
  rawStatus: string | null;
  detailedReason?: string;
  blocks: ReservationBlock;
}

// ==================== PmsPattern (depuis smartExtractionService) ====================
export interface PmsPattern {
  pms_type: string;
  room_number_regex: string;
  status_keywords: Record<string, { status: string; cleaning: string; priority: number }>;
  date_formats?: string[];
  context_window_size?: number;
  context_window?: number;
  priority?: number;
}

// ==================== Compatibilité mewsDetectionService ====================
class CompatMewsDetectionService {
  private hotelId: string | null = null;
  private customRules: DetectionRule[] = [];

  async loadCustomRules(hotelId: string): Promise<DetectionRule[]> {
    this.hotelId = hotelId;
    
    try {
      const { data, error } = await supabase
        .from('hotel_detection_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (!error && data) {
        this.customRules = data.map(d => ({
          id: d.id,
          hotel_id: d.hotel_id,
          created_by: d.created_by,
          rule_name: d.rule_name,
          rule_type: d.rule_type as DetectionRule['rule_type'],
          condition: d.condition as DetectionRule['condition'],
          result: d.result as DetectionRule['result'],
          priority: d.priority ?? 1,
          is_active: d.is_active ?? true,
          description: d.description ?? undefined
        }));
      }
    } catch (err) {
      console.error('Erreur chargement règles:', err);
    }

    return this.customRules;
  }

  analyzeLine(line: string): AnalysisResult {
    const lineUpper = line.toUpperCase();
    
    // Détecter les statuts basiques
    let cleaningType: CleaningType = 'none';
    let status: string | null = null;
    let matchedRule: string | null = null;
    let hasGuest = false;
    
    // Patterns de détection simples
    if (/\b(DIR|DEP|DEPART|CHECKOUT|OUT|Parti)\b/i.test(line)) {
      cleaningType = 'full';
      status = 'checkout';
      matchedRule = 'Départ détecté';
    } else if (/\b(Recouche|SAL|STAYOVER)\b/i.test(line)) {
      cleaningType = 'quick';
      status = 'stayover';
      matchedRule = 'Recouche détecté';
    } else if (/\b(INS|CL|CLEAN|Propre|A contrôler)\b/i.test(line)) {
      cleaningType = 'none';
      status = 'clean';
      matchedRule = 'Chambre propre';
    } else if (/\b(ARR|ARRIVAL|En arrivée|Arrivé)\b/i.test(line)) {
      cleaningType = 'full';
      status = 'arrival';
      matchedRule = 'Arrivée détectée';
    }
    
    // Détecter la présence d'un client
    hasGuest = /\d+\s*(Adults?|Adultes?)|Night\s+\d+\/\d+/i.test(line);
    
    // Créer le bloc de réservation basique
    const blocks: ReservationBlock = {
      hasArrivalBlock: /\b(ARR|ARRIVAL|En arrivée|Arrivé)\b/i.test(line),
      hasDepartureBlock: /\b(DIR|DEP|DEPART|OUT|Parti)\b/i.test(line),
      nightInfo: this.extractNightInfo(line),
      departureTime: null,
      arrivalTime: null,
      status,
      guestName: null,
      hasGuest,
      guestCount: 0,
      checkInDate: null,
      checkOutDate: null,
      isOutOfOrder: /\b(OOO|Out of order|HS|Hors service)\b/i.test(line),
      timePosition: null
    };

    return {
      cleaningType,
      confidence: matchedRule ? 85 : 50,
      matchedRule,
      hasGuest,
      rawStatus: status,
      blocks
    };
  }

  private extractNightInfo(line: string): { current: number; total: number } | null {
    const match = line.match(/Night\s+(\d+)\/(\d+)/i);
    if (match) {
      return { current: parseInt(match[1]), total: parseInt(match[2]) };
    }
    return null;
  }

  async saveRule(hotelId: string, rule: Partial<DetectionRule>): Promise<{ rule?: DetectionRule; error?: string }> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { error: 'Utilisateur non connecté' };
    }

    const { data, error } = await supabase
      .from('hotel_detection_rules')
      .insert({
        hotel_id: hotelId,
        created_by: user.user.id,
        rule_name: rule.rule_name,
        rule_type: rule.rule_type,
        condition: rule.condition,
        result: rule.result,
        priority: rule.priority ?? 1,
        is_active: rule.is_active ?? true,
        description: rule.description
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { rule: data as unknown as DetectionRule };
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    const { error } = await supabase
      .from('hotel_detection_rules')
      .delete()
      .eq('id', ruleId);

    return !error;
  }

  async toggleRule(ruleId: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('hotel_detection_rules')
      .update({ is_active: isActive })
      .eq('id', ruleId);

    return !error;
  }

  getDefaultRules(): DetectionRule[] {
    return [
      {
        id: 'default-1',
        hotel_id: '',
        created_by: 'system',
        rule_name: 'Départ = À Blanc',
        rule_type: 'status_keyword',
        condition: { pattern: '\\b(DIR|DEP|DEPART|Parti)\\b', operator: 'regex_match' },
        result: { cleaning_type: 'full', status: 'checkout' },
        priority: 10,
        is_active: true,
        description: 'Départ client → Nettoyage complet'
      },
      {
        id: 'default-2',
        hotel_id: '',
        created_by: 'system',
        rule_name: 'Recouche = Nettoyage rapide',
        rule_type: 'status_keyword',
        condition: { pattern: '\\b(Recouche|SAL|STAYOVER)\\b', operator: 'regex_match' },
        result: { cleaning_type: 'quick', status: 'stayover' },
        priority: 9,
        is_active: true,
        description: 'Client reste → Nettoyage rapide'
      }
    ];
  }

  getHotelCleaningRules(): any[] {
    return [];
  }
}

// ==================== Compatibilité smartExtractionService ====================
class CompatSmartExtractionService {
  async loadLearnedPatterns(hotelId: string): Promise<void> {
    // Déléguer au service unifié
    const { unifiedParserService } = await import('./UnifiedParserService');
    await unifiedParserService.loadHotelPatterns(hotelId);
  }

  extractRooms(text: string, pmsType?: string): ExtractedRoom[] {
    const adapter = pmsType ? pmsAdapterFactory.getAdapter(pmsType) : pmsAdapterFactory.detectPms(text).adapter;
    return adapter.extractRooms(text);
  }

  detectPmsType(text: string): string {
    const { detection } = pmsAdapterFactory.detectPms(text);
    return detection.pmsType;
  }

  getAvailablePmsTypes(): string[] {
    return pmsAdapterFactory.getAvailablePmsTypes();
  }
}

// ==================== Compatibilité patternLearningService ====================
class CompatPatternLearningService {
  async submitPatternImprovementRequest(
    hotelId: string,
    reportSample: string,
    unexpectedKeywords: string[],
    expectedPms: string | null,
    detectedPms: string,
    matchScore: number
  ): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { error } = await supabase
        .from('pattern_improvement_requests')
        .insert({
          hotel_id: hotelId,
          submitted_by: user.user.id,
          report_sample: reportSample.substring(0, 5000),
          expected_pms_type: expectedPms,
          detected_pms_type: detectedPms,
          detected_keywords: unexpectedKeywords,
          mismatch_score: matchScore,
          status: 'pending'
        });

      return !error;
    } catch (err) {
      console.error('Erreur soumission:', err);
      return false;
    }
  }
}

// Export des instances
export const mewsDetectionService = new CompatMewsDetectionService();
export const smartExtractionService = new CompatSmartExtractionService();
export const patternLearningService = new CompatPatternLearningService();
