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
  hasGuest: boolean;
  guestCount: number;
  checkInDate: string | null;
  checkOutDate: string | null;
  isOutOfOrder: boolean;
}

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
  };
  result: {
    cleaning_type: CleaningType | 'none';
    status?: string;
  };
  priority: number;
  is_active: boolean;
  description?: string;
}

// Règles par défaut pour Mews - AMÉLIORÉES avec logique départ = toujours à blanc
const DEFAULT_MEWS_RULES: Omit<DetectionRule, 'id' | 'hotel_id' | 'created_by'>[] = [
  // PRIORITÉ MAXIMALE: Out of order
  {
    rule_name: "Out of order = Aucun nettoyage",
    rule_type: "status_keyword",
    condition: { pattern: "\\b(Out of order|OOO|HS|Hors service)\\b", operator: "regex_match" },
    result: { cleaning_type: "none", status: "out_of_order" },
    priority: 20,
    is_active: true,
    description: "Chambre hors service - pas de nettoyage"
  },
  // PRIORITÉ HAUTE: DIR/DEP = TOUJOURS À Blanc (peu importe le statut ou client)
  {
    rule_name: "DIR/DEP = À Blanc (départ)",
    rule_type: "status_keyword",
    condition: { 
      pattern: "\\b(DIR|DEP|DEPART|CHECKOUT|OUT)\\b", 
      operator: "regex_match" 
    },
    result: { cleaning_type: "a_blanc", status: "checkout" },
    priority: 17,
    is_active: true,
    description: "Départ = TOUJOURS À Blanc, peu importe le statut"
  },
  // Chambre vide (VAC) + INS = Propre (pas de nettoyage)
  {
    rule_name: "VAC + INS/SAL = Propre",
    rule_type: "combined",
    condition: { 
      statusPattern: "\\b(VAC|VACANT)\\b.*\\b(INS|SAL)\\b|\\b(INS|SAL)\\b.*\\b(VAC|VACANT)\\b", 
      hasGuest: false 
    },
    result: { cleaning_type: "none", status: "clean" },
    priority: 16,
    is_active: true,
    description: "Chambre vacante et propre - aucun nettoyage"
  },
  // INS/SAL sans client = Propre (pas de nettoyage)
  {
    rule_name: "INS/SAL sans client = Propre",
    rule_type: "combined",
    condition: { 
      statusPattern: "\\b(INS|SAL)\\b", 
      hasGuest: false 
    },
    result: { cleaning_type: "none", status: "clean" },
    priority: 15,
    is_active: true,
    description: "Chambre vide et propre - aucun nettoyage nécessaire"
  },
  // Règle Nuit X/Y (X > 1) = Recouche
  {
    rule_name: "Nuit 2+ = Recouche",
    rule_type: "night_info",
    condition: { field: "nightInfo.current", operator: "greater_than", value: 1 },
    result: { cleaning_type: "recouche", status: "stayover" },
    priority: 12,
    is_active: true,
    description: "Si 'Nuit X/Y' avec X > 1, le client reste → Recouche"
  },
  // Nuit 1 = À Blanc (arrivée)
  {
    rule_name: "Nuit 1 = À Blanc (arrivée)",
    rule_type: "night_info",
    condition: { field: "nightInfo.current", operator: "equals", value: 1 },
    result: { cleaning_type: "a_blanc", status: "arrival" },
    priority: 11,
    is_active: true,
    description: "Si 'Nuit 1/N', premier jour du client → À Blanc"
  },
  // Arrivée seule (15:00) = À Blanc
  {
    rule_name: "Arrivée seule = À Blanc",
    rule_type: "reservation_block",
    condition: { field: "blocks", operator: "equals", value: "arrival_only" },
    result: { cleaning_type: "a_blanc", status: "arrival" },
    priority: 10,
    is_active: true,
    description: "Heure d'arrivée seule (14:00-19:00) = À Blanc préparation"
  },
  // Départ + Arrivée même ligne = À Blanc
  {
    rule_name: "Départ + Arrivée même ligne = À Blanc",
    rule_type: "reservation_block",
    condition: { field: "blocks", operator: "equals", value: "departure_and_arrival" },
    result: { cleaning_type: "a_blanc", status: "checkout_checkin" },
    priority: 9,
    is_active: true,
    description: "2 blocs de réservation (départ + arrivée) = À Blanc"
  },
  // Départ seul = À Blanc
  {
    rule_name: "Départ seul = À Blanc",
    rule_type: "reservation_block",
    condition: { field: "blocks", operator: "equals", value: "departure_only" },
    result: { cleaning_type: "a_blanc", status: "checkout" },
    priority: 8,
    is_active: true,
    description: "Bloc de départ sans arrivée suivante = À Blanc"
  },
  // INS avec client = Recouche
  {
    rule_name: "INS avec client = Recouche",
    rule_type: "status_keyword",
    condition: { pattern: "\\bINS\\b", operator: "regex_match" },
    result: { cleaning_type: "recouche", status: "stayover" },
    priority: 6,
    is_active: true,
    description: "Statut INS (In Stay) avec client = Recouche"
  },
  // Statut SAL avec client = Recouche
  {
    rule_name: "SAL avec client = Recouche",
    rule_type: "status_keyword",
    condition: { pattern: "\\bSAL\\b", operator: "regex_match" },
    result: { cleaning_type: "recouche", status: "stayover" },
    priority: 5,
    is_active: true,
    description: "Statut SAL (Sale) = Client reste → Recouche"
  },
  // Statut DIR/DEP = À Blanc
  {
    rule_name: "Statut DIR/DEP = À Blanc",
    rule_type: "status_keyword",
    condition: { pattern: "\\b(DIR|DEP|DEPART)\\b", operator: "regex_match" },
    result: { cleaning_type: "a_blanc", status: "checkout" },
    priority: 4,
    is_active: true,
    description: "Statut DIR/DEP/DEPART = À Blanc"
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

  // Liste de noms/mots de staff à exclure (pas des clients)
  private static readonly STAFF_EXCLUSIONS = [
    // Rôles
    'superviseur', 'supervisor', 'manager', 'directeur', 'director', 'chef',
    'gouvernante', 'housekeeper', 'réceptionniste', 'receptionist', 'concierge',
    'technicien', 'technician', 'maintenance', 'équipier', 'agent',
    // Noms connus de staff (à enrichir selon les hôtels)
    'farid', 'admin', 'test', 'system', 'système',
    // Mots-clés techniques
    'out', 'nuit', 'night', 'room', 'chambre', 'cleaning', 'ménage',
    'sal', 'dir', 'ins', 'dep', 'arr', 'ooo', 'oos', 'dnd', 'vac', 'occ'
  ];

  /**
   * Détecter la présence d'un client dans une ligne
   * Exclut les noms de staff/superviseurs
   */
  detectGuestPresence(line: string): { hasGuest: boolean; guestName: string | null; guestCount: number; isStaff: boolean } {
    // Pattern pour détecter "X × Adultes" ou "X Adults" suivi d'un nom
    const adultCountMatch = line.match(/(\d+)\s*[×x]\s*(?:Adultes?|Adults?)/i);
    const guestCount = adultCountMatch ? parseInt(adultCountMatch[1]) : 0;

    // Chercher les noms propres (format Prénom NOM ou NOM Prénom)
    // Pattern amélioré pour noms avec majuscules
    const namePatterns = [
      // "Prénom NOM" ou "NOM Prénom" après Adultes
      /(?:Adultes?|Adults?)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*(?:\s+[A-ZÀ-Ÿ]{2,})?)/i,
      // Noms en MAJUSCULES
      /\b([A-ZÀ-Ÿ]{2,}\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)\b/,
      // Pattern mixte "Jean DUPONT"
      /\b([A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ]{2,})\b/,
      // Deux noms consécutifs (ex: "Joy VanDeMortel")
      /\b([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zA-Zà-ÿ]+){1,3})\b/
    ];

    let guestName: string | null = null;
    let isStaff = false;
    
    for (const pattern of namePatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const potentialName = match[1].trim().toLowerCase();
        
        // Vérifier si c'est un nom de staff à exclure
        const isExcluded = MewsDetectionService.STAFF_EXCLUSIONS.some(exclusion => 
          potentialName.includes(exclusion) || exclusion === potentialName.split(' ')[0]
        );
        
        if (isExcluded) {
          isStaff = true;
          continue; // Passer au pattern suivant
        }
        
        guestName = match[1].trim();
        break;
      }
    }

    // Déterminer s'il y a un client (pas un staff)
    const hasGuest = !isStaff && (guestCount > 0 || guestName !== null);

    return { hasGuest, guestName, guestCount, isStaff };
  }

  /**
   * Détecter les blocs de réservation Mews dans une ligne
   */
  detectReservationBlocks(line: string): ReservationBlock {
    // Chercher "Nuit X/Y" ou "Night X/Y"
    const nightMatch = line.match(/(?:Nuit|Night)\s+(\d+)\/(\d+)/i);
    
    // Chercher les heures de départ (08:00-12:00) et arrivée (14:00-19:00)
    const departureTimeMatch = line.match(/\b(0?[5-9]|1[0-2]):\d{2}\b/);
    const arrivalTimeMatch = line.match(/\b(1[4-9]):\d{2}\b/);
    
    // Chercher les statuts
    const statusMatch = line.match(/\b(SAL|DIR|DEP|INS|ARR|DEPART|ARRIVEE|STAYOVER|CHECKOUT|CHECKIN)\b/i);
    
    // Détecter Out of order
    const isOutOfOrder = /\b(Out of order|OOO|HS|Hors service)\b/i.test(line);
    
    // Détecter présence client
    const guestPresence = this.detectGuestPresence(line);
    
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
      guestName: guestPresence.guestName,
      hasGuest: guestPresence.hasGuest,
      guestCount: guestPresence.guestCount,
      checkInDate: dates.length > 0 ? dates[0] : null,
      checkOutDate: dates.length > 1 ? dates[1] : null,
      isOutOfOrder
    };
  }

  /**
   * Déterminer le type de nettoyage à partir des blocs détectés
   */
  determineCleaningType(blocks: ReservationBlock, line: string): { 
    cleaningType: CleaningType | 'none'; 
    confidence: number;
    matchedRule: string | null;
    status: string | null;
    detailedReason: string;
  } {
    const rules = this.getAllRules();
    
    for (const rule of rules) {
      const match = this.evaluateRule(rule, blocks, line);
      if (match) {
        // Construire la raison détaillée
        let detailedReason = rule.rule_name;
        if (blocks.nightInfo) {
          detailedReason += ` (Nuit ${blocks.nightInfo.current}/${blocks.nightInfo.total})`;
        }
        if (blocks.status) {
          detailedReason += ` [${blocks.status}]`;
        }
        if (!blocks.hasGuest && (blocks.status === 'INS' || blocks.status === 'SAL')) {
          detailedReason += ' - Chambre vide';
        }

        return {
          cleaningType: rule.result.cleaning_type === 'none' ? 'none' : normalizeCleaningType(rule.result.cleaning_type),
          confidence: 0.9 - (0.1 * (20 - rule.priority) / 20),
          matchedRule: rule.rule_name,
          status: rule.result.status || null,
          detailedReason
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
      case 'combined':
        // Règle combinée : vérifie statut ET présence client
        if (condition.statusPattern) {
          try {
            const regex = new RegExp(condition.statusPattern, 'i');
            const statusMatches = regex.test(line);
            if (!statusMatches) return false;
          } catch {
            return false;
          }
        }
        // Vérifier la condition hasGuest
        if (condition.hasGuest !== undefined) {
          if (condition.hasGuest !== blocks.hasGuest) return false;
        }
        return true;

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
    cleaningType: CleaningType | 'none';
    confidence: number;
    matchedRule: string | null;
    status: string | null;
    detailedReason: string;
  } {
    // Out of order = Aucun nettoyage
    if (blocks.isOutOfOrder) {
      return { 
        cleaningType: 'none', 
        confidence: 0.95, 
        matchedRule: 'Fallback: Out of order',
        status: 'out_of_order',
        detailedReason: 'Chambre hors service - aucun nettoyage'
      };
    }

    // INS/SAL sans client = Propre (aucun nettoyage)
    if ((blocks.status === 'INS' || blocks.status === 'SAL') && !blocks.hasGuest) {
      return { 
        cleaningType: 'none', 
        confidence: 0.85, 
        matchedRule: 'Fallback: INS/SAL sans client',
        status: 'clean',
        detailedReason: `${blocks.status} sans client = Chambre propre, pas de nettoyage`
      };
    }

    // Client reste (Nuit 2+)
    if (blocks.nightInfo && blocks.nightInfo.current > 1) {
      return { 
        cleaningType: 'recouche', 
        confidence: 0.8, 
        matchedRule: 'Fallback: Nuit > 1',
        status: 'stayover',
        detailedReason: `Nuit ${blocks.nightInfo.current}/${blocks.nightInfo.total} = Client reste → Recouche`
      };
    }
    
    // Départ + Arrivée même ligne = À Blanc
    if (blocks.hasDepartureBlock && blocks.hasArrivalBlock) {
      return { 
        cleaningType: 'a_blanc', 
        confidence: 0.85, 
        matchedRule: 'Fallback: Départ + Arrivée',
        status: 'checkout_checkin',
        detailedReason: `Départ ${blocks.departureTime} + Arrivée ${blocks.arrivalTime} = À Blanc`
      };
    }
    
    // Premier jour ou départ seul
    if (blocks.nightInfo?.current === 1 || blocks.hasDepartureBlock) {
      return { 
        cleaningType: 'a_blanc', 
        confidence: 0.7, 
        matchedRule: 'Fallback: Premier jour ou départ',
        status: 'checkout',
        detailedReason: blocks.nightInfo?.current === 1 
          ? 'Nuit 1 = Premier jour client → À Blanc' 
          : `Départ ${blocks.departureTime} = À Blanc`
      };
    }
    
    // Status SAL/INS avec client = Recouche
    if (blocks.status && ['SAL', 'INS', 'STAYOVER'].includes(blocks.status) && blocks.hasGuest) {
      return { 
        cleaningType: 'recouche', 
        confidence: 0.75, 
        matchedRule: 'Fallback: Statut SAL/INS avec client',
        status: 'stayover',
        detailedReason: `${blocks.status} avec client ${blocks.guestName || ''} = Recouche`
      };
    }

    // Par défaut = À Blanc (plus sûr)
    return { 
      cleaningType: 'a_blanc', 
      confidence: 0.5, 
      matchedRule: null,
      status: null,
      detailedReason: 'Règle par défaut = À Blanc (plus sûr)'
    };
  }

  /**
   * Analyser une ligne complète et retourner le résultat
   */
  analyzeLine(line: string): {
    blocks: ReservationBlock;
    cleaningType: CleaningType | 'none';
    confidence: number;
    matchedRule: string | null;
    status: string | null;
    detailedReason: string;
    hasGuest: boolean;
    rawStatus: string | null;
  } {
    const blocks = this.detectReservationBlocks(line);
    const result = this.determineCleaningType(blocks, line);
    
    return {
      blocks,
      ...result,
      hasGuest: blocks.hasGuest,
      rawStatus: blocks.status
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
