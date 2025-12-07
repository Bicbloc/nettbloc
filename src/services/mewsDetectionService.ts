// Service de détection intelligente pour les rapports Mews et autres PMS
// Analyse les blocs de réservation pour déterminer le type de nettoyage

import { supabase } from "@/integrations/supabase/client";
import { normalizeCleaningType, CleaningType } from "@/utils/cleaningTypeUtils";

export interface ReservationBlock {
  hasArrivalBlock: boolean;
  hasDepartureBlock: boolean;
  nightInfo: { current: number; total: number } | null;
  departureTime: string | null;
  arrivalTime: string | null;
  status: string | null;
  guestName: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
}

export interface DetectionRule {
  id: string;
  hotel_id: string;
  created_by: string;
  rule_name: string;
  rule_type: 'reservation_block' | 'night_info' | 'status_keyword' | 'time_pattern' | 'date_pattern';
  condition: {
    pattern?: string;
    field?: string;
    operator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex_match';
    value?: string | number;
  };
  result: {
    cleaning_type: CleaningType;
    status?: string;
  };
  priority: number;
  is_active: boolean;
  description?: string;
}

// Règles par défaut pour Mews
const DEFAULT_MEWS_RULES: Omit<DetectionRule, 'id' | 'hotel_id' | 'created_by'>[] = [
  {
    rule_name: "Nuit 2+ = Recouche",
    rule_type: "night_info",
    condition: { field: "nightInfo.current", operator: "greater_than", value: 1 },
    result: { cleaning_type: "recouche", status: "stayover" },
    priority: 10,
    is_active: true,
    description: "Si 'Nuit X/Y' avec X > 1, le client reste → Recouche"
  },
  {
    rule_name: "Nuit 1 = À Blanc (arrivée)",
    rule_type: "night_info",
    condition: { field: "nightInfo.current", operator: "equals", value: 1 },
    result: { cleaning_type: "a_blanc", status: "arrival" },
    priority: 9,
    is_active: true,
    description: "Si 'Nuit 1/N', premier jour du client → À Blanc"
  },
  {
    rule_name: "Départ + Arrivée même ligne = À Blanc",
    rule_type: "reservation_block",
    condition: { field: "blocks", operator: "equals", value: "departure_and_arrival" },
    result: { cleaning_type: "a_blanc", status: "checkout_checkin" },
    priority: 8,
    is_active: true,
    description: "2 blocs de réservation (départ 11:00 + arrivée 15:00) = À Blanc"
  },
  {
    rule_name: "Départ seul = À Blanc",
    rule_type: "reservation_block",
    condition: { field: "blocks", operator: "equals", value: "departure_only" },
    result: { cleaning_type: "a_blanc", status: "checkout" },
    priority: 7,
    is_active: true,
    description: "Bloc de départ sans arrivée suivante = À Blanc"
  },
  {
    rule_name: "Statut SAL = Recouche",
    rule_type: "status_keyword",
    condition: { pattern: "\\bSAL\\b", operator: "regex_match" },
    result: { cleaning_type: "recouche", status: "stayover" },
    priority: 5,
    is_active: true,
    description: "Statut SAL (Sale) = Client reste → Recouche"
  },
  {
    rule_name: "Statut DIR/DEP = À Blanc",
    rule_type: "status_keyword",
    condition: { pattern: "\\b(DIR|DEP|DEPART)\\b", operator: "regex_match" },
    result: { cleaning_type: "a_blanc", status: "checkout" },
    priority: 5,
    is_active: true,
    description: "Statut DIR/DEP/DEPART = À Blanc"
  },
  {
    rule_name: "Statut INS = Recouche",
    rule_type: "status_keyword",
    condition: { pattern: "\\bINS\\b", operator: "regex_match" },
    result: { cleaning_type: "recouche", status: "stayover" },
    priority: 5,
    is_active: true,
    description: "Statut INS (In Stay) = Client reste → Recouche"
  }
];

class MewsDetectionService {
  private customRules: DetectionRule[] = [];
  private hotelId: string | null = null;

  /**
   * Charger les règles personnalisées d'un hôtel
   */
  async loadCustomRules(hotelId: string): Promise<DetectionRule[]> {
    this.hotelId = hotelId;
    
    try {
      const { data, error } = await supabase
        .from('hotel_detection_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Erreur chargement règles:', error);
        return [];
      }

      this.customRules = (data || []).map(d => ({
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
      return this.customRules;
    } catch (err) {
      console.error('Erreur:', err);
      return [];
    }
  }

  /**
   * Obtenir toutes les règles (personnalisées + défaut)
   */
  getAllRules(): (DetectionRule | Omit<DetectionRule, 'id' | 'hotel_id' | 'created_by'>)[] {
    // Règles personnalisées ont priorité sur les règles par défaut
    return [...this.customRules, ...DEFAULT_MEWS_RULES]
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Détecter les blocs de réservation Mews dans une ligne
   */
  detectReservationBlocks(line: string): ReservationBlock {
    // Chercher "Nuit X/Y" ou "Night X/Y"
    const nightMatch = line.match(/(?:Nuit|Night)\s+(\d+)\/(\d+)/i);
    
    // Chercher les heures de départ (10:00, 11:00, 12:00) et arrivée (14:00, 15:00, 16:00)
    const departureTimeMatch = line.match(/\b(0?[89]|1[0-2]):00\b/);
    const arrivalTimeMatch = line.match(/\b(1[4-8]|19):00\b/);
    
    // Chercher les statuts
    const statusMatch = line.match(/\b(SAL|DIR|DEP|INS|ARR|DEPART|ARRIVEE|STAYOVER|CHECKOUT|CHECKIN)\b/i);
    
    // Chercher les noms (après le nombre d'adultes)
    const guestMatch = line.match(/(?:Adultes?|Adults?)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i);
    
    // Chercher les dates (format DD/MM/YYYY ou YYYY-MM-DD)
    const dates = line.match(/\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g) || [];
    
    return {
      hasArrivalBlock: !!arrivalTimeMatch,
      hasDepartureBlock: !!departureTimeMatch,
      nightInfo: nightMatch ? { 
        current: parseInt(nightMatch[1]), 
        total: parseInt(nightMatch[2]) 
      } : null,
      departureTime: departureTimeMatch ? departureTimeMatch[0] : null,
      arrivalTime: arrivalTimeMatch ? arrivalTimeMatch[0] : null,
      status: statusMatch ? statusMatch[1].toUpperCase() : null,
      guestName: guestMatch ? guestMatch[1] : null,
      checkInDate: dates.length > 0 ? dates[0] : null,
      checkOutDate: dates.length > 1 ? dates[1] : null
    };
  }

  /**
   * Déterminer le type de nettoyage à partir des blocs détectés
   */
  determineCleaningType(blocks: ReservationBlock, line: string): { 
    cleaningType: CleaningType; 
    confidence: number;
    matchedRule: string | null;
    status: string | null;
  } {
    const rules = this.getAllRules();
    
    for (const rule of rules) {
      const match = this.evaluateRule(rule, blocks, line);
      if (match) {
        return {
          cleaningType: normalizeCleaningType(rule.result.cleaning_type),
          confidence: 0.9 - (0.1 * (10 - rule.priority) / 10), // Confiance basée sur priorité
          matchedRule: rule.rule_name,
          status: rule.result.status || null
        };
      }
    }

    // Fallback basé sur la logique simple
    return this.fallbackDetermination(blocks);
  }

  /**
   * Évaluer si une règle correspond
   */
  private evaluateRule(
    rule: DetectionRule | Omit<DetectionRule, 'id' | 'hotel_id' | 'created_by'>, 
    blocks: ReservationBlock, 
    line: string
  ): boolean {
    const { condition } = rule;

    switch (rule.rule_type) {
      case 'night_info':
        if (!blocks.nightInfo) return false;
        const nightValue = condition.field === 'nightInfo.current' 
          ? blocks.nightInfo.current 
          : blocks.nightInfo.total;
        return this.compareValues(nightValue, condition.operator!, condition.value as number);

      case 'reservation_block':
        if (condition.value === 'departure_and_arrival') {
          return blocks.hasDepartureBlock && blocks.hasArrivalBlock;
        } else if (condition.value === 'departure_only') {
          return blocks.hasDepartureBlock && !blocks.hasArrivalBlock;
        } else if (condition.value === 'arrival_only') {
          return blocks.hasArrivalBlock && !blocks.hasDepartureBlock;
        }
        return false;

      case 'status_keyword':
        if (!condition.pattern) return false;
        try {
          const regex = new RegExp(condition.pattern, 'i');
          return regex.test(line);
        } catch {
          return false;
        }

      case 'time_pattern':
      case 'date_pattern':
        if (!condition.pattern) return false;
        try {
          const regex = new RegExp(condition.pattern, 'i');
          return regex.test(line);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Comparer des valeurs numériques
   */
  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case 'equals': return actual === expected;
      case 'greater_than': return actual > expected;
      case 'less_than': return actual < expected;
      default: return false;
    }
  }

  /**
   * Détermination de secours si aucune règle ne correspond
   */
  private fallbackDetermination(blocks: ReservationBlock): {
    cleaningType: CleaningType;
    confidence: number;
    matchedRule: string | null;
    status: string | null;
  } {
    // Client reste (Nuit 2+)
    if (blocks.nightInfo && blocks.nightInfo.current > 1) {
      return { 
        cleaningType: 'recouche', 
        confidence: 0.8, 
        matchedRule: 'Fallback: Nuit > 1',
        status: 'stayover'
      };
    }
    
    // Départ + Arrivée même ligne = À Blanc
    if (blocks.hasDepartureBlock && blocks.hasArrivalBlock) {
      return { 
        cleaningType: 'a_blanc', 
        confidence: 0.85, 
        matchedRule: 'Fallback: Départ + Arrivée',
        status: 'checkout_checkin'
      };
    }
    
    // Premier jour ou départ seul
    if (blocks.nightInfo?.current === 1 || blocks.hasDepartureBlock) {
      return { 
        cleaningType: 'a_blanc', 
        confidence: 0.7, 
        matchedRule: 'Fallback: Premier jour ou départ',
        status: 'checkout'
      };
    }
    
    // Status SAL/INS = Recouche
    if (blocks.status && ['SAL', 'INS', 'STAYOVER'].includes(blocks.status)) {
      return { 
        cleaningType: 'recouche', 
        confidence: 0.75, 
        matchedRule: 'Fallback: Statut SAL/INS',
        status: 'stayover'
      };
    }

    // Par défaut = À Blanc (plus sûr)
    return { 
      cleaningType: 'a_blanc', 
      confidence: 0.5, 
      matchedRule: null,
      status: null
    };
  }

  /**
   * Analyser une ligne complète et retourner le résultat
   */
  analyzeLine(line: string): {
    blocks: ReservationBlock;
    cleaningType: CleaningType;
    confidence: number;
    matchedRule: string | null;
    status: string | null;
  } {
    const blocks = this.detectReservationBlocks(line);
    const result = this.determineCleaningType(blocks, line);
    
    return {
      blocks,
      ...result
    };
  }

  /**
   * Sauvegarder une nouvelle règle personnalisée
   */
  async saveRule(hotelId: string, userId: string, rule: Omit<DetectionRule, 'id' | 'hotel_id' | 'created_by'>): Promise<DetectionRule | null> {
    try {
      const { data, error } = await supabase
        .from('hotel_detection_rules')
        .insert({
          hotel_id: hotelId,
          created_by: userId,
          rule_name: rule.rule_name,
          rule_type: rule.rule_type,
          condition: rule.condition,
          result: rule.result,
          priority: rule.priority,
          is_active: rule.is_active,
          description: rule.description
        })
        .select()
        .single();

      if (error || !data) {
        console.error('Erreur sauvegarde règle:', error);
        return null;
      }

      const savedRule: DetectionRule = {
        id: data.id,
        hotel_id: data.hotel_id,
        created_by: data.created_by,
        rule_name: data.rule_name,
        rule_type: data.rule_type as DetectionRule['rule_type'],
        condition: data.condition as DetectionRule['condition'],
        result: data.result as DetectionRule['result'],
        priority: data.priority ?? 1,
        is_active: data.is_active ?? true,
        description: data.description ?? undefined
      };

      // Recharger les règles
      await this.loadCustomRules(hotelId);
      return savedRule;
    } catch (err) {
      console.error('Erreur:', err);
      return null;
    }
  }

  /**
   * Supprimer une règle
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('hotel_detection_rules')
        .delete()
        .eq('id', ruleId);

      if (error) {
        console.error('Erreur suppression règle:', error);
        return false;
      }

      if (this.hotelId) {
        await this.loadCustomRules(this.hotelId);
      }
      return true;
    } catch (err) {
      console.error('Erreur:', err);
      return false;
    }
  }

  /**
   * Activer/désactiver une règle
   */
  async toggleRule(ruleId: string, isActive: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('hotel_detection_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) {
        console.error('Erreur toggle règle:', error);
        return false;
      }

      if (this.hotelId) {
        await this.loadCustomRules(this.hotelId);
      }
      return true;
    } catch (err) {
      console.error('Erreur:', err);
      return false;
    }
  }

  /**
   * Obtenir les règles par défaut
   */
  getDefaultRules(): Omit<DetectionRule, 'id' | 'hotel_id' | 'created_by'>[] {
    return DEFAULT_MEWS_RULES;
  }
}

export const mewsDetectionService = new MewsDetectionService();
