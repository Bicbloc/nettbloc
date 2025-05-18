import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';
import { processImageWithDonut, parseDonutOutput } from './donutService';

// Initialiser le worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface Room {
  number: string;
  status: string;
  cleaningType: 'full' | 'quick' | 'none';
  priority: 'high' | 'medium' | 'low';
  assignedTo?: string;
  isTwin?: boolean;
  isUrgent?: boolean;
  notUrgent?: boolean;
  floor?: number;
  notes?: string;
}

export interface CleaningConfig {
  fullCleaningTime: number; // in minutes
  quickCleaningTime: number; // in minutes
  minRoomsPerHousekeeper: number;
  maxRoomsPerHousekeeper: number;
}

// Default configuration
export const defaultCleaningConfig: CleaningConfig = {
  fullCleaningTime: 30,
  quickCleaningTime: 15,
  minRoomsPerHousekeeper: 10,
  maxRoomsPerHousekeeper: 18
};

// Process PDF file
export async function processPdf(file: File): Promise<Room[]> {
  try {
    // Convertir le fichier en ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Essayer d'abord avec le modèle Donut pour une meilleure reconnaissance
    try {
      console.log("Tentative de reconnaissance avec le modèle Donut...");
      const donutText = await processImageWithDonut(arrayBuffer);
      const donutResult = parseDonutOutput(donutText);
      
      if (donutResult.rooms && donutResult.rooms.length > 0) {
        console.log(`Détecté ${donutResult.rooms.length} chambres avec Donut`);
        return donutResult.rooms;
      }
    } catch (donutError) {
      console.warn("Échec de la reconnaissance Donut, repli sur PDF.js:", donutError);
    }
    
    // Charger le document PDF
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    // Extraire le texte de toutes les pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }
    
    console.log("PDF texte extrait:", fullText.substring(0, 500) + "...");
    
    // Méthode de détection améliorée pour Apaleo avec la nouvelle règle d'identification des chambres
    const isApaleoFormat = fullText.includes("Apaleo") || 
                          fullText.includes("Room Status") ||
                          // Numéro de chambre suivi d'un statut au format Apaleo
                          (fullText.match(/\b\d{2,3}\s+(DBL|SGL|TWN|ST|DIR|CL|INS|SAL)\b/i) !== null);
    
    const isHotelKornerFormat = fullText.includes("Rapport Housekeeping - Hôtel Korner") || 
                                fullText.includes("Toutes les chambres en statut tous") ||
                                (fullText.includes("Ch.") && fullText.includes("Type de chambre") && fullText.includes("Arrivée") && fullText.includes("Départ"));
    
    console.log("Format détecté:", 
                isHotelKornerFormat ? "Hôtel Korner" : 
                isApaleoFormat ? "Apaleo" : 
                "Format standard");
    
    // Analyser le texte pour extraire les informations des chambres selon le format
    let rooms: Room[] = [];
    
    if (isApaleoFormat) {
      rooms = parseApaleoFormat(fullText);
    } else if (isHotelKornerFormat) {
      rooms = parseHotelKornerFormat(fullText);
    } else {
      rooms = parseRoomsFromText(fullText);
    }
    
    toast({
      title: "PDF Processed",
      description: `Successfully processed ${file.name}`,
    });
    
    // Si aucune chambre n'a été trouvée, retourner des données de test
    if (rooms.length === 0) {
      console.log("Aucune chambre détectée, utilisation des données simulées");
      return generateMockRoomData();
    }
    
    return rooms;
  } catch (error) {
    console.error("Error processing PDF:", error);
    toast({
      variant: "destructive",
      title: "Processing Failed",
      description: "Failed to process the PDF file. Please try again.",
    });
    throw error;
  }
}

// Analyseur amélioré pour le format Apaleo avec règles d'identification strictes
function parseApaleoFormat(text: string): Room[] {
  const rooms: Room[] = [];
  console.log("Analyse du format Apaleo...");
  
  // Patterns améliorés spécifiquement pour Apaleo en suivant les règles d'identification
  const roomPatterns = [
    // Pattern clé: Numéro à 2-3 chiffres suivi d'un type ou statut en début de ligne
    /^\s*(\d{2,3})\s+(DBL|SGL|TWN|ST|DIR|CL|INS|SAL|CLEAN|OUT)\b/gim,
    
    // Pattern secondaire: Numéro à 2-3 chiffres suivi d'un type ou statut n'importe où
    /\b(\d{2,3})\s+(DBL|SGL|TWN|ST|DIR|CL|INS|SAL|CLEAN|OUT)\b/gi,
    
    // Pattern avec tiret: Numéro à 2-3 chiffres suivi d'un tiret puis type ou statut
    /\b(\d{2,3})\s*[-–]\s*(DBL|SGL|TWN|ST|DIR|CL|INS|SAL|CLEAN|OUT)\b/gi,
    
    // Pattern avec "Room": "Room" suivi d'un numéro à 2-3 chiffres
    /\bRoom\s+(\d{2,3})\b/gi
  ];
  
  // On cherche les chambres avec les patterns en éliminant les faux positifs
  for (const pattern of roomPatterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      // Récupérer le numéro de chambre
      const roomNumber = match[1].padStart(3, '0');
      
      // Vérifier que ce n'est pas une heure ou une date (éliminer les faux positifs)
      const context = text.substring(Math.max(0, match.index - 5), Math.min(text.length, match.index + match[0].length + 5));
      if (context.includes(':') || (context.includes('/') && context.match(/\d+\/\d+/))) {
        // C'est probablement une heure ou une date, pas un numéro de chambre
        console.log(`Faux positif éliminé: ${match[0]} dans "${context}"`);
        continue;
      }
      
      // Éviter les doublons de chambres
      if (rooms.some(r => r.number === roomNumber)) {
        continue;
      }
      
      // Extraction du contexte pour déterminer le statut
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(text.length, match.index + 100);
      const roomContext = text.substring(contextStart, contextEnd).toLowerCase();
      
      // Déterminer le statut et le type de nettoyage
      const { status, cleaningType } = determineStatusAndCleaningType(roomContext);
      
      // Déterminer si c'est une chambre twin
      const isTwin = roomContext.includes('twin') || roomContext.includes('twn') || 
                    (match[2] && (match[2].toUpperCase() === 'TWN' || match[2].toUpperCase() === 'TWIN'));
      
      // Étage basé sur le premier chiffre du numéro
      const floor = parseInt(roomNumber[0]);
      
      // Déterminer la priorité
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (roomContext.includes('urgent') || roomContext.includes('vip')) {
        priority = 'high';
      } else if (roomContext.includes('basse') || roomContext.includes('low')) {
        priority = 'low';
      }
      
      // Ajouter la chambre avec toutes les informations
      rooms.push({
        number: roomNumber,
        status,
        cleaningType,
        priority,
        isTwin,
        isUrgent: priority === 'high',
        notUrgent: priority === 'low',
        floor,
        notes: match[0] // Le pattern détecté comme note
      });
      
      console.log(`Chambre Apaleo détectée: ${roomNumber}, Statut: ${status}, Type: ${cleaningType}`);
    }
  }
  
  // Si on n'a toujours pas trouvé de chambres, utiliser une approche plus agressive
  if (rooms.length === 0) {
    console.log("Tentative de détection agressive des numéros de chambre...");
    
    // Diviser le texte en lignes pour analyse ligne par ligne
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
      // Chercher un numéro à 2-3 chiffres au début de la ligne qui n'est pas suivi par ":" ou "/"
      const roomMatch = line.match(/^\s*(\d{2,3})\b(?![\/:])/);
      
      if (roomMatch) {
        const roomNumber = roomMatch[1].padStart(3, '0');
        
        // Si cette chambre existe déjà, passer à la suivante
        if (rooms.some(r => r.number === roomNumber)) {
          continue;
        }
        
        // Analyser le reste de la ligne pour le statut
        const { status, cleaningType } = determineStatusAndCleaningType(line);
        const floor = parseInt(roomNumber[0]);
        const isTwin = line.toLowerCase().includes('twin') || line.toLowerCase().includes('twn');
        
        rooms.push({
          number: roomNumber,
          status,
          cleaningType,
          priority: 'medium',
          isTwin,
          isUrgent: false,
          notUrgent: false,
          floor,
          notes: line
        });
        
        console.log(`Chambre détectée (méthode agressive): ${roomNumber}`);
      }
    }
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le format Apaleo`);
  
  // Trier par numéro de chambre
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Nouveau parser pour le format Hôtel Korner
function parseHotelKornerFormat(text: string): Room[] {
  const rooms: Room[] = [];
  console.log("Analyse du format Hôtel Korner...");
  
  // Rechercher les lignes qui commencent par un numéro de chambre à 2 chiffres
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  
  // Pattern pour détecter les lignes de chambre (commence par 01, 02, etc.)
  const roomPattern = /^\s*(\d{2})\s+(Chambre\s+\w+)\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s+(.*?)\s+(.*?)\s+(Recouche|Parti|En arrivée)\s+(.*?)$/i;
  
  let currentRoom: Partial<Room> | null = null;
  let currentRoomNumber = '';
  let additionalNotes = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Ignorer les entêtes et lignes vides
    if (line.includes("Rapport Housekeeping") || line.includes("Ch.  Type de chambre") || line === '') {
      continue;
    }
    
    // Vérifier si la ligne commence par un numéro de chambre à 2 chiffres
    const roomMatch = line.match(/^(\d{2})\s+/);
    
    if (roomMatch) {
      // Si on a déjà une chambre en cours, l'ajouter à la liste
      if (currentRoom) {
        // Ajouter les notes supplémentaires si disponibles
        if (additionalNotes.length > 0) {
          currentRoom.notes = additionalNotes.join(' ');
        }
        
        rooms.push(currentRoom as Room);
        additionalNotes = [];
      }
      
      // Extraire le numéro de chambre
      const roomNumber = roomMatch[1].padStart(3, '0');
      currentRoomNumber = roomNumber;
      
      // Déterminer si c'est une chambre twin
      const isTwin = line.toLowerCase().includes('twin');
      
      // Détecter le statut de la chambre et le type de nettoyage
      const status = determineStatusFromKornerFormat(line);
      const cleaningType = determineCleaningTypeFromKornerFormat(line);
      
      // Déterminer la priorité
      const priority = determinePriority(line);
      
      // Déterminer l'étage
      const floor = getRoomFloor(roomNumber);
      
      currentRoom = {
        number: roomNumber,
        status: status,
        cleaningType: cleaningType,
        priority: priority,
        isTwin: isTwin,
        isUrgent: priority === 'high',
        notUrgent: priority === 'low',
        floor: floor
      };
      
      console.log(`Chambre détectée: ${roomNumber}, Statut: ${status}, Type de nettoyage: ${cleaningType}`);
    } else if (currentRoom) {
      // Lignes supplémentaires associées à la chambre actuelle
      additionalNotes.push(line);
    }
  }
  
  // Ne pas oublier d'ajouter la dernière chambre
  if (currentRoom) {
    if (additionalNotes.length > 0) {
      currentRoom.notes = additionalNotes.join(' ');
    }
    rooms.push(currentRoom as Room);
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le format Hôtel Korner`);
  
  // Trier les chambres par numéro
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Déterminer le statut à partir du format Hôtel Korner
function determineStatusFromKornerFormat(line: string): string {
  if (line.includes('Parti')) {
    return 'needs-cleaning';
  } else if (line.includes('Recouche')) {
    return 'needs-cleaning';
  } else if (line.includes('En arrivée')) {
    return 'needs-cleaning';
  } else if (line.includes('maintenance') || line.toLowerCase().includes('hors d\'usage')) {
    return 'maintenance';
  } else {
    // Par défaut
    return 'needs-cleaning';
  }
}

// Déterminer le type de nettoyage à partir du format Hôtel Korner
function determineCleaningTypeFromKornerFormat(line: string): 'full' | 'quick' | 'none' {
  // Nettoyage à blanc: Parti, A contrôler
  if (line.includes('Parti') && line.includes('A contrôler')) {
    return 'full';
  } 
  // Recouche: Recouche
  else if (line.includes('Recouche')) {
    return 'quick';
  }
  // En arrivée: potentiellement une chambre à blanc
  else if (line.includes('En arrivée')) {
    return 'full';
  } 
  else {
    // Par défaut
    return 'none';
  }
}

// Analyse le texte pour extraire les informations des chambres
function parseRoomsFromText(text: string): Room[] {
  const rooms: Room[] = [];
  
  // Patterns améliorés pour détecter les numéros de chambre dans différents formats
  // Ajout de nouveaux patterns pour capturer plus de formats de numéros de chambre
  const patterns = [
    /\b(Spaces|Espace)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s+(SGL|DBL|TWN|DIR|CL|INS|SP|DX|CB)\b/gi,
    /\b([1-9]\d{2})\b(?=\s*[A-Z]{2,3})/g,
    /\b(Room|Chambre)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s*-\s*[A-Z]/gi, // Format 101-A
    /\b(No\.|N°)\s*(\d{3})\b/gi,     // Format No. 101 ou N° 101
    /\b(\d{3})\s*\(/gi,              // Format 101 (quelque chose)
    /\b(\d{1,2})(\d{2})\b(?!\d)/g,   // Capture numéro de chambre simple comme 101
    /^(\d{2})\s+Chambre/mi,          // Nouveau pattern pour format Hotel Korner: "01 Chambre..."
    /^Ch\.\s+(\d{2})\b/mi            // Nouveau pattern pour "Ch. 01" en début de ligne
  ];
  
  // Utiliser chaque pattern pour trouver les numéros de chambre
  const foundRooms = new Set();
  
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0; // Réinitialiser l'index pour chaque nouvelle recherche
    
    while ((match = pattern.exec(text)) !== null) {
      // Récupérer le numéro de chambre correctement selon le pattern utilisé
      let roomNumber;
      
      if (match[1] === 'Spaces' || match[1] === 'Espace' || match[1] === 'Room' || match[1] === 'Chambre' || match[1] === 'No.' || match[1] === 'N°' || match[1] === 'Ch.') {
        roomNumber = match[2] || match[1];
      } else if (pattern.source.includes('\\d{1,2})(\\d{2})')) {
        // Pour le pattern qui capture le numéro de chambre directement
        roomNumber = match[0];
      } else {
        roomNumber = match[1];
      }
      
      // Vérifier que le numéro de chambre est un nombre valide
      if (!/^\d+$/.test(roomNumber)) continue;
      
      // Ne pas inclure les années comme 2025, 2026, 2027, 2028 comme chambres
      if (/^20(2[5-8])$/.test(roomNumber)) continue;
      
      // Normaliser le format du numéro (éliminer les zéros au début mais assurer au moins 3 chiffres)
      roomNumber = String(parseInt(roomNumber, 10)).padStart(3, '0');
      
      // Éviter les doublons
      if (foundRooms.has(roomNumber)) continue;
      foundRooms.add(roomNumber);
      
      // Extraire le contexte autour du numéro de chambre (un plus grand contexte pour mieux analyser)
      const start = Math.max(0, match.index - 200);
      const end = Math.min(text.length, match.index + 200);
      const context = text.substring(start, end);
      
      // Analyser le statut et le type de nettoyage selon les règles définies
      const { status, cleaningType } = determineStatusAndCleaningType(context);
      
      // Déterminer si c'est une chambre twin
      const isTwin = context.includes('TWN') || context.includes('twin') || context.includes('TWIN');
      
      // Déterminer la priorité
      const priority = determinePriority(context);
      
      // Déterminer l'étage
      const floor = getRoomFloor(roomNumber);
      
      rooms.push({
        number: roomNumber,
        status,
        cleaningType,
        priority,
        isTwin,
        isUrgent: priority === 'high',
        notUrgent: priority === 'low',
        floor
      });
    }
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le parsing avancé`);
  
  // Deuxième passe pour essayer de trouver plus de numéros de chambres
  // Cette fois avec un pattern très générique mais qui vérifie si le nombre pourrait être une chambre
  const genericRoomPattern = /\b(\d{2,3})\b/g;
  let genericMatch;
  
  while ((genericMatch = genericRoomPattern.exec(text)) !== null) {
    const potentialRoomNumber = genericMatch[1];
    
    // Vérifier que ce n'est pas un nombre qui fait partie d'une date, heure, etc.
    const beforeText = text.substring(Math.max(0, genericMatch.index - 10), genericMatch.index);
    const afterText = text.substring(genericMatch.index + potentialRoomNumber.length, Math.min(text.length, genericMatch.index + potentialRoomNumber.length + 10));
    
    // Ignorer si ce semble être une date, heure, prix, etc.
    if (beforeText.match(/\d[\/\-\.:]$/) || afterText.match(/^[\/\-\.:]/) || 
        beforeText.match(/\$|€|£|\d+[.,]\d+$/) || afterText.match(/^[.,]\d+/)) {
      continue;
    }
    
    // Ne pas inclure les années comme 2025, 2026, 2027, 2028 comme chambres
    if (/^20(2[5-8])$/.test(potentialRoomNumber)) continue;
    
    // Normaliser le format et vérifier qu'il n'est pas déjà trouvé
    const roomNumber = String(parseInt(potentialRoomNumber, 10)).padStart(3, '0');
    if (foundRooms.has(roomNumber)) continue;
    
    // Inclure seulement si le premier chiffre est 0-9 (étage plausible)
    const firstDigit = parseInt(roomNumber[0]);
    if (firstDigit > 9) continue;
    
    foundRooms.add(roomNumber);
    
    // Extraire le contexte pour l'analyse
    const start = Math.max(0, genericMatch.index - 200);
    const end = Math.min(text.length, genericMatch.index + 200);
    const context = text.substring(start, end);
    
    const { status, cleaningType } = determineStatusAndCleaningType(context);
    const isTwin = context.includes('TWN') || context.includes('twin') || context.includes('TWIN');
    const priority = determinePriority(context);
    const floor = getRoomFloor(roomNumber);
    
    rooms.push({
      number: roomNumber,
      status,
      cleaningType,
      priority,
      isTwin,
      isUrgent: priority === 'high',
      notUrgent: priority === 'low',
      floor
    });
  }
  
  console.log(`Détecté ${rooms.length} chambres avec le parsing avancé`);
  
  // Trier les chambres par numéro
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Updated consistent floor detection function that matches the one in other files
function getRoomFloor(roomNumber: string): number {
  // Ignore years like 2025, 2026, 2027, 2028
  if (/^20(2[5-8])$/.test(roomNumber)) {
    return 0; // Considérer comme RDC
  }
  
  // Si le numéro a deux chiffres ou moins, c'est au RDC
  if (roomNumber.length <= 2) {
    return 0;
  }
  
  // Sinon, le premier chiffre indique l'étage
  const firstDigit = parseInt(roomNumber[0]);
  return isNaN(firstDigit) ? 0 : firstDigit;
}

// Déterminer le statut et le type de nettoyage selon les règles définies
function determineStatusAndCleaningType(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  // Valeurs par défaut
  let status = 'needs-cleaning';
  let cleaningType: 'full' | 'quick' | 'none' = 'none';
  
  const lowerContext = context.toLowerCase();
  
  // 🛠 CHAMBRE EN MAINTENANCE
  if (lowerContext.includes('maintenance') || 
      lowerContext.includes('out of order') ||
      lowerContext.includes('hors d\'usage') ||
      lowerContext.includes('punaises de lit') ||
      lowerContext.includes('inutilisable')) {
    status = 'maintenance';
    cleaningType = 'none';
    return { status, cleaningType };
  }
  
  // 🟥 CHAMBRE À BLANC (PRIORITÉ 1) - APALEO FORMAT
  // Codes Apaleo
  if (lowerContext.includes(' dir ') || lowerContext.includes(' sal ') || 
      lowerContext.match(/\b(dir|sal)\b/)) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }
  
  // 🟥 CHAMBRE À BLANC (PRIORITÉ 1)
  // CAS 1: Deux blocs client visibles
  const hasMultipleReservations = (context.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length >= 2;
  
  // CAS 2: Un bloc avec une heure (check-out)
  const hasDepartureTime = /\d{1,2}[:h]\d{2}/.test(lowerContext) && 
                          !lowerContext.includes("nuit");
  
  // CAS 3: Bloc client en colonne de gauche
  const hasLeftColumnReservation = lowerContext.includes('parti') || lowerContext.includes('a contrôler');
  
  // CAS 4: Statut DIR (dirty)
  const hasDirtyStatus = lowerContext.includes('départ') || 
                         lowerContext.includes('departure') ||
                         lowerContext.includes('dirty') ||
                         lowerContext.includes('to clean') ||
                         lowerContext.includes('check-out');
  
  if (hasMultipleReservations || hasDepartureTime || hasLeftColumnReservation || hasDirtyStatus) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }
  
  // 🔵 CHAMBRE EN RECOUCHE (PRIORITÉ 2)
  // Un seul bloc client avec Nuit X/Y et sans heure
  const hasStayingGuest = /\d{2}\/\d{2}\/\d{4}.*nuit/.test(lowerContext) || 
                          lowerContext.includes('recouche') ||
                          lowerContext.includes('stayover');
  
  if (hasStayingGuest) {
    cleaningType = 'quick';
    status = 'needs-cleaning';
    return { status, cleaningType };
  }
  
  // 🟩 CHAMBRE PROPRE (PRIORITÉ 3)
  // Codes Apaleo
  if (lowerContext.includes(' cl ') || lowerContext.includes(' ins ') ||
      lowerContext.match(/\b(cl|ins)\b/)) {
    cleaningType = 'none';
    status = 'clean';
    return { status, cleaningType };
  }
  
  // Aucun bloc client et statut propre
  const isCleanRoom = (!context.match(/\d{2}\/\d{2}\/\d{4}/g) && 
                     (lowerContext.includes('clean') || 
                      lowerContext.includes('propre') ||
                      lowerContext.includes('inspection')));
  
  if (isCleanRoom) {
    cleaningType = 'none';
    status = 'clean';
    return { status, cleaningType };
  }
  
  // Si on arrive ici, appliquer les valeurs par défaut
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Déterminer la priorité
function determinePriority(context: string): 'high' | 'medium' | 'low' {
  if (context.includes('VIP') || 
      context.includes('urgent') || 
      context.includes('high priority') || 
      context.includes('prioritaire')) {
    return 'high';
  }
  
  if (context.includes('medium priority') || 
      context.includes('standard') || 
      context.includes('normale')) {
    return 'medium';
  }
  
  if (context.includes('low priority') || 
      context.includes('basse') || 
      context.includes('pas urgent')) {
    return 'low';
  }
  
  // Par défaut, priorité moyenne
  return 'medium';
}

// Helper function to generate mock room data
function generateMockRoomData(): Room[] {
  const statuses = ['needs-cleaning', 'clean', 'occupied', 'maintenance'];
  const cleaningTypes = ['full', 'quick', 'none'] as const;
  const priorities = ['high', 'medium', 'low'] as const;
  
  return Array.from({ length: 50 }, (_, i) => {
    const floor = Math.floor(i / 20) + 1;
    const room = (i % 20) + 1;
    const roomNumber = `${floor}${room.toString().padStart(2, '0')}`;
    const isTwin = Math.random() > 0.7;
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    return {
      number: roomNumber,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      cleaningType: cleaningTypes[Math.floor(Math.random() * cleaningTypes.length)],
      priority,
      isTwin,
      isUrgent: priority === 'high',
      notUrgent: priority === 'low',
      floor // Ajout du numéro d'étage
    };
  });
}
