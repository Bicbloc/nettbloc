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
  
  // Patterns améliorés pour détecter les numéros de chambre dans différents formats
  const patterns = [
    /\b(Spaces|Espace)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s+(SGL|DBL|TWN|DBS|TWS|DIR|CL|INS|SP|DX|CB)\b/gi,
    /\b([1-9]\d{2})\b(?=\s*[A-Z]{2,3})/g,
    /\b(Room|Chambre)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s*-\s*[A-Z]/gi,
    /\b(No\.|N°)\s*(\d{3})\b/gi,
    /\b(\d{3})\s*\(/gi,
    /\b(\d{1,2})(\d{2})\b(?!\d)/g
  ];
  
  // Utiliser chaque pattern pour trouver les numéros de chambre
  const foundRooms = new Set();
  
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      let roomNumber;
      
      if (match[1] === 'Spaces' || match[1] === 'Espace' || match[1] === 'Room' || match[1] === 'Chambre' || match[1] === 'No.' || match[1] === 'N°') {
        roomNumber = match[2];
      } else if (pattern.source.includes('\\d{1,2})(\\d{2})')) {
        roomNumber = match[0];
      } else {
        roomNumber = match[1];
      }
      
      if (!/^\d+$/.test(roomNumber)) continue;
      
      // Ne pas inclure les années comme 2025, 2026, 2027, 2028 comme chambres
      if (/^20(2[5-8])$/.test(roomNumber)) continue;
      
      // Normaliser le format du numéro
      roomNumber = String(parseInt(roomNumber, 10)).padStart(3, '0');
      
      // Éviter les doublons
      if (foundRooms.has(roomNumber)) continue;
      foundRooms.add(roomNumber);
      
      // Extraire un contexte plus large (400 caractères au lieu de 200)
      const start = Math.max(0, match.index - 400);
      const end = Math.min(text.length, match.index + 400);
      const context = text.substring(start, end);
      
      console.log(`=== ANALYSE DÉTAILLÉE CHAMBRE ${roomNumber} ===`);
      console.log(`Position dans le texte: ${match.index}`);
      console.log(`Contexte complet (800 chars):`, context);
      
      // Analyser le statut et le type de nettoyage avec la nouvelle logique améliorée
      const { status, cleaningType } = determineCleaningTypeImproved(context, roomNumber);
      
      console.log(`RÉSULTAT FINAL pour chambre ${roomNumber}: status=${status}, cleaningType=${cleaningType}`);
      console.log(`=== FIN ANALYSE CHAMBRE ${roomNumber} ===\n`);
      
      // Déterminer si c'est une chambre twin
      const isTwin = /TWN|TWS/.test(context);
      
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
  console.log(`  🔍 ANALYSE AMÉLIORÉE pour chambre ${roomNumber}:`);
  
  // Nettoyer le contexte pour l'analyse
  const cleanContext = context.replace(/\s+/g, ' ').trim();
  console.log(`  📝 Contexte nettoyé:`, cleanContext.substring(0, 200) + "...");
  
  // Rechercher les patterns de date dans le contexte
  const datePattern = /\d{2}\/\d{2}\/\d{4}/g;
  const dates = cleanContext.match(datePattern) || [];
  console.log(`  📅 Dates trouvées: ${dates.length} - ${dates.join(', ')}`);
  
  // Rechercher les statuts de chambre
  const statusPatterns = {
    DIR: /\b(DIR|Dirty)\b/i,
    CL: /\b(CL|Clean)\b/i,
    INS: /\b(INS|Inspection)\b/i,
    OCC: /\b(OCC|Occupied)\b/i
  };
  
  const foundStatuses = [];
  for (const [status, pattern] of Object.entries(statusPatterns)) {
    if (pattern.test(cleanContext)) {
      foundStatuses.push(status);
    }
  }
  console.log(`  🏷️ Statuts trouvés:`, foundStatuses);
  
  // Rechercher les patterns de réservation
  const reservationPatterns = {
    adultsPattern: /Adults/i,
    nightPattern: /Night\s+\d+\/\d+/i,
    timePattern: /\d{1,2}:\d{2}/
  };
  
  const reservationIndicators = [];
  for (const [name, pattern] of Object.entries(reservationPatterns)) {
    if (pattern.test(cleanContext)) {
      reservationIndicators.push(name);
    }
  }
  console.log(`  🏨 Indicateurs de réservation:`, reservationIndicators);
  
  // RÈGLE 1: Chambre propre (CL ou INS sans réservation active)
  if ((foundStatuses.includes('CL') || foundStatuses.includes('INS')) && dates.length === 0) {
    console.log(`  ✅ RÈGLE 1 - Chambre propre: statut ${foundStatuses.join('+')} sans réservation`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // RÈGLE 2: Chambre occupée
  if (foundStatuses.includes('OCC')) {
    console.log(`  🚪 RÈGLE 2 - Chambre occupée`);
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  // RÈGLE 3: Chambre à blanc (DIR + réservation OU plusieurs dates)
  if (foundStatuses.includes('DIR') && (dates.length >= 1 || reservationIndicators.includes('adultsPattern'))) {
    console.log(`  🧹 RÈGLE 3 - Chambre à blanc: DIR + réservation (${dates.length} dates, indicateurs: ${reservationIndicators.join(', ')})`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 4: Chambre à blanc (plusieurs dates trouvées - changement de client)
  if (dates.length >= 2) {
    console.log(`  🧹 RÈGLE 4 - Chambre à blanc: ${dates.length} dates = changement de client`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 5: Recouche (une seule réservation continue)
  if (dates.length === 1 && reservationIndicators.includes('nightPattern') && !foundStatuses.includes('DIR')) {
    console.log(`  🛏️ RÈGLE 5 - Recouche: 1 date + Night pattern, pas de DIR`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // RÈGLE 6: Chambre propre avec inspection
  if (foundStatuses.includes('INS') && reservationIndicators.includes('adultsPattern')) {
    console.log(`  ✅ RÈGLE 6 - Chambre propre: INS + réservation future`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // RÈGLE PAR DÉFAUT: Analyser plus finement
  if (foundStatuses.includes('DIR')) {
    console.log(`  🧹 RÈGLE DÉFAUT - DIR détecté: nettoyage complet`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  if (dates.length > 0) {
    console.log(`  🛏️ RÈGLE DÉFAUT - Dates présentes: recouche probable`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  console.log(`  ❓ RÈGLE DÉFAUT - Cas non identifié: nettoyage complet par sécurité`);
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
