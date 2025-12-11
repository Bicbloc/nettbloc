import { CleaningType, NormalizedCleaningType, normalizeCleaningType } from './types';

/**
 * Interface pour les conditions de règle de nettoyage
 */
export interface CleaningCondition {
  statusCode?: string[];           // DIR, INS, SAL, etc.
  hasArrival?: boolean;            // Présence d'une arrivée
  hasDeparture?: boolean;          // Présence d'un départ
  nightCurrent?: number;           // Nuit actuelle (X dans Nuit X/Y)
  nightTotal?: number;             // Total nuits (Y dans Nuit X/Y)
  isLastNight?: boolean;           // nightCurrent === nightTotal
  isOvernightStay?: boolean;       // nightCurrent < nightTotal
  guestBlocks?: number;            // Nombre de blocs de guests (>1 = départ+arrivée)
  departureToday?: boolean;        // Date départ = aujourd'hui
  arrivalToday?: boolean;          // Date arrivée = aujourd'hui
  isOutOfOrder?: boolean;          // Chambre hors service
  rawStatus?: string;              // Statut brut du PMS
}

/**
 * Interface pour une règle de nettoyage
 */
export interface CleaningRule {
  name: string;
  description: string;
  priority: number;                // Plus haut = plus prioritaire
  conditions: CleaningCondition;
  result: {
    cleaningType: NormalizedCleaningType;
    status: string;
    reason: string;
  };
}

/**
 * Règles par défaut pour déterminer le type de nettoyage
 * Ces règles sont appliquées dans l'ordre de priorité (du plus haut au plus bas)
 */
export const DEFAULT_CLEANING_RULES: CleaningRule[] = [
  // Règle 1: Out of Order → Aucun nettoyage
  {
    name: 'out_of_order',
    description: 'Chambre hors service',
    priority: 100,
    conditions: { isOutOfOrder: true },
    result: { cleaningType: 'none', status: 'out_of_order', reason: 'Chambre hors service' }
  },
  
  // Règle 2: Chambre propre (INS) → Aucun nettoyage
  {
    name: 'inspected_clean',
    description: 'Chambre inspectée/propre',
    priority: 90,
    conditions: { statusCode: ['INS', 'CLEAN', 'PROPRE'] },
    result: { cleaningType: 'none', status: 'clean', reason: 'Chambre déjà propre' }
  },
  
  // Règle 3: Départ + Arrivée (2 blocs) → À blanc
  {
    name: 'checkout_checkin',
    description: 'Départ et arrivée le même jour',
    priority: 80,
    conditions: { guestBlocks: 2 },
    result: { cleaningType: 'a_blanc', status: 'checkout_checkin', reason: 'Départ + Arrivée = Nettoyage complet' }
  },
  
  // Règle 4: Dernière nuit (Nuit X/X) → À blanc (départ)
  {
    name: 'last_night_checkout',
    description: 'Dernière nuit du séjour',
    priority: 70,
    conditions: { isLastNight: true },
    result: { cleaningType: 'a_blanc', status: 'checkout', reason: 'Dernier jour = Départ prévu' }
  },
  
  // Règle 5: Client reste (Nuit X < Y) → Recouche
  {
    name: 'overnight_stay',
    description: 'Client reste une nuit supplémentaire',
    priority: 60,
    conditions: { isOvernightStay: true },
    result: { cleaningType: 'recouche', status: 'occupied', reason: 'Client reste = Nettoyage rapide' }
  },
  
  // Règle 6: DIR sans info → À blanc par défaut
  {
    name: 'dirty_default',
    description: 'Chambre sale par défaut',
    priority: 10,
    conditions: { statusCode: ['DIR', 'SAL', 'DIRTY', 'SALE'] },
    result: { cleaningType: 'a_blanc', status: 'dirty', reason: 'Chambre sale = Nettoyage complet' }
  },
  
  // Règle 7: Fallback → À blanc
  {
    name: 'fallback',
    description: 'Règle par défaut',
    priority: 0,
    conditions: {},
    result: { cleaningType: 'a_blanc', status: 'unknown', reason: 'Défaut = Nettoyage complet' }
  }
];

/**
 * CleaningTypeResolver - Résout le type de nettoyage basé sur les conditions
 */
export class CleaningTypeResolver {
  private rules: CleaningRule[];

  constructor(customRules?: CleaningRule[]) {
    // Fusionner les règles personnalisées avec les règles par défaut
    if (customRules && customRules.length > 0) {
      this.rules = [...customRules, ...DEFAULT_CLEANING_RULES];
    } else {
      this.rules = DEFAULT_CLEANING_RULES;
    }
    
    // Trier par priorité décroissante
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Résout le type de nettoyage basé sur les conditions fournies
   */
  resolve(conditions: CleaningCondition): {
    cleaningType: NormalizedCleaningType;
    status: string;
    reason: string;
    matchedRule: string;
  } {
    // Pré-calculer les conditions dérivées
    const enrichedConditions = this.enrichConditions(conditions);

    // Trouver la première règle qui matche
    for (const rule of this.rules) {
      if (this.matchesRule(enrichedConditions, rule.conditions)) {
        return {
          ...rule.result,
          matchedRule: rule.name
        };
      }
    }

    // Fallback (ne devrait jamais arriver avec la règle fallback)
    return {
      cleaningType: 'a_blanc',
      status: 'unknown',
      reason: 'Aucune règle applicable',
      matchedRule: 'none'
    };
  }

  /**
   * Enrichit les conditions avec des valeurs dérivées
   */
  private enrichConditions(conditions: CleaningCondition): CleaningCondition {
    const enriched = { ...conditions };

    // Calculer isLastNight
    if (conditions.nightCurrent !== undefined && conditions.nightTotal !== undefined) {
      enriched.isLastNight = conditions.nightCurrent >= conditions.nightTotal && conditions.nightTotal > 0;
      enriched.isOvernightStay = conditions.nightCurrent < conditions.nightTotal && conditions.nightTotal > 0;
    }

    // Détecter guestBlocks >= 2 comme départ+arrivée
    if (conditions.guestBlocks !== undefined && conditions.guestBlocks >= 2) {
      enriched.hasArrival = true;
      enriched.hasDeparture = true;
    }

    return enriched;
  }

  /**
   * Vérifie si les conditions correspondent à une règle
   */
  private matchesRule(conditions: CleaningCondition, ruleConditions: CleaningCondition): boolean {
    // Si la règle n'a pas de conditions, elle matche toujours (fallback)
    if (Object.keys(ruleConditions).length === 0) {
      return true;
    }

    // Vérifier chaque condition de la règle
    for (const [key, ruleValue] of Object.entries(ruleConditions)) {
      const conditionValue = conditions[key as keyof CleaningCondition];

      // Gestion des tableaux (statusCode, etc.)
      if (Array.isArray(ruleValue)) {
        if (typeof conditionValue === 'string') {
          if (!ruleValue.map(v => v.toUpperCase()).includes(conditionValue.toUpperCase())) {
            return false;
          }
        } else {
          return false;
        }
      }
      // Gestion des nombres (guestBlocks >= 2)
      else if (typeof ruleValue === 'number') {
        if (typeof conditionValue !== 'number' || conditionValue < ruleValue) {
          return false;
        }
      }
      // Gestion des booléens
      else if (typeof ruleValue === 'boolean') {
        if (conditionValue !== ruleValue) {
          return false;
        }
      }
      // Autres types
      else if (conditionValue !== ruleValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Crée un resolver à partir d'une ligne de texte brut
   */
  static fromRawLine(line: string, statusCode: string): {
    cleaningType: NormalizedCleaningType;
    status: string;
    reason: string;
  } {
    const resolver = new CleaningTypeResolver();

    // Extraire les informations de la ligne
    const nightMatch = line.match(/(?:Night|Nuit|Nacht|Notte|Noche)\s*(\d+)\s*[\/\\]\s*(\d+)/i);
    const guestBlocks = (line.match(/(\d+)\s*[×x]\s*(?:Adults?|Adultes?)/gi) || []).length;
    const isOutOfOrder = /Out of (?:order|service)/i.test(line);

    const conditions: CleaningCondition = {
      statusCode: [statusCode],
      guestBlocks,
      isOutOfOrder,
      nightCurrent: nightMatch ? parseInt(nightMatch[1]) : undefined,
      nightTotal: nightMatch ? parseInt(nightMatch[2]) : undefined
    };

    const result = resolver.resolve(conditions);
    return {
      cleaningType: result.cleaningType,
      status: result.status,
      reason: result.reason
    };
  }
}

/**
 * Fonction utilitaire pour résoudre rapidement un type de nettoyage
 */
export function resolveCleaningType(
  statusCode: string,
  options?: {
    nightCurrent?: number;
    nightTotal?: number;
    guestBlocks?: number;
    isOutOfOrder?: boolean;
  }
): NormalizedCleaningType {
  const resolver = new CleaningTypeResolver();
  
  const conditions: CleaningCondition = {
    statusCode: [statusCode],
    ...options
  };

  return resolver.resolve(conditions).cleaningType;
}
