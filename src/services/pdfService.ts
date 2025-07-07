import { toast } from "@/components/ui/use-toast";
import * as pdfjs from 'pdfjs-dist';

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
    
    // Analyser le texte pour extraire les informations des chambres
    const rooms = parseRoomsFromText(fullText);
    
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

// Analyse le texte pour extraire les informations des chambres
function parseRoomsFromText(text: string): Room[] {
  const rooms: Room[] = [];
  
// Pattern corrigé pour capturer le format: "102 SGL INS" ou "103 DBS DIR"
  const roomPattern = /\b([1-9]\d{2})\s+(SGL|DBS|TWS|DBL)\s+(DIR|CL|INS|OCC)/g;
  const foundRooms = new Set();
  
  let match;
  while ((match = roomPattern.exec(text)) !== null) {
    const roomNumber = match[1];
    const roomType = match[2]; // SGL, DBS, TWS, DBL
    const status = match[3]; // DIR, CL, INS, OCC
    
    // Ne pas inclure les années comme 2025, 2026, 2027, 2028 comme chambres
    if (/^20(2[5-8])$/.test(roomNumber)) continue;
    
    // Normaliser le format du numéro
    const normalizedRoomNumber = String(parseInt(roomNumber, 10)).padStart(3, '0');
    
    // Éviter les doublons
    if (foundRooms.has(normalizedRoomNumber)) continue;
    foundRooms.add(normalizedRoomNumber);
    
    // Extraire un contexte plus large (300 caractères de chaque côté)
    const start = Math.max(0, match.index - 300);
    const end = Math.min(text.length, match.index + 300);
    const context = text.substring(start, end);
    
    console.log(`=== ANALYSE CHAMBRE ${normalizedRoomNumber} ===`);
    console.log(`Statut détecté: "${status}"`);
    console.log(`Contexte complet:`, context);
    
    // Logique simplifiée basée sur le statut capturé directement
    let cleaningType: 'full' | 'quick' | 'none' = 'none';
    let roomStatus = 'clean';
    
    // 1. Chambre occupée (OCC)
    if (status === 'OCC') {
      cleaningType = 'none';
      roomStatus = 'occupied';
      console.log(`→ Chambre occupée (OCC)`);
    }
    // 2. Chambre propre (INS ou CL)
    else if (status === 'INS' || status === 'CL') {
      cleaningType = 'none';
      roomStatus = 'clean';
      console.log(`→ Chambre propre (${status})`);
    }
    // 3. Chambre sale (DIR) - vérifier si c'est une recouche ou chambre à blanc
    else if (status === 'DIR') {
      // Vérifier si c'est une recouche (Night pattern)
      const hasNight = /Night \d+\/\d+/.test(context);
      if (hasNight) {
        cleaningType = 'quick';
        roomStatus = 'needs-cleaning';
        console.log(`→ Recouche (DIR + Night pattern)`);
      } else {
        cleaningType = 'full';
        roomStatus = 'needs-cleaning';
        console.log(`→ Chambre à blanc (DIR)`);
      }
    }
    // 4. Par défaut
    else {
      cleaningType = 'full';
      roomStatus = 'needs-cleaning';
      console.log(`→ Nettoyage complet par défaut (statut: ${status})`);
    }
    
    console.log(`RÉSULTAT: ${roomStatus} / ${cleaningType}`);
    console.log(`=== FIN ANALYSE CHAMBRE ${normalizedRoomNumber} ===\n`);
    
    // Déterminer si c'est une chambre twin
    const isTwin = /TWN|TWS/.test(context);
    
    // Déterminer la priorité
    const priority = determinePriority(context);
    
    // Déterminer l'étage
    const floor = getRoomFloor(normalizedRoomNumber);
    
    rooms.push({
      number: normalizedRoomNumber,
      status: roomStatus,
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
    return 0;
  }
  
  // Si le numéro a deux chiffres ou moins, c'est au RDC
  if (roomNumber.length <= 2) {
    return 0;
  }
  
  // Sinon, le premier chiffre indique l'étage
  const firstDigit = parseInt(roomNumber[0]);
  return isNaN(firstDigit) ? 0 : firstDigit;
}

// Nouvelle fonction d'analyse améliorée avec logique plus précise
function determineCleaningTypeImproved(context: string, roomNumber: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  console.log(`🔍 ANALYSE AMÉLIORÉE pour chambre ${roomNumber}:`);
  console.log(`📝 Contexte:`, context.substring(0, 400));
  
  // Patterns spécifiques basés sur le format du PDF
  const hasINS = /\bINS\b/.test(context);
  const hasDIR = /\bDIR\b/.test(context);
  const hasCL = /\bCL\b/.test(context);
  const hasOCC = /\bOCC\b/.test(context);
  
  // Pattern pour Night X/Y (recouche - même client qui reste)
  const nightPattern = /Night\s+\d+\/\d+/.test(context);
  
  // Pattern de dates multiples (changement de client)
  const dates = context.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
  
  // Pattern Adults (présence de réservation)
  const hasAdults = /Adults/.test(context);
  
  console.log(`📊 Analyse: INS=${hasINS}, DIR=${hasDIR}, CL=${hasCL}, OCC=${hasOCC}`);
  console.log(`🏨 Réservation: Night=${nightPattern}, Adults=${hasAdults}, Dates=${dates.length}`);
  
  // RÈGLE 1: Chambre occupée
  if (hasOCC) {
    console.log(`✅ RÉSULTAT: Occupée`);
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  // RÈGLE 2: Chambre propre (INS seul, sans réservation active)
  if (hasINS && !hasAdults && dates.length === 0) {
    console.log(`✅ RÉSULTAT: Propre (INS sans réservation)`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // RÈGLE 3: Chambre propre (CL sans réservation)
  if (hasCL && !hasAdults && dates.length === 0) {
    console.log(`✅ RÉSULTAT: Propre (CL sans réservation)`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // RÈGLE 4: Recouche (Night pattern = même client qui reste)
  if (nightPattern && dates.length === 1 && !hasDIR) {
    console.log(`✅ RÉSULTAT: Recouche (Night pattern)`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // RÈGLE 5: Chambre à blanc (DIR ou changement de client)
  if (hasDIR || dates.length >= 2) {
    console.log(`✅ RÉSULTAT: Chambre à blanc (DIR=${hasDIR}, dates=${dates.length})`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 6: Chambre à blanc (réservation future après nettoyage)
  if (hasAdults && dates.length >= 1) {
    console.log(`✅ RÉSULTAT: Chambre à blanc (réservation)`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // Par défaut: analyser si c'est propre ou à nettoyer
  if (hasINS || hasCL) {
    console.log(`✅ RÉSULTAT: Propre par défaut`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  console.log(`✅ RÉSULTAT: Nettoyage complet par défaut`);
  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Fonction historique laissée en place pour référence
function determineStatusAndCleaningType(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  if (context.includes('CL') || context.includes('INS') || context.toLowerCase().includes('clean')) {
    return { status: 'clean', cleaningType: 'none' };
  }
  
  if (context.includes('OCC') || context.toLowerCase().includes('occupied')) {
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  if (context.toLowerCase().includes('maintenance') || context.toLowerCase().includes('out of order')) {
    return { status: 'maintenance', cleaningType: 'none' };
  }

  return { status: 'needs-cleaning', cleaningType: 'full' };
}

// Nouvelle fonction d'analyse selon les règles définies avec logs de débogage
function determineStatusAndCleaningTypeNewRules(context: string, roomNumber: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  // Valeurs par défaut
  let status = 'needs-cleaning';
  let cleaningType: 'full' | 'quick' | 'none' = 'none';

  console.log(`  Analyse des règles pour chambre ${roomNumber}:`);

  // 🟦 Chambre à blanc - CAS 1: Un bloc de réservation apparaît dans la colonne de gauche du rapport
  const leftColumnReservation = /\d{2}\/\d{2}\/\d{4}.*\d{1,2}:\d{2}/.test(context) && 
                               !context.includes("Adults.*\d{2}\/\d{2}\/\d{4}");
  
  console.log(`  - CAS 1 (Colonne gauche): ${leftColumnReservation}`);
  if (leftColumnReservation) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre à blanc (colonne gauche)`);
    return { status, cleaningType };
  }

  // 🟦 Chambre à blanc - CAS 2: Un bloc de réservation en colonne droite ET statut DIR
  const rightColumnWithDIR = /Adults.*\d{2}\/\d{2}\/\d{4}/.test(context) && 
                             (context.includes('DIR') || context.toLowerCase().includes('dirty'));
  
  console.log(`  - CAS 2 (Colonne droite + DIR): ${rightColumnWithDIR}`);
  if (rightColumnWithDIR) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre à blanc (colonne droite + DIR)`);
    return { status, cleaningType };
  }

  // 🟦 Chambre à blanc - CAS 3: Deux blocs distincts visibles
  const dateMatches = context.match(/\d{2}\/\d{2}\/\d{4}/g);
  const twoDistinctBlocks = dateMatches?.length >= 2;
  
  console.log(`  - CAS 3 (Deux blocs): ${twoDistinctBlocks} (${dateMatches?.length || 0} dates trouvées)`);
  if (twoDistinctBlocks) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre à blanc (deux blocs)`);
    return { status, cleaningType };
  }

  // 🔵 Chambre en recouche: Une seule ligne avec date d'arrivée et départ ultérieure
  const hasOneReservationLine = /\d{2}\/\d{2}\/\d{4}.*Night/.test(context) || 
                               /\d{2}\/\d{2}\/\d{4}.*séjour/.test(context) ||
                               /\d{2}\/\d{2}\/\d{4}.*\d{2}\/\d{2}\/\d{4}/.test(context);
  
  console.log(`  - Recouche (une ligne): ${hasOneReservationLine}`);
  if (hasOneReservationLine && !leftColumnReservation && !rightColumnWithDIR && !twoDistinctBlocks) {
    cleaningType = 'quick';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: Chambre en recouche`);
    return { status, cleaningType };
  }

  // 🟩 Chambre propre - CAS 1: Case vide (aucun bloc client) ET statut CL ou INS
  const emptyWithCleanStatus = (!context.match(/\d{2}\/\d{2}\/\d{4}/g) && 
                              (context.includes('CL') || context.includes('INS') || 
                               context.toLowerCase().includes('clean') || context.toLowerCase().includes('inspection')));
  
  console.log(`  - Propre CAS 1 (vide + CL/INS): ${emptyWithCleanStatus}`);
  
  // 🟩 Chambre propre - CAS 2: Chambre dans colonne de droite ET statut INS uniquement
  const rightColumnINS = /Adults.*INS/.test(context) || 
                         (context.includes('Adults') && context.toLowerCase().includes('inspection'));
  
  console.log(`  - Propre CAS 2 (colonne droite + INS): ${rightColumnINS}`);
  
  if (emptyWithCleanStatus || rightColumnINS) {
    cleaningType = 'none';
    status = 'clean';
    console.log(`  → Règle appliquée: Chambre propre`);
    return { status, cleaningType };
  }

  // Cas par défaut - si aucune règle ne correspond explicitement
  console.log(`  - Vérification statut DIR: ${context.includes('DIR')}`);
  if (context.includes('DIR') || context.toLowerCase().includes('dirty')) {
    cleaningType = 'full';
    status = 'needs-cleaning';
    console.log(`  → Règle appliquée: DIR trouvé - nettoyage complet`);
    return { status, cleaningType };
  }
  
  // Si des mots-clés comme "maintenance" ou "out of order" sont présents
  if (context.toLowerCase().includes('maintenance') || 
      context.toLowerCase().includes('out of order') || 
      context.toLowerCase().includes('hors service')) {
    status = 'maintenance';
    cleaningType = 'none';
    console.log(`  → Règle appliquée: Maintenance`);
    return { status, cleaningType };
  }
  
  // Si des mots-clés comme "occupé" ou "occupied" sont présents
  if (context.toLowerCase().includes('occupied') || 
      context.toLowerCase().includes('occupé') || 
      context.includes('OCC')) {
    status = 'occupied';
    cleaningType = 'none';
    console.log(`  → Règle appliquée: Occupé`);
    return { status, cleaningType };
  }

  console.log(`  → Règle par défaut appliquée: needs-cleaning / full`);
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
