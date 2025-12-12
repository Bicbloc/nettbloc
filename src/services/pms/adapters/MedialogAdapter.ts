/**
 * Adapter pour Medialog PMS
 * Supporte le format "Rapport Housekeeping" avec tableaux structurés
 */

import { PmsAdapter } from '../PmsAdapter';
import { PmsConfig, ExtractedRoom, CleaningType, normalizeCleaningType } from '../types';

// Interface pour les données structurées extraites du format tableau
interface StructuredRoomData {
  roomNumber: string;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
  guestInfo: string;
  guestName: string;
  stayStatus: string;  // Parti, Recouche, En arrivée, Arrivé
  roomStatus: string;  // Sale, A contrôler
}

export class MedialogAdapter extends PmsAdapter {
  readonly name = 'medialog';
  
  readonly criticalKeywords = [
    'MEDIALOG', 
    'Solutions digitales hôtelières',
    'Rapport Housekeeping'  // Format tableau structuré
  ];
  
  readonly keywords = [
    'PLANNING MENAGE', 'PLANNING MÉNAGE', 'DRAPS', 'À BLANC',
    'L\'état des chambres', 'état des chambres', 'ETAT', 'MEMO GOUVERNANTE',
    // En-têtes de colonnes du format tableau
    'Type de chambre', 'Nom du client', 'Adultes, enfants',
    'Chambre twin', 'Chambre triple', 'Chambre double', 'Chambre quadruple', 'Chambre simple',
    // Statuts séjour
    'Recouche', 'Parti', 'En arrivée', 'Arrivé',
    // Statuts chambre
    'Sale', 'A contrôler', 'À contrôler'
  ];

  readonly config: PmsConfig = {
    pmsType: 'medialog',
    keywords: this.keywords,
    roomNumberRegex: '(?:^|\\s)([0-9]{1,3})(?:\\s|$)',  // Chambres 1-999 en début ou après espace
    statusMappings: {
      // Départs
      'PARTI': { status: 'checkout', cleaning: 'full', priority: 22 },
      'DEPART': { status: 'checkout', cleaning: 'full', priority: 22 },
      'DÉPART': { status: 'checkout', cleaning: 'full', priority: 22 },
      
      // Recouche / Draps
      'RECOUCHE': { status: 'stayover', cleaning: 'quick', priority: 15 },
      'DRAPS': { status: 'stayover', cleaning: 'quick', priority: 14 },
      
      // À blanc / Sale
      'À BLANC': { status: 'dirty', cleaning: 'full', priority: 20 },
      'A BLANC': { status: 'dirty', cleaning: 'full', priority: 20 },
      'BLANC': { status: 'dirty', cleaning: 'full', priority: 18 },
      'SALE': { status: 'dirty', cleaning: 'full', priority: 18 },
      
      // En arrivée (préparer la chambre)
      'EN ARRIVÉE': { status: 'arrival', cleaning: 'full', priority: 21 },
      'EN ARRIVEE': { status: 'arrival', cleaning: 'full', priority: 21 },
      'ARRIVÉ': { status: 'arrived', cleaning: 'none', priority: 5 },
      'ARRIVE': { status: 'arrived', cleaning: 'none', priority: 5 },
      
      // Ne pas nettoyer / Occupé
      'NE PAS NETTOYER': { status: 'occupied', cleaning: 'none', priority: 5 },
      'NO SERVICE': { status: 'occupied', cleaning: 'none', priority: 5 },
      
      // À vérifier / contrôler
      'A VERIFIER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
      'À VÉRIFIER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
      'A CONTROLER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
      'À CONTRÔLER': { status: 'needs-inspection', cleaning: 'none', priority: 6 },
    },
    combinationRules: [
      { conditions: ['DEPART', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['PARTI', 'ARRIVEE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['PARTI', 'EN ARRIVÉE'], result: { status: 'checkout_arrival', cleaning: 'full' } },
      { conditions: ['checkout', 'arrival'], result: { status: 'checkout_arrival', cleaning: 'full' } },
    ],
    dateFormats: ['dd/MM/yyyy', 'dd/MM/yy']
  };

  /**
   * Override extractRooms pour gérer le format tableau "Rapport Housekeeping"
   */
  extractRooms(text: string): ExtractedRoom[] {
    // Détecter si c'est le format "Rapport Housekeeping" (tableau structuré)
    if (this.isStructuredReportFormat(text)) {
      const rooms = this.extractFromStructuredReport(text);
      if (rooms.length > 0) {
        return rooms;
      }
      // Fallback: essayer le parsing de texte collé
      console.log("📄 MedialogAdapter: Format structuré détecté mais pas de chambres, essai parsing collé...");
      return this.extractFromConcatenatedText(text);
    }
    // Sinon utiliser l'extraction standard
    return super.extractRooms(text);
  }

  /**
   * Extrait les chambres depuis un texte PDF "collé" où les lignes ne sont pas séparées
   * Pattern cible: "01   Chambre twin   17/05/2025..." 
   */
  private extractFromConcatenatedText(text: string): ExtractedRoom[] {
    console.log("📄 MedialogAdapter: Parsing texte concaténé...");
    
    const roomDataMap = new Map<string, StructuredRoomData[]>();
    
    // Pattern pour détecter le début de chaque entrée chambre
    // "01   Chambre twin" ou "02   Chambre triple" etc.
    const roomStartPattern = /(\d{1,3})\s{2,}(Chambre\s+(?:twin|double|triple|quadruple|simple))/gi;
    
    // Trouver toutes les positions de début
    const matches = [...text.matchAll(roomStartPattern)];
    console.log(`📄 MedialogAdapter: ${matches.length} entrées de chambre trouvées`);
    
    if (matches.length === 0) {
      // Fallback: essayer un pattern encore plus souple
      return this.extractFromConcatenatedTextFallback(text);
    }
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const startPos = match.index!;
      const endPos = matches[i + 1]?.index ?? text.length;
      
      // Extraire le segment pour cette chambre
      const segment = text.substring(startPos, endPos);
      const roomNumber = match[1];
      const roomType = match[2];
      
      // Extraire statut séjour
      const stayStatusMatch = segment.match(/\b(Parti|Recouche|En arrivée|Arrivé)\b/i);
      const stayStatus = stayStatusMatch?.[1] || 'unknown';
      
      // Extraire statut chambre  
      const roomStatusMatch = segment.match(/\b(Sale|A contrôler|À contrôler)\b/i);
      const roomStatus = roomStatusMatch?.[1] || '';
      
      // Extraire dates
      const dates = segment.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
      
      // Extraire nom client - entre "adulte(s)" et le statut
      let guestName = '';
      const guestMatch = segment.match(/\d+\s+adultes?\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)\s+(?:Parti|Recouche|En arrivée|Arrivé)/i);
      if (guestMatch) {
        guestName = guestMatch[1].trim();
      } else {
        // Essayer un autre pattern
        const altGuestMatch = segment.match(/adultes?\s+(.+?)\s+(?:Parti|Recouche|En arrivée|Arrivé)/i);
        if (altGuestMatch) {
          guestName = altGuestMatch[1].trim();
        }
      }
      
      const roomData: StructuredRoomData = {
        roomNumber,
        roomType,
        arrivalDate: dates?.[0] || '',
        departureDate: dates?.[1] || '',
        guestInfo: '',
        guestName,
        stayStatus,
        roomStatus
      };
      
      if (!roomDataMap.has(roomNumber)) {
        roomDataMap.set(roomNumber, []);
      }
      roomDataMap.get(roomNumber)!.push(roomData);
    }
    
    // Convertir avec fusion départ+arrivée
    return this.convertToExtractedRooms(roomDataMap, text);
  }

  /**
   * Fallback pour texte très mal formaté
   */
  private extractFromConcatenatedTextFallback(text: string): ExtractedRoom[] {
    console.log("📄 MedialogAdapter: Fallback - recherche pattern souple...");
    
    const roomDataMap = new Map<string, StructuredRoomData[]>();
    
    // Pattern très souple: juste chercher "Chambre TYPE" précédé d'un numéro
    const loosePattern = /(\d{1,3})\s+Chambre\s+(twin|double|triple|quadruple|simple)/gi;
    const matches = [...text.matchAll(loosePattern)];
    
    console.log(`📄 MedialogAdapter Fallback: ${matches.length} entrées trouvées`);
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const startPos = match.index!;
      const endPos = matches[i + 1]?.index ?? Math.min(startPos + 500, text.length);
      
      const segment = text.substring(startPos, endPos);
      const roomNumber = match[1];
      const roomType = `Chambre ${match[2]}`;
      
      // Chercher le statut dans le segment
      const stayStatusMatch = segment.match(/\b(Parti|Recouche|En arrivée|Arrivé)\b/i);
      const stayStatus = stayStatusMatch?.[1] || 'unknown';
      
      const roomStatusMatch = segment.match(/\b(Sale|A contrôler|À contrôler)\b/i);
      const roomStatus = roomStatusMatch?.[1] || '';
      
      const dates = segment.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
      
      const roomData: StructuredRoomData = {
        roomNumber,
        roomType,
        arrivalDate: dates?.[0] || '',
        departureDate: dates?.[1] || '',
        guestInfo: '',
        guestName: '',
        stayStatus,
        roomStatus
      };
      
      if (!roomDataMap.has(roomNumber)) {
        roomDataMap.set(roomNumber, []);
      }
      roomDataMap.get(roomNumber)!.push(roomData);
    }
    
    return this.convertToExtractedRooms(roomDataMap, text);
  }

  /**
   * Vérifie si le texte est au format "Rapport Housekeeping" structuré
   */
  private isStructuredReportFormat(text: string): boolean {
    const indicators = [
      'Rapport Housekeeping',
      'Ch.   Type de chambre',
      'Nom du client   Statut',
      'Adultes, enfants'
    ];
    const upperText = text.toUpperCase();
    return indicators.some(ind => upperText.includes(ind.toUpperCase()));
  }

  /**
   * Extrait les chambres depuis un rapport Housekeeping structuré
   */
  private extractFromStructuredReport(text: string): ExtractedRoom[] {
    const lines = text.split('\n');
    const roomDataMap = new Map<string, StructuredRoomData[]>();
    
    // Pattern pour extraire une ligne de chambre
    // Format: "01   Chambre twin   17/05/2025 15:00   19/05/2025 12:00   2 adultes   LI HANJIE   Recouche   Sale"
    const roomLinePattern = /^(\d{1,3})\s{2,}(Chambre\s+\w+)\s{2,}(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})\s{2,}(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})\s{2,}(.+?)\s{2,}([A-Za-zÀ-ÿ\s]+?)\s{2,}(Parti|Recouche|En arrivée|Arrivé)\s{2,}(Sale|A contrôler|À contrôler)/i;
    
    // Pattern simplifié pour lignes moins structurées
    const simplePattern = /^(\d{1,3})\s+.*?(Parti|Recouche|En arrivée|Arrivé)\s+(Sale|A contrôler|À contrôler)?/i;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Essayer d'abord le pattern complet
      let match = trimmedLine.match(roomLinePattern);
      
      if (match) {
        const roomData: StructuredRoomData = {
          roomNumber: match[1],
          roomType: match[2],
          arrivalDate: match[3],
          departureDate: match[5],
          guestInfo: match[7],
          guestName: match[8].trim(),
          stayStatus: match[9],
          roomStatus: match[10] || ''
        };
        
        if (!roomDataMap.has(roomData.roomNumber)) {
          roomDataMap.set(roomData.roomNumber, []);
        }
        roomDataMap.get(roomData.roomNumber)!.push(roomData);
      } else {
        // Essayer le pattern simplifié
        match = trimmedLine.match(simplePattern);
        if (match) {
          const roomNumber = match[1];
          const stayStatus = match[2];
          const roomStatus = match[3] || '';
          
          // Extraire le nom du client s'il existe
          const guestNameMatch = trimmedLine.match(/([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)+)/);
          
          // Extraire les dates si présentes
          const dateMatches = trimmedLine.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
          
          const roomData: StructuredRoomData = {
            roomNumber,
            roomType: this.extractRoomType(trimmedLine),
            arrivalDate: dateMatches?.[0] || '',
            departureDate: dateMatches?.[1] || '',
            guestInfo: '',
            guestName: guestNameMatch?.[1] || '',
            stayStatus,
            roomStatus
          };
          
          if (!roomDataMap.has(roomNumber)) {
            roomDataMap.set(roomNumber, []);
          }
          roomDataMap.get(roomNumber)!.push(roomData);
        }
      }
    }

    // Convertir en ExtractedRoom[] avec fusion départ+arrivée
    return this.convertToExtractedRooms(roomDataMap, text);
  }

  /**
   * Extrait le type de chambre d'une ligne
   */
  private extractRoomType(line: string): string {
    const types = ['Chambre twin', 'Chambre triple', 'Chambre double', 'Chambre quadruple', 'Chambre simple'];
    for (const type of types) {
      if (line.toLowerCase().includes(type.toLowerCase())) {
        return type;
      }
    }
    return '';
  }

  /**
   * Convertit les données structurées en ExtractedRoom[]
   * Gère la fusion des départs + arrivées pour le même numéro
   */
  private convertToExtractedRooms(
    roomDataMap: Map<string, StructuredRoomData[]>, 
    originalText: string
  ): ExtractedRoom[] {
    const rooms: ExtractedRoom[] = [];

    for (const [roomNumber, entries] of roomDataMap) {
      // Vérifier si on a départ + arrivée pour la même chambre
      const hasCheckout = entries.some(e => 
        e.stayStatus.toLowerCase() === 'parti' || e.stayStatus.toLowerCase() === 'départ'
      );
      const hasArrival = entries.some(e => 
        e.stayStatus.toLowerCase() === 'en arrivée' || e.stayStatus.toLowerCase() === 'arrivée'
      );
      
      if (hasCheckout && hasArrival && entries.length > 1) {
        // Fusion: départ + arrivée = À blanc
        const checkoutEntry = entries.find(e => 
          e.stayStatus.toLowerCase() === 'parti' || e.stayStatus.toLowerCase() === 'départ'
        )!;
        const arrivalEntry = entries.find(e => 
          e.stayStatus.toLowerCase() === 'en arrivée' || e.stayStatus.toLowerCase() === 'arrivée'
        )!;
        
        rooms.push({
          roomNumber,
          status: 'checkout_arrival',
          cleaningType: 'a_blanc',
          roomType: checkoutEntry.roomType || arrivalEntry.roomType,
          arrivalDate: arrivalEntry.arrivalDate,
          departureDate: checkoutEntry.departureDate,
          guestName: `${checkoutEntry.guestName} → ${arrivalEntry.guestName}`,
          rawStatuses: [checkoutEntry.stayStatus, arrivalEntry.stayStatus],
          originalText: `${checkoutEntry.stayStatus} + ${arrivalEntry.stayStatus}`,
          validated: false,
          confidence: 95,
          debugInfo: {
            rawLine: `Chambre ${roomNumber}: ${checkoutEntry.stayStatus} → ${arrivalEntry.stayStatus}`,
            cleanedLine: '',
            detectedKeywords: [checkoutEntry.stayStatus, arrivalEntry.stayStatus],
            appliedRule: 'Départ + Arrivée = À blanc',
            source: 'structured-parser',
            confidence: 95
          }
        });
      } else {
        // Traitement normal pour chaque entrée
        for (const entry of entries) {
          const { cleaning, status } = this.determineCleaningFromStatus(entry.stayStatus, entry.roomStatus);
          
          rooms.push({
            roomNumber,
            status,
            cleaningType: normalizeCleaningType(cleaning),
            roomType: entry.roomType,
            arrivalDate: entry.arrivalDate,
            departureDate: entry.departureDate,
            guestName: entry.guestName,
            rawStatuses: [entry.stayStatus, entry.roomStatus].filter(Boolean),
            originalText: `${entry.stayStatus}${entry.roomStatus ? ' - ' + entry.roomStatus : ''}`,
            validated: false,
            confidence: 90,
            debugInfo: {
              rawLine: `Chambre ${roomNumber}: ${entry.stayStatus}`,
              cleanedLine: '',
              detectedKeywords: [entry.stayStatus, entry.roomStatus].filter(Boolean),
              appliedRule: `Statut: ${entry.stayStatus}`,
              source: 'structured-parser',
              confidence: 90
            }
          });
        }
      }
    }

    // Trier par numéro de chambre
    return rooms.sort((a, b) => {
      const numA = parseInt(a.roomNumber, 10) || 0;
      const numB = parseInt(b.roomNumber, 10) || 0;
      return numA - numB;
    });
  }

  /**
   * Détermine le type de nettoyage basé sur le statut séjour
   */
  private determineCleaningFromStatus(stayStatus: string, roomStatus: string): { cleaning: CleaningType; status: string } {
    const stayLower = stayStatus.toLowerCase();
    
    if (stayLower === 'parti' || stayLower === 'départ') {
      return { cleaning: 'full', status: 'checkout' };
    }
    if (stayLower === 'recouche') {
      return { cleaning: 'quick', status: 'stayover' };
    }
    if (stayLower === 'en arrivée') {
      return { cleaning: 'full', status: 'arrival' };
    }
    if (stayLower === 'arrivé' || stayLower === 'arrive') {
      return { cleaning: 'none', status: 'occupied' };
    }
    
    // Par défaut, si la chambre est "Sale", c'est un nettoyage complet
    if (roomStatus.toLowerCase().includes('sale')) {
      return { cleaning: 'full', status: 'dirty' };
    }
    
    return { cleaning: 'none', status: 'unknown' };
  }

  /**
   * Override isValidRoomNumber pour être plus strict sur ce format
   */
  protected isValidRoomNumber(num: string, originalLine: string): boolean {
    const n = parseInt(num, 10);
    
    // Les chambres de cet hôtel sont entre 1 et 99 généralement
    if (isNaN(n) || n < 1 || n > 999) return false;
    
    // Exclure si dans un contexte "X adultes" ou "X enfants"
    if (/\d+\s*adultes?/i.test(originalLine) && originalLine.indexOf(num) > originalLine.search(/\d+\s*adultes?/i) - 3) {
      return false;
    }
    
    // Exclure les heures
    if (new RegExp(`${num}:\\d{2}`).test(originalLine) || new RegExp(`\\d{2}:${num}`).test(originalLine)) {
      return false;
    }
    
    // Exclure si fait partie d'une date (sauf en début de ligne)
    const datePattern = new RegExp(`[\\d]{1,2}[/\\-]${num}[/\\-]|${num}[/\\-][\\d]{1,2}[/\\-]`);
    if (datePattern.test(originalLine) && !originalLine.trim().startsWith(num)) {
      return false;
    }
    
    return true;
  }
}
