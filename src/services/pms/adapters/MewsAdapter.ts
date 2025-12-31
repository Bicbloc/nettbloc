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
   */
  extractRooms(text: string): ExtractedRoom[] {
    // Pré-traiter le texte pour fusionner les lignes fragmentées
    const processedText = this.preprocessText(text);
    console.log("🔧 Texte pré-traité pour Mews:", processedText.substring(0, 500));
    
    const rooms: ExtractedRoom[] = [];
    const lines = processedText.split('\n');
    const seenRooms = new Set<string>();
    
    // Pattern pour extraire les chambres Mews
    // Format: 001 DBL-C SAL ou 001 DBL-C PRO ou 103+104 FAM SAL
    const roomLinePattern = /^[^a-z]*?(\d{2,4})(?:-T)?\s+(?:[A-Z]{3,4}-[CS]|[A-Z]{3,4})\s+(SAL|PRO|INS|DIR|DEP|ARR)/i;
    const linkedRoomPattern = /(\d{3})\+(\d{3})/;
    const nightPattern = /Nuit\s*(\d+)\s*[\/\\]\s*(\d+)/i;
    const guestPattern = /(\d+)\s*×\s*Adultes/gi;
    const hasArrivalPattern = /\d{2}:\d{2}\s+\d+\s*×\s*Adultes.*?\d{2}\/\d{2}\/\d{4}/;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Ignorer les lignes d'en-tête
      if (line.includes('Étage') && line.includes('Espaces')) continue;
      if (line.includes('Hotel') && /\d{2}\/\d{2}\/\d{4}/.test(line)) continue;
      
      // Ignorer les indicateurs d'étage seuls (juste un chiffre)
      if (/^\s*\d\s*$/.test(line)) continue;
      
      // Chercher un numéro de chambre au début (avec ou sans espace après)
      // Patterns: "001 DBL-C", "001-T DBL-S", "001   DBL-C PRO"
      const roomMatch = line.match(/^\s*(\d{2,4})(?:-T)?(?:\s|$)/);
      if (!roomMatch) continue;
      
      // Garder le numéro original avec les zéros initiaux pour les chambres 001, 002, etc.
      const roomNumber = roomMatch[1];
      
      // Éviter les doublons (comparer sans zéros pour éviter 001 vs 1)
      const normalizedRoom = roomNumber.replace(/^0+/, '') || '0';
      if (seenRooms.has(normalizedRoom)) continue;
      seenRooms.add(normalizedRoom);
      
      // Détecter le code de statut
      let status = 'unknown';
      let cleaningType: CleaningType = 'none';
      
      const lineUpper = line.toUpperCase();
      
      if (lineUpper.includes('SAL')) {
        status = 'dirty';
        cleaningType = 'a_blanc';
      } else if (lineUpper.includes('PRO')) {
        status = 'clean';
        cleaningType = 'none';
      } else if (lineUpper.includes('INS')) {
        status = 'inspected';
        cleaningType = 'none';
      } else if (lineUpper.includes('DIR')) {
        status = 'dirty';
        cleaningType = 'a_blanc';
      }
      
      // Détecter si c'est une recouche via "Nuit X/Y"
      const nightMatch = line.match(nightPattern);
      let currentNight: number | undefined;
      let totalNights: number | undefined;
      
      if (nightMatch) {
        currentNight = parseInt(nightMatch[1], 10);
        totalNights = parseInt(nightMatch[2], 10);
        
        // Client qui reste (pas la dernière nuit) = recouche
        if (currentNight < totalNights && status === 'dirty') {
          cleaningType = 'recouche';
          status = 'stayover';
        }
        // Dernière nuit = départ = à blanc
        else if (currentNight === totalNights && status === 'dirty') {
          cleaningType = 'a_blanc';
          status = 'checkout';
        }
      }
      
      // Détecter s'il y a un départ + arrivée (2 blocs d'adultes avec heure entre)
      // Pattern: "10:04 15:00 2 × Adultes" indique un checkout + checkin
      if (hasArrivalPattern.test(line) && !nightMatch) {
        cleaningType = 'a_blanc';
        status = 'checkout_arrival';
      }
      
      // Extraire le type de chambre
      let roomType: string | undefined;
      const typeMatch = line.match(/([A-Z]{3,4})-([CS])/i);
      if (typeMatch) {
        roomType = `${typeMatch[1]}-${typeMatch[2]}`.toUpperCase();
      }
      
      // Extraire le nombre de guests
      let guestCount: number | undefined;
      const guestMatches = [...line.matchAll(guestPattern)];
      if (guestMatches.length > 0) {
        guestCount = guestMatches.reduce((sum, m) => sum + parseInt(m[1], 10), 0);
      }
      
      // Extraire le nom du client
      let guestName: string | undefined;
      // Pattern: nom après les adultes, avant la date
      const nameMatch = line.match(/Adultes\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/);
      if (nameMatch) {
        guestName = nameMatch[1].trim();
      }
      
      const room: ExtractedRoom = {
        roomNumber,
        status,
        cleaningType,
        roomType,
        guestName,
        guestCount,
        currentNight,
        totalNights,
        nightInfo: nightMatch ? `Nuit ${currentNight}/${totalNights}` : undefined,
        originalText: line.trim(),
        validated: false,
        confidence: nightMatch ? 95 : (status !== 'unknown' ? 85 : 60),
        debugInfo: {
          rawLine: line,
          cleanedLine: line.trim(),
          detectedKeywords: [],
          source: 'regex',
          confidence: nightMatch ? 95 : 85
        }
      };
      
      rooms.push(room);
    }
    
    console.log(`🏠 MewsAdapter: ${rooms.length} chambres extraites`);
    return rooms;
  }
}
