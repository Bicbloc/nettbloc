/**
 * Service unifié d'apprentissage des patterns PMS
 * Gère le chargement des patterns, la détection du PMS, et l'application des mots-clés appris
 */

import { supabase } from "@/integrations/supabase/client";

export interface LearnedPattern {
  id: string;
  hotelId: string;
  pmsType: string;
  roomFormat: string;
  statusKeywords: Record<string, { cleaning: 'full' | 'quick' | 'none'; status: string }>;
  combinationRules: CombinationRule[];
  dateFormats: string[];
  patternName: string;
}

export interface CombinationRule {
  conditions: string[];
  result: { cleaning: 'full' | 'quick' | 'none'; status: string };
}

export interface PmsMatchResult {
  isMatch: boolean;
  expectedPms: string | null;
  detectedPms: string;
  matchScore: number; // 0-100
  missingKeywords: string[];
  unexpectedKeywords: string[];
}

// Mots-clés par défaut par type de PMS (avec mapping vers type de nettoyage)
const DEFAULT_PMS_KEYWORDS: Record<string, string[]> = {
  apaleo: ['Recouche', 'Parti', 'En arrivée', 'Arrivé', 'A contrôler', 'Propre', 'PARTI', 'EN ARRIVÉE', 'ARRIVÉ', 'A CONTROLER'],
  mews: ['DIR', 'INS', 'SAL', 'OCC', 'VAC', 'CL', 'DEP', 'ARR', 'Adults', 'Night'],
  opera: ['DIRTY', 'CLEAN', 'INSPECTED', 'OUT OF ORDER', 'OOO', 'PICKUP', 'VACANT', 'DUE OUT'],
  medialog: ['DRAPS', 'RECOUCHE', 'BLANC', 'À BLANC', 'NE PAS NETTOYER', 'DÉPART'],
  protel: ['DIRTY', 'CLEAN', 'CHECKED OUT', 'OCCUPIED', 'VACANT', 'OUT OF ORDER'],
  fidelio: ['DRT', 'CLN', 'INS', 'OOO', 'OCC', 'VAC', 'DEP']
};

// Mapping par défaut des mots-clés vers type de nettoyage (utilisé quand pas de pattern appris)
const DEFAULT_KEYWORD_CLEANING_MAP: Record<string, { cleaning: 'full' | 'quick' | 'none'; status: string }> = {
  // Apaleo
  'RECOUCHE': { cleaning: 'quick', status: 'stayover' },
  'Recouche': { cleaning: 'quick', status: 'stayover' },
  'PARTI': { cleaning: 'full', status: 'checkout' },
  'Parti': { cleaning: 'full', status: 'checkout' },
  'EN ARRIVÉE': { cleaning: 'full', status: 'arrival' },
  'En arrivée': { cleaning: 'full', status: 'arrival' },
  'ARRIVÉ': { cleaning: 'none', status: 'occupied' },
  'Arrivé': { cleaning: 'none', status: 'occupied' },
  'A CONTROLER': { cleaning: 'none', status: 'clean' },
  'A contrôler': { cleaning: 'none', status: 'clean' },
  'PROPRE': { cleaning: 'none', status: 'clean' },
  'Propre': { cleaning: 'none', status: 'clean' },
  // Mews
  'DIR': { cleaning: 'full', status: 'checkout' },
  'INS': { cleaning: 'none', status: 'clean' },
  'SAL': { cleaning: 'quick', status: 'stayover' },
  'DEP': { cleaning: 'full', status: 'checkout' },
  'ARR': { cleaning: 'full', status: 'arrival' },
  'OCC': { cleaning: 'quick', status: 'stayover' },
  'VAC': { cleaning: 'none', status: 'clean' },
};

// Règles de combinaison par défaut pour Apaleo
const APALEO_COMBINATION_RULES: CombinationRule[] = [
  // Départ + Arrivée même chambre = À blanc
  { conditions: ['Parti', 'En arrivée'], result: { cleaning: 'full', status: 'checkout_arrival' } },
  { conditions: ['DEPART', 'ARRIVEE'], result: { cleaning: 'full', status: 'checkout_arrival' } },
  // Arrivée + À contrôler = Propre (chambre déjà prête)
  { conditions: ['En arrivée', 'A contrôler'], result: { cleaning: 'none', status: 'clean' } },
  { conditions: ['Arrivé', 'A contrôler'], result: { cleaning: 'none', status: 'clean' } },
];

class PatternLearningService {
  private hotelPatterns: Map<string, LearnedPattern> = new Map();
  private expectedPmsType: string | null = null;

  /**
   * Charger le pattern complet d'un hôtel (format + mots-clés + règles de combinaison)
   */
  async loadHotelPattern(hotelId: string): Promise<LearnedPattern | null> {
    // Vérifier le cache
    const cached = this.hotelPatterns.get(hotelId);
    if (cached) {
      console.log(`📦 Pattern en cache pour ${hotelId}: ${cached.pmsType}`);
      return cached;
    }

    try {
      // Charger les patterns: créés par cet hôtel OU assignés à cet hôtel
      const { data, error } = await supabase
        .from('report_training_patterns')
        .select('*')
        .or(`hotel_id.eq.${hotelId},assigned_to_hotel_id.eq.${hotelId}`)
        .eq('validated', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        console.log(`📐 Aucun pattern appris pour hotel ${hotelId}`);
        return null;
      }

      const pattern = data[0];
      const detectionRules = pattern.detection_rules as Record<string, any> | null;
      const extractedData = pattern.extracted_data as Record<string, any> | null;

      // Extraire le format de chambre
      let roomFormat = 'default';
      if (detectionRules?.roomFormat) {
        roomFormat = detectionRules.roomFormat;
      } else if (extractedData?.patterns?.roomFormat) {
        roomFormat = extractedData.patterns.roomFormat;
      }

      // Extraire les mots-clés de statut
      const statusKeywords: Record<string, { cleaning: 'full' | 'quick' | 'none'; status: string }> = {};
      
      // Depuis detection_rules.statusKeywords (array de mots)
      if (detectionRules?.statusKeywords && Array.isArray(detectionRules.statusKeywords)) {
        for (const keyword of detectionRules.statusKeywords) {
          const keywordLower = keyword.toLowerCase();
          if (keywordLower.includes('recouche') || keywordLower.includes('stayover')) {
            statusKeywords[keyword] = { cleaning: 'quick', status: 'stayover' };
          } else if (keywordLower.includes('parti') || keywordLower.includes('depart') || keywordLower.includes('checkout')) {
            statusKeywords[keyword] = { cleaning: 'full', status: 'checkout' };
          } else if (keywordLower.includes('arrivée') || keywordLower.includes('arrivee') || keywordLower.includes('arrival')) {
            statusKeywords[keyword] = { cleaning: 'full', status: 'arrival' };
          } else if (keywordLower.includes('contrôler') || keywordLower.includes('controler') || keywordLower.includes('propre') || keywordLower.includes('clean')) {
            statusKeywords[keyword] = { cleaning: 'none', status: 'clean' };
          } else if (keywordLower.includes('dir') || keywordLower.includes('dirty') || keywordLower.includes('sale')) {
            statusKeywords[keyword] = { cleaning: 'full', status: 'dirty' };
          } else {
            // Par défaut: nettoyage complet
            statusKeywords[keyword] = { cleaning: 'full', status: 'unknown' };
          }
        }
      }

      // Depuis extracted_data.rooms pour enrichir les mots-clés
      if (extractedData?.rooms && Array.isArray(extractedData.rooms)) {
        for (const room of extractedData.rooms) {
          if (room.status && room.cleaningType) {
            statusKeywords[room.status] = {
              cleaning: room.cleaningType as 'full' | 'quick' | 'none',
              status: room.status
            };
          }
        }
      }

      const pmsType = pattern.pms_type || 'unknown';
      this.expectedPmsType = pmsType;

      const learnedPattern: LearnedPattern = {
        id: pattern.id,
        hotelId: hotelId,
        pmsType: pmsType,
        roomFormat: roomFormat,
        statusKeywords: statusKeywords,
        combinationRules: pmsType === 'apaleo' ? APALEO_COMBINATION_RULES : [],
        dateFormats: detectionRules?.dateFormats || ['dd/MM/yyyy'],
        patternName: pattern.pattern_name || 'Pattern appris'
      };

      // Mettre en cache
      this.hotelPatterns.set(hotelId, learnedPattern);

      console.log(`✅ Pattern chargé pour ${hotelId}:`);
      console.log(`   📋 PMS: ${learnedPattern.pmsType}`);
      console.log(`   📐 Format: ${learnedPattern.roomFormat}`);
      console.log(`   🔤 Mots-clés: ${Object.keys(learnedPattern.statusKeywords).join(', ')}`);

      return learnedPattern;
    } catch (err) {
      console.error('Erreur chargement pattern:', err);
      return null;
    }
  }

  /**
   * Détecter le type de PMS à partir du texte du rapport
   */
  detectPmsFromText(text: string): { pmsType: string; confidence: number; foundKeywords: string[] } {
    const textUpper = text.toUpperCase();
    const scores: Record<string, { score: number; keywords: string[] }> = {};

    for (const [pms, keywords] of Object.entries(DEFAULT_PMS_KEYWORDS)) {
      const foundKeywords: string[] = [];
      for (const keyword of keywords) {
        if (textUpper.includes(keyword.toUpperCase())) {
          foundKeywords.push(keyword);
        }
      }
      scores[pms] = {
        score: foundKeywords.length / keywords.length * 100,
        keywords: foundKeywords
      };
    }

    // Trouver le PMS avec le meilleur score
    let bestPms = 'unknown';
    let bestScore = 0;
    let bestKeywords: string[] = [];

    for (const [pms, data] of Object.entries(scores)) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestPms = pms;
        bestKeywords = data.keywords;
      }
    }

    return {
      pmsType: bestScore >= 30 ? bestPms : 'unknown',
      confidence: bestScore,
      foundKeywords: bestKeywords
    };
  }

  /**
   * Comparer le PMS détecté avec le pattern attendu
   * Retourne un résultat indiquant s'il y a une correspondance
   */
  async compareWithExpectedPattern(hotelId: string, reportText: string): Promise<PmsMatchResult> {
    const pattern = await this.loadHotelPattern(hotelId);
    const detected = this.detectPmsFromText(reportText);

    if (!pattern) {
      // Pas de pattern appris, tout est acceptable
      return {
        isMatch: true,
        expectedPms: null,
        detectedPms: detected.pmsType,
        matchScore: detected.confidence,
        missingKeywords: [],
        unexpectedKeywords: []
      };
    }

    // Comparer les mots-clés trouvés avec les mots-clés attendus
    const expectedKeywords = Object.keys(pattern.statusKeywords);
    const textUpper = reportText.toUpperCase();

    const foundExpectedKeywords: string[] = [];
    const missingKeywords: string[] = [];
    
    for (const keyword of expectedKeywords) {
      if (textUpper.includes(keyword.toUpperCase())) {
        foundExpectedKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    }

    // Calculer le score de correspondance
    const matchScore = expectedKeywords.length > 0 
      ? (foundExpectedKeywords.length / expectedKeywords.length) * 100 
      : 100;

    // Si moins de 50% de correspondance, signaler un mismatch
    const isMatch = matchScore >= 50 || detected.pmsType === pattern.pmsType;

    console.log(`🔍 Comparaison PMS pour ${hotelId}:`);
    console.log(`   Attendu: ${pattern.pmsType}, Détecté: ${detected.pmsType}`);
    console.log(`   Score: ${matchScore.toFixed(1)}%, Match: ${isMatch}`);
    if (missingKeywords.length > 0) {
      console.log(`   Mots-clés manquants: ${missingKeywords.join(', ')}`);
    }

    return {
      isMatch,
      expectedPms: pattern.pmsType,
      detectedPms: detected.pmsType,
      matchScore,
      missingKeywords,
      unexpectedKeywords: detected.foundKeywords.filter(k => !expectedKeywords.includes(k))
    };
  }

  /**
   * Appliquer les mots-clés appris pour détecter le type de nettoyage
   */
  detectCleaningTypeFromKeywords(
    lineText: string, 
    pattern: LearnedPattern | null
  ): { cleaning: 'full' | 'quick' | 'none'; status: string; matchedKeyword: string | null } {
    
    const lineUpper = lineText.toUpperCase();
    
    // Si pattern avec mots-clés appris, les utiliser en priorité
    if (pattern && Object.keys(pattern.statusKeywords).length > 0) {
      // Chercher les mots-clés dans l'ordre de priorité (les plus longs d'abord)
      const sortedKeywords = Object.entries(pattern.statusKeywords)
        .sort((a, b) => b[0].length - a[0].length);

      for (const [keyword, config] of sortedKeywords) {
        if (lineUpper.includes(keyword.toUpperCase())) {
          console.log(`   🏷️ Mot-clé appris trouvé: "${keyword}" → ${config.cleaning}`);
          return {
            cleaning: config.cleaning,
            status: config.status,
            matchedKeyword: keyword
          };
        }
      }
    }
    
    // Utiliser le mapping par défaut
    const sortedDefaultKeywords = Object.entries(DEFAULT_KEYWORD_CLEANING_MAP)
      .sort((a, b) => b[0].length - a[0].length);
    
    for (const [keyword, config] of sortedDefaultKeywords) {
      if (lineUpper.includes(keyword.toUpperCase())) {
        console.log(`   🏷️ Mot-clé par défaut trouvé: "${keyword}" → ${config.cleaning}`);
        return {
          cleaning: config.cleaning,
          status: config.status,
          matchedKeyword: keyword
        };
      }
    }

    // Fallback: détection par regex
    return this.detectCleaningTypeDefault(lineText);
  }

  /**
   * Appliquer les règles de combinaison (ex: Parti + Arrivée = À blanc)
   */
  applyCombinationRules(
    statuses: string[], 
    pattern: LearnedPattern | null
  ): { cleaning: 'full' | 'quick' | 'none'; status: string } | null {
    
    const rules = pattern?.combinationRules || APALEO_COMBINATION_RULES;
    const statusesLower = statuses.map(s => s.toLowerCase());

    for (const rule of rules) {
      const conditionsLower = rule.conditions.map(c => c.toLowerCase());
      
      // Vérifier si tous les statuts de la règle sont présents
      const allConditionsMet = conditionsLower.every(condition =>
        statusesLower.some(status => status.includes(condition) || condition.includes(status))
      );

      if (allConditionsMet) {
        console.log(`   🔀 Règle de combinaison: [${rule.conditions.join(' + ')}] → ${rule.result.cleaning}`);
        return rule.result;
      }
    }

    return null;
  }

  /**
   * Détection par défaut du type de nettoyage (sans pattern appris)
   */
  private detectCleaningTypeDefault(lineText: string): { cleaning: 'full' | 'quick' | 'none'; status: string; matchedKeyword: string | null } {
    const lineUpper = lineText.toUpperCase();

    // Recouche / Stay-over
    if (lineUpper.match(/\b(RECOUCHE|STAYOVER|STAY\s*OVER|SAL|INS)\b/) && !lineUpper.match(/\b(DIR|DEP|DEPART)\b/)) {
      return { cleaning: 'quick', status: 'stayover', matchedKeyword: 'recouche' };
    }

    // Départ / Checkout
    if (lineUpper.match(/\b(PARTI|DIR|DEP|DEPART|CHECKOUT|CHECK-OUT|DEPARTURE|SALE|DIRTY)\b/)) {
      return { cleaning: 'full', status: 'checkout', matchedKeyword: 'depart' };
    }

    // Arrivée
    if (lineUpper.match(/\b(ARRIVÉE|ARRIVEE|ARRIVAL|EN ARRIVÉE|EN ARRIVEE)\b/)) {
      return { cleaning: 'full', status: 'arrival', matchedKeyword: 'arrivee' };
    }

    // Propre / Clean
    if (lineUpper.match(/\b(PROPRE|CLEAN|INSPECTED|INSPECTÉ|A CONTROLER|CONTROLER)\b/)) {
      return { cleaning: 'none', status: 'clean', matchedKeyword: 'propre' };
    }

    return { cleaning: 'none', status: 'unknown', matchedKeyword: null };
  }

  /**
   * Soumettre une demande d'amélioration de pattern
   */
  async submitPatternImprovementRequest(
    hotelId: string,
    reportSample: string,
    detectedKeywords: string[],
    expectedPmsType: string | null,
    detectedPmsType: string,
    mismatchScore: number
  ): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('Utilisateur non connecté');
        return false;
      }

      const { error } = await supabase
        .from('pattern_improvement_requests')
        .insert({
          hotel_id: hotelId,
          submitted_by: user.id,
          report_sample: reportSample.substring(0, 5000), // Limiter la taille
          detected_keywords: detectedKeywords,
          expected_pms_type: expectedPmsType,
          detected_pms_type: detectedPmsType,
          mismatch_score: mismatchScore,
          status: 'pending'
        });

      if (error) {
        console.error('Erreur soumission demande:', error);
        return false;
      }

      console.log('✅ Demande d\'amélioration soumise avec succès');
      return true;
    } catch (err) {
      console.error('Erreur:', err);
      return false;
    }
  }

  /**
   * Vider le cache des patterns
   */
  clearCache(hotelId?: string): void {
    if (hotelId) {
      this.hotelPatterns.delete(hotelId);
    } else {
      this.hotelPatterns.clear();
    }
    console.log('🗑️ Cache des patterns vidé');
  }

  /**
   * Obtenir le pattern attendu
   */
  getExpectedPmsType(): string | null {
    return this.expectedPmsType;
  }
}

export const patternLearningService = new PatternLearningService();
