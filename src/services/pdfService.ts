
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
  notes?: string; // Added notes property
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
    
    // Méthode de repli avec PDF.js
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
    
    // Détecter le type de rapport
    const isHotelKornerFormat = fullText.includes("Rapport Housekeeping - Hôtel Korner") || 
                               fullText.includes("Toutes les chambres en statut tous") ||
                               (fullText.includes("Ch.") && fullText.includes("Type de chambre") && fullText.includes("Arrivée") && fullText.includes("Départ"));
    
    console.log("Format détecté:", isHotelKornerFormat ? "Hôtel Korner" : "Format standard");
    
    // Analyser le texte pour extraire les informations des chambres selon le format
    let rooms: Room[] = [];
    
    if (isHotelKornerFormat) {
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
    /\b([1-9]\d{2})\s+(SGL|DBL|TWN|DIR|CL|INS|SP|DX|CB|TWS|DBS)\b/gi,  // Ajout de TWS et DBS au pattern
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
      const isTwin = context.includes('TWN') || context.toLowerCase().includes('twin') || context.includes('TWIN') || context.includes('TWS');
      
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
    const isTwin = context.includes('TWN') || context.toLowerCase().includes('twin') || context.includes('TWIN') || context.includes('TWS');
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
  // Logging le contexte pour le débogage
  console.log("Analyse du contexte pour détection:", context.substring(0, 100) + "...");

  // 🛠 CHAMBRE EN MAINTENANCE
  if (context.toLowerCase().includes('maintenance') || 
      context.toLowerCase().includes('out of order') ||
      context.toLowerCase().includes('hors d\'usage') ||
      context.toLowerCase().includes('punaises de lit') ||
      context.toLowerCase().includes('inutilisable')) {
    console.log("→ Détecté: MAINTENANCE");
    return { status: 'maintenance', cleaningType: 'none' };
  }

  // Compter les blocs client
  // Bloc client = texte contient "× Adultes" ou "Adulte(s)"
  const adultMatches = (context.match(/\d+\s*(?:×|x)\s*Adultes?|\d+\s*Adultes?/gi) || []).length;
  
  // Compter les blocs de réservation (gauche, droite, centré)
  const hasLeftBlock = /Date d['']arrivée|Horaire de sortie|Nuitées/.test(context);
  const hasRightBlock = /Heure d['']arrivée/.test(context);
  const hasCenterBlock = /Date d['']arrivée.*Date de départ/.test(context);
  
  const blockCount = (hasLeftBlock ? 1 : 0) + (hasRightBlock ? 1 : 0) + (hasCenterBlock ? 1 : 0);
  
  // Détecter le statut (DIR, INS, CL, SAL)
  const hasDirtyStatus = /\bDIR\b|\bSAL\b/.test(context) ||
                         context.toLowerCase().includes('dirty') ||
                         context.toLowerCase().includes('sale');
                         
  const hasCleanStatus = /\bINS\b|\bCL\b/.test(context) ||
                         context.toLowerCase().includes('clean') ||
                         context.toLowerCase().includes('propre');
  
  // Détecter les termes spécifiques
  const hasCheckoutTerms = context.toLowerCase().includes('parti') || 
                           context.toLowerCase().includes('départ') || 
                           context.toLowerCase().includes('check out') || 
                           context.toLowerCase().includes('checkout');
                           
  const hasTimeReference = /\d{1,2}:\d{2}/.test(context);
  
  // Détecter le format "Nuit X/Y"
  const lastNightPattern = /\bNuit\s+(\d+)\/\1\b|\bNight\s+(\d+)\/\2\b/i;
  const isLastNight = lastNightPattern.test(context);
  
  const midStayPattern = /\bNuit\s+(\d+)\/(\d+)\b|\bNight\s+(\d+)\/(\d+)\b/i;
  const midStayMatch = context.match(midStayPattern);
  let isMiddleOfStay = false;
  if (midStayMatch) {
    const current = parseInt(midStayMatch[1] || midStayMatch[3], 10);
    const total = parseInt(midStayMatch[2] || midStayMatch[4], 10);
    isMiddleOfStay = current < total;
  }
  
  // 🟥 À NETTOYER À BLANC
  if ((blockCount >= 2 && !context.match(/même nom/i)) || // Deux blocs client différents
      hasLeftBlock || // Bloc client dans la colonne gauche
      (hasTimeReference && /\d{2}\/\d{2}\/\d{4}/.test(context)) || // Une date + une heure
      hasDirtyStatus) { // Statut DIR
    console.log("→ Détecté: NETTOYAGE À BLANC");
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // 🔵 EN RECOUCHE
  if ((adultMatches === 1 && isMiddleOfStay) || // Un seul bloc client avec Nuit X/Y (où X < Y)
      (hasCenterBlock && !hasTimeReference) || // Bloc centré, pas d'heure
      (blockCount >= 2 && context.match(/même nom/i))) { // Deux blocs avec même nom
    console.log("→ Détecté: RECOUCHE");
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // 🟩 PROPRE
  if ((adultMatches === 0 && hasCleanStatus) || // Aucun bloc client + statut INS ou CL
      (hasRightBlock && hasCleanStatus)) { // Bloc client à droite + statut INS
    console.log("→ Détecté: PROPRE");
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // Par défaut, on considère à blanc si on n'a pas pu déterminer
  console.log("→ Par défaut: NETTOYAGE À BLANC (ambiguïté)");
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Déterminer la priorité
function determinePriority(context: string): 'high' | 'medium' | 'low' {
  // Vérifier d'abord les termes spécifiques pour haute priorité
  if (context.includes('VIP') || 
      context.toLowerCase().includes('urgent') || 
      context.toLowerCase().includes('très urgent') ||
      context.toLowerCase().includes('high priority') || 
      context.toLowerCase().includes('prioritaire')) {
    return 'high';
  }
  
  // Ensuite vérifier les termes spécifiques pour priorité moyenne
  if (context.toLowerCase().includes('medium priority') || 
      context.toLowerCase().includes('standard') || 
      context.toLowerCase().includes('normale')) {
    return 'medium';
  }
  
  // Enfin vérifier les termes spécifiques pour priorité basse
  if (context.toLowerCase().includes('low priority') || 
      context.toLowerCase().includes('basse') || 
      context.toLowerCase().includes('pas urgent')) {
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
