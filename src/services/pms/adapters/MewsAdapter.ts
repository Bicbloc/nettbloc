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
    
    // NOUVEAU: Fusionner les lignes d'horaires isolés (ex: "11:00" seul sur une ligne)
    // Pattern: ligne avec chambre + nom client, puis ligne avec juste HH:MM
    // Exemple: "116 DBL SAL ... JONATHAN PAUL AXON\n11:00" → fusionné en une ligne
    processed = processed.replace(
      /(\d{2,4}\s+(?:DBL|SGL|TPL|TRP|TWN|SUI|FAM|QUA)[^\n]*[A-Z]{2,}[^\n]*)\n\s*(\d{1,2}:\d{2})\s*(?=\n|$)/gi,
      '$1 $2'
    );
    
    // Pattern plus général: ligne avec Adultes/Enfants/nom, puis horaire isolé
    // Couvre les cas où le type de chambre n'est pas détecté mais le contenu est typique
    processed = processed.replace(
      /([^\n]*(?:Adultes|Enfants)[^\n]*[A-Z]{3,}[^\n]*)\n\s*(\d{1,2}:\d{2})\s*(?=\n|$)/gi,
      '$1 $2'
    );
    
    // Pattern pour horaires multiples sur ligne séparée (ex: "11:00\n15:00")
    // Fusionner avec la ligne précédente si elle contient un numéro de chambre
    processed = processed.replace(
      /(\d{2,4}\s+[^\n]+)\n\s*(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s*(?=\n|$)/gi,
      '$1 $2 $3'
    );
    
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

      // Extraire les horaires de la ligne
      const timePositions = this.extractTimePositions(rawLine);
      if (timePositions.departureTime) r.departureTime = timePositions.departureTime;
      if (timePositions.arrivalTime) r.arrivalTime = timePositions.arrivalTime;

      // Note: ne pas forcer ici un override global "dates sans horaire".
      // La logique "dates sans horaire" est déjà gérée dans analyzeLineWithDate() (cas SAL)
      // et dans UnifiedParserService (pattern-first / règles contextuelles).


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

      // Ajustement recouche vs départ via nuit X/Y quand la chambre est sale:
      // sans heure de départ, même "4/4" reste une recouche (client encore présent).
      if (r.currentNight && r.totalNights && (r.status === 'dirty' || r.status === 'stayover')) {
        if (r.departureTime) {
          r.status = 'checkout';
          r.cleaningType = 'a_blanc';
        } else {
          r.status = 'stayover';
          r.cleaningType = 'recouche';
        }
      }

      // Normalisation défensive (éviter undefined)
      if (!r.cleaningType) r.cleaningType = 'a_blanc';
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
   * Extrait les positions des horaires dans une ligne
   * - Horaire à DROITE (après le nom du client) = heure de DÉPART
   * - Horaire à GAUCHE (après email/tiret, avant client) = heure d'ARRIVÉE
   */
  private extractTimePositions(line: string): { 
    arrivalTime: string | null; 
    departureTime: string | null;
    hasDeparture: boolean;
    hasArrival: boolean;
  } {
    // Pattern pour trouver les horaires HH:MM (pas les dates DD/MM/YYYY)
    const timePattern = /(?<!\d\/)\b(\d{1,2}:\d{2})\b(?!\/\d)/g;
    const times: { time: string; index: number }[] = [];
    
    let match;
    while ((match = timePattern.exec(line)) !== null) {
      times.push({ time: match[1], index: match.index });
    }
    
    if (times.length === 0) {
      return { arrivalTime: null, departureTime: null, hasDeparture: false, hasArrival: false };
    }
    
    const lineLength = line.length;
    
    if (times.length === 1) {
      const timeMatch = times[0];
      // Si l'horaire est dans la dernière partie de la ligne (après 60%) → départ
      // Sinon → arrivée
      const isRightSide = timeMatch.index > lineLength * 0.6;
      
      console.log(`⏰ MEWS Time: "${timeMatch.time}" at pos ${timeMatch.index}/${lineLength} (${(timeMatch.index/lineLength*100).toFixed(0)}%) → ${isRightSide ? 'DÉPART' : 'ARRIVÉE'}`);
      
      return isRightSide 
        ? { arrivalTime: null, departureTime: timeMatch.time, hasDeparture: true, hasArrival: false }
        : { arrivalTime: timeMatch.time, departureTime: null, hasDeparture: false, hasArrival: true };
    }
    
    // 2+ horaires : le premier est arrivée, le dernier est départ
    console.log(`⏰ MEWS Times: ${times.length} found - first="${times[0].time}" (arrivée), last="${times[times.length - 1].time}" (départ)`);
    
    return {
      arrivalTime: times[0].time,
      departureTime: times[times.length - 1].time,
      hasDeparture: true,
      hasArrival: true
    };
  }

  /**
   * Analyse une ligne avec la date du rapport pour déterminer à blanc vs recouche
   * LOGIQUE PRINCIPALE:
   * - Horaire à DROITE = départ → À blanc
   * - Horaire à GAUCHE = arrivée seule → Recouche (turnover géré ailleurs)
   * - Pas d'horaire = client reste → Recouche
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
    
    // DEP = départ explicite
    if (/\b(DEP|CHECKOUT|DÉPART)\b/.test(upper)) {
      return { status: 'checkout', cleaningType: 'a_blanc' };
    }
    
    // SAL = logique améliorée basée sur la POSITION des horaires + dates sans horaire
    if (/\bSAL\b/.test(upper)) {
      const { hasDeparture, hasArrival } = this.extractTimePositions(line);

      // 1) Horaire à droite = départ → À blanc
      if (hasDeparture) {
        console.log(`🔍 MEWS: Départ détecté (horaire droite) → À blanc`);
        return { status: 'checkout', cleaningType: 'a_blanc' };
      }

      // 2) Dates arrivée+dép. SANS horaire → client encore présent → Recouche (peu importe la nuit)
      const dateMatches = line.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g) || [];
      const hasDateRangeNoTime = dateMatches.length >= 2 && !hasArrival && !hasDeparture;
      if (hasDateRangeNoTime) {
        return { status: 'stayover', cleaningType: 'recouche' };
      }

      // 3) Nuit X/Y (y compris X/X) → recouche tant qu'il n'y a pas d'heure de départ
      const nightMatch = upper.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/i) ||
        upper.match(/(\d+)\s*[\/\\]\s*(\d+)\s*NUIT/i);
      if (nightMatch) {
        return { status: 'stayover', cleaningType: 'recouche' };
      }

      // 4) Arrivée seule (horaire gauche) → Recouche
      if (hasArrival && !hasDeparture) {
        console.log(`🔍 MEWS: Arrivée seule (horaire gauche) → Recouche`);
        return { status: 'stayover', cleaningType: 'recouche' };
      }

      // 5) Occupation (adultes) sans départ → Recouche
      const hasOccupancy = /\d+\s*×\s*Adultes/i.test(line);
      if (hasOccupancy) {
        return { status: 'stayover', cleaningType: 'recouche' };
      }

      // Default SAL sans horaire/date/occupation → À BLANC (chambre vide sale)
      return { status: 'dirty', cleaningType: 'a_blanc' };
    }

    // DIR (dirty) = recouche par défaut
    if (/\bDIR\b/.test(upper)) {
      return { status: 'dirty', cleaningType: 'recouche' };
    }
    
    // Par défaut → recouche (plus conservateur que a_blanc)
    return { status: 'unknown', cleaningType: 'recouche' };
  }
}
