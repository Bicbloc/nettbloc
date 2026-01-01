/**
 * Adapter pour Mews PMS
 * Optimisé pour le format "Statut des espaces" avec reconstruction du texte fragmenté
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType, PmsDetectionResult } from '../types';

export class MewsAdapter extends PmsAdapter {
  readonly name = 'mews';
  
  readonly criticalKeywords = ['STATUT DES ESPACES', 'SPACE STATUS'];
  
  readonly keywords = [
    'ÉTAGE', 'ESPACES', 'RESPONSABLE', 'Nuit', 'Night', 
    'Adultes', 'Enfants', 'DBL-', 'SGL-', 'TPL-', 'FAM',
    'SAL', 'INS', 'PRO', 'DIR', 'DEP', 'ARR'
  ];

  readonly config: PmsConfig = {
    pmsType: 'mews',
    keywords: this.keywords,
    // Regex pour chambres: 001, 101-T, 003+004, etc.
    roomNumberRegex: '(?<![\\d])([0-9]{2,4})(?:-T)?(?![\\d/])',
    statusMappings: {
      // Codes Mews français
      'PRO': { status: 'clean', cleaning: 'none', priority: 8 },
      'SAL': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'INS': { status: 'inspected', cleaning: 'none', priority: 7 },
      'DIR': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'DEP': { status: 'checkout', cleaning: 'a_blanc', priority: 22 },
      'ARR': { status: 'arrival', cleaning: 'a_blanc', priority: 18 },
      
      // Termes complets
      'PROPRE': { status: 'clean', cleaning: 'none', priority: 8 },
      'SALE': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'PARTI': { status: 'checkout', cleaning: 'a_blanc', priority: 22 },
      'DEPART': { status: 'checkout', cleaning: 'a_blanc', priority: 22 },
      'RECOUCHE': { status: 'stayover', cleaning: 'recouche', priority: 15 },
      
      // Statuts anglais
      'Dirty': { status: 'dirty', cleaning: 'a_blanc', priority: 20 },
      'Clean': { status: 'clean', cleaning: 'none', priority: 8 },
      'Inspected': { status: 'inspected', cleaning: 'none', priority: 7 },
      'Out of Service': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'Out of order': { status: 'out-of-order', cleaning: 'none', priority: 25 },
      'OOO': { status: 'out-of-order', cleaning: 'none', priority: 25 },
    },
    combinationRules: [
      // Départ + Arrivée même ligne = À blanc
      { conditions: ['DIR', 'ARR'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      { conditions: ['DEP', 'ARR'], result: { status: 'checkout_arrival', cleaning: 'a_blanc' } },
      // INS avec arrivée = Propre
      { conditions: ['INS', 'ARR'], result: { status: 'ready', cleaning: 'none' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy']
  };

  /**
   * Pré-traite le texte pour fusionner les lignes fragmentées du PDF
   */
  private preprocessText(text: string): string {
    let processed = text;
    
    // Fusionner les lignes fragmentées comme "DBL-" + "C" ou "SGL-" + "C"
    // Pattern: une ligne finit par "DBL-", "SGL-", "TPL-" et la suivante commence par C ou S seul
    processed = processed.replace(/([A-Z]{3})-\s*\n\s*([CS])\s*\n/gi, '$1-$2\n');
    processed = processed.replace(/([A-Z]{3})-\s*\n\s*([CS])\b/gi, '$1-$2');
    
    // Fusionner DBL-C/S avec le statut sur la ligne suivante
    processed = processed.replace(/([A-Z]{3}-[CS])\s*\n\s*(SAL|PRO|INS|DIR|DEP|ARR)\b/gi, '$1 $2');
    
    // Fusionner le numéro de chambre avec le type de chambre fragmenté
    // Pattern: "001   DBL-" suivi d'un saut de ligne puis "C"
    processed = processed.replace(/(\d{2,4})\s+(DBL|SGL|TPL|FAM)-\s*\n\s*([CS])/gi, '$1 $2-$3');
    
    // Normaliser les espaces multiples
    processed = processed.replace(/[ \t]+/g, ' ');
    
    // Supprimer les sauts de ligne excessifs
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    return processed;
  }

  /**
   * Détection améliorée pour Mews
   */
  detect(text: string): PmsDetectionResult {
    const textUpper = text.toUpperCase();
    const matchedKeywords: string[] = [];
    const criticalKeywordsMatched: string[] = [];
    let score = 0;

    // Mots-clés critiques (80 points chacun pour Mews)
    for (const kw of this.criticalKeywords) {
      if (textUpper.includes(kw.toUpperCase())) {
        criticalKeywordsMatched.push(kw);
        score += 80;
      }
    }

    // Mots-clés normaux (10 points chacun)
    for (const kw of this.keywords) {
      if (textUpper.includes(kw.toUpperCase())) {
        matchedKeywords.push(kw);
        if (!criticalKeywordsMatched.includes(kw)) {
          score += 10;
        }
      }
    }

    // Bonus pour patterns spécifiques Mews
    const mewsPatterns = [
      /\d{3}\s+[A-Z]{3}-[CS]/i, // 001 DBL-C
      /Nuit\s+\d+\/\d+/i,       // Nuit 3/5
      /\d+\s*×\s*Adultes/i,     // 2 × Adultes
    ];
    
    for (const pattern of mewsPatterns) {
      if (pattern.test(text)) {
        score += 15;
        matchedKeywords.push(pattern.source);
      }
    }

    const confidence = Math.min(score, 100);

    return {
      pmsType: this.name,
      confidence,
      matchedKeywords,
      criticalKeywordsMatched,
      score
    };
  }

  /**
   * Extraction spécifique pour Mews avec pré-traitement du texte fragmenté
   *
   * IMPORTANT: on s'appuie sur l'extracteur commun (PmsAdapter.extractRooms) pour être robuste
   * même si le numéro de chambre n'est pas au début de ligne (ex: "SAL SAL 107+108 ...").
   * Ensuite, on fusionne les chambres connectées au format "100+101".
   */
  extractRooms(text: string): ExtractedRoom[] {
    const processedText = this.preprocessText(text);
    console.log("🔧 Texte pré-traité pour Mews:", processedText.substring(0, 500));

    // Extraire la date du rapport depuis le header
    const reportDate = this.extractReportDate(processedText);
    if (reportDate) {
      console.log(`📅 MewsAdapter: Date du rapport détectée: ${reportDate.toLocaleDateString('fr-FR')}`);
    }

    // 1) Extraction standard via le moteur commun (regex + FieldExtractor)
    const baseRooms = super.extractRooms(processedText);

    // 1.b) Appliquer les règles Mews améliorées avec la date du rapport
    for (const r of baseRooms) {
      const rawLine = r.debugInfo?.rawLine || r.originalText || '';
      const upper = rawLine.toUpperCase();

      // Détecter checkout+arrival sur la même ligne (priorité)
      const hasDepOrDirty = /\b(DEP|DIR)\b/.test(upper);
      const hasArr = /\bARR\b/.test(upper);
      if (hasDepOrDirty && hasArr) {
        r.status = 'checkout_arrival';
        r.cleaningType = 'a_blanc';
      } else {
        // Utiliser la nouvelle logique améliorée pour SAL
        const { status, cleaningType } = this.analyzeLineWithDate(rawLine, reportDate);
        r.status = status;
        r.cleaningType = cleaningType;
      }

      // Ajustement recouche vs départ via nuit X/Y quand c'est sale
      if (r.status === 'dirty' && r.currentNight && r.totalNights) {
        if (r.currentNight < r.totalNights) {
          r.status = 'stayover';
          r.cleaningType = 'recouche';
        } else if (r.currentNight === r.totalNights) {
          r.status = 'checkout';
          r.cleaningType = 'a_blanc';
        }
      }

      // Normalisation défensive (éviter undefined)
      if (!r.cleaningType) r.cleaningType = 'recouche';
      if (!r.status) r.status = 'unknown';
    }

    // 2) Fusion des chambres liées (ex: "107+108") en un seul groupe
    const lines = processedText.split('\n');
    const linkedRegex = /(\d{2,4})\s*\+\s*(\d{2,4})/g;

    const byNumber = new Map<string, ExtractedRoom>();
    for (const r of baseRooms) {
      byNumber.set(this.normalizeRoomNumber(String(r.roomNumber)), r);
    }

    const removed = new Set<string>();
    const merged: ExtractedRoom[] = [];

    const pickBest = (a?: ExtractedRoom, b?: ExtractedRoom): { status: string; cleaningType: CleaningType; confidence: number } => {
      const candidates = [a, b].filter(Boolean) as ExtractedRoom[];
      if (candidates.length === 0) return { status: 'unknown', cleaningType: 'none', confidence: 60 };

      // Priorité de nettoyage (du plus important au moins important)
      const priority: CleaningType[] = ['a_blanc', 'full', 'recouche', 'quick', 'none'];
      const best = [...candidates].sort((x, y) => priority.indexOf(x.cleaningType) - priority.indexOf(y.cleaningType))[0];

      return {
        status: best.status || 'unknown',
        cleaningType: best.cleaningType || 'none',
        confidence: Math.max(...candidates.map((c) => c.confidence ?? 70)),
      };
    };

    for (const line of lines) {
      if (!line.trim()) continue;

      // Ignorer les lignes d'en-tête
      if (line.includes('Étage') && line.includes('Espaces')) continue;
      if (line.includes('Hotel') && /\d{2}\/\d{2}\/\d{4}/.test(line)) continue;
      if (/^\s*\d\s*$/.test(line)) continue; // indicateur d'étage seul

      linkedRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = linkedRegex.exec(line)) !== null) {
        const aRaw = match[1];
        const bRaw = match[2];

        const a = this.normalizeRoomNumber(aRaw);
        const b = this.normalizeRoomNumber(bRaw);

        if (!a || !b) continue;
        if (removed.has(a) || removed.has(b)) continue;

        const roomA = byNumber.get(a);
        const roomB = byNumber.get(b);
        const { status, cleaningType, confidence } = pickBest(roomA, roomB);

        // Supprimer les entrées individuelles (si elles existent)
        removed.add(a);
        removed.add(b);

        merged.push({
          roomNumber: `${aRaw}-${bRaw}`,
          status,
          cleaningType,
          originalText: line.trim(),
          validated: false,
          confidence: Math.max(85, confidence),
          isConnected: true,
          linkedRooms: [aRaw, bRaw],
          debugInfo: {
            rawLine: line,
            cleanedLine: line.trim(),
            detectedKeywords: [],
            source: 'regex',
            confidence: Math.max(85, confidence),
            appliedRule: 'Connected rooms merge (+)',
          },
        });
      }
    }

    const finalRooms = [
      ...baseRooms.filter((r) => !removed.has(this.normalizeRoomNumber(String(r.roomNumber)))),
      ...merged,
    ];

    // Dédupliquer par numéro (sécurité)
    const seen = new Set<string>();
    const deduped: ExtractedRoom[] = [];
    for (const r of finalRooms) {
      const key = r.isConnected ? `grp:${r.roomNumber}` : `rm:${this.normalizeRoomNumber(String(r.roomNumber))}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    console.log(`🏠 MewsAdapter: ${deduped.length} chambres extraites`);
    return deduped;
  }

  /**
   * Extrait la date du rapport depuis le header Mews
   */
  private extractReportDate(text: string): Date | null {
    // Pattern 1: "Statut des espaces - DD/MM/YYYY"
    const pattern1 = /Statut des espaces\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/i;
    let match = text.match(pattern1);
    if (match) {
      const [day, month, year] = match[1].split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // Pattern 2: Footer "Hotel ... DD/MM/YYYY HH:MM:SS"
    const pattern2 = /(?:Hôtel|Hotel)\s+.*?(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/i;
    match = text.match(pattern2);
    if (match) {
      const [day, month, year] = match[1].split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    
    return null;
  }

  /**
   * Analyse une ligne avec la date du rapport pour déterminer à blanc vs recouche
   */
  private analyzeLineWithDate(line: string, reportDate: Date | null): { status: string; cleaningType: CleaningType } {
    const upper = line.toUpperCase();
    
    // PRO = propre, pas de nettoyage
    if (/\bPRO\b/.test(upper)) {
      return { status: 'clean', cleaningType: 'none' };
    }
    
    // INS = inspecté, pas de nettoyage
    if (/\bINS\b/.test(upper)) {
      return { status: 'inspected', cleaningType: 'none' };
    }
    
    // DEP = départ
    if (/\b(DEP|CHECKOUT|DÉPART)\b/.test(upper)) {
      return { status: 'checkout', cleaningType: 'a_blanc' };
    }
    
    // SAL = logique améliorée avec date
    if (/\bSAL\b/.test(upper)) {
      // 1) Vérifier Nuit X/Y pour stayover vs checkout
      const nightMatch = upper.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/i) || 
                        upper.match(/(\d+)\s*[\/\\]\s*(\d+)\s*NUIT/i);
      if (nightMatch) {
        const currentNight = parseInt(nightMatch[1]);
        const totalNights = parseInt(nightMatch[2]);
        if (currentNight < totalNights) {
          return { status: 'stayover', cleaningType: 'recouche' };
        } else {
          return { status: 'checkout', cleaningType: 'a_blanc' };
        }
      }
      
      // 2) Utiliser la date vs date du rapport
      const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch && reportDate) {
        const [, day, month, year] = dateMatch;
        const foundDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const diffDays = Math.floor((reportDate.getTime() - foundDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Heure de départ en fin de ligne?
        const hasCheckoutTime = /\d{2}:\d{2}\s*$/.test(line.trim());
        
        if (diffDays === 0) {
          // Date = date du rapport
          if (hasCheckoutTime) {
            return { status: 'checkout', cleaningType: 'a_blanc' };
          }
          const hasOccupancy = /\d+\s*×\s*Adultes/i.test(line);
          if (hasOccupancy) {
            return { status: 'stayover', cleaningType: 'recouche' };
          }
          return { status: 'dirty', cleaningType: 'a_blanc' };
        } else if (diffDays > 0) {
          // Date dans le passé → client en séjour
          if (hasCheckoutTime) {
            return { status: 'checkout', cleaningType: 'a_blanc' };
          }
          return { status: 'stayover', cleaningType: 'recouche' };
        } else {
          // Date dans le futur → arrivée prévue
          return { status: 'arrival', cleaningType: 'a_blanc' };
        }
      }
      
      // 3) Heuristique: heure en fin de ligne = checkout prévu
      const hasCheckoutTime = /\d{2}:\d{2}\s*$/.test(line.trim());
      if (hasCheckoutTime) {
        return { status: 'checkout', cleaningType: 'a_blanc' };
      }
      
      // 4) Heuristique: occupation sans heure = recouche
      const hasOccupancy = /\d+\s*×\s*Adultes/i.test(line);
      if (hasOccupancy) {
        return { status: 'stayover', cleaningType: 'recouche' };
      }
      
      // Default SAL → recouche (plus conservateur)
      return { status: 'dirty', cleaningType: 'recouche' };
    }
    
    // DIR (dirty) = recouche par défaut
    if (/\bDIR\b/.test(upper)) {
      return { status: 'dirty', cleaningType: 'recouche' };
    }
    
    // Par défaut → recouche (plus conservateur que a_blanc)
    return { status: 'unknown', cleaningType: 'recouche' };
  }
}
