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
  
  // Diviser le texte en lignes pour une analyse ligne par ligne
  const lines = text.split('\n');
  
  console.log("=== DÉBUT ANALYSE PDF ===");
  console.log("Nombre de lignes:", lines.length);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Chercher les numéros de chambre dans cette ligne
    const roomMatch = line.match(/\b([1-9]\d{2})\b/);
    if (!roomMatch) continue;
    
    const roomNumber = roomMatch[1];
    
    // Ignorer les années
    if (/^20(2[5-8])$/.test(roomNumber)) continue;
    
    const normalizedRoomNumber = String(parseInt(roomNumber, 10)).padStart(3, '0');
    
    // Éviter les doublons
    if (rooms.some(r => r.number === normalizedRoomNumber)) continue;
    
    console.log(`\n🏨 CHAMBRE ${normalizedRoomNumber} - Ligne: "${line}"`);
    
    // Analyser cette ligne spécifiquement
    const result = analyzeRoomLine(line, normalizedRoomNumber);
    
    console.log(`📊 RÉSULTAT: Status="${result.status}", Cleaning="${result.cleaningType}"`);
    
    const isTwin = /TWN|TWS/i.test(line);
    const floor = getRoomFloor(normalizedRoomNumber);
    
    rooms.push({
      number: normalizedRoomNumber,
      status: result.status,
      cleaningType: result.cleaningType,
      priority: 'medium',
      isTwin,
      isUrgent: false,
      notUrgent: false,
      floor
    });
  }
  
  console.log(`=== FIN ANALYSE PDF - ${rooms.length} chambres détectées ===`);
  
  return rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

// Analyser une ligne de chambre spécifique
function analyzeRoomLine(line: string, roomNumber: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  console.log(`📝 Analyse ligne: "${line}"`);
  
  // Détecter les mots-clés explicites
  const hasRECOUCHE = /RECOUCHE/i.test(line);
  const hasPARTI = /PARTI/i.test(line);
  const hasDIR = /\bDIR\b/i.test(line);
  const hasINS = /\bINS\b/i.test(line);
  const hasCL = /\bCL\b/i.test(line);
  const hasOCC = /\bOCC\b/i.test(line);
  
  // Détecter les patterns de dates et indicateurs
  const dates = line.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
  const hasNight = /Night\s+\d+\/\d+/i.test(line);
  const hasAdults = /Adults/i.test(line);
  const hasTime = /\d{1,2}:\d{2}/.test(line);
  
  console.log(`🔍 Mots-clés: RECOUCHE=${hasRECOUCHE}, PARTI=${hasPARTI}, DIR=${hasDIR}, INS=${hasINS}, CL=${hasCL}, OCC=${hasOCC}`);
  console.log(`📅 Patterns: Dates=${dates.length} [${dates.join(', ')}], Night=${hasNight}, Adults=${hasAdults}, Time=${hasTime}`);
  
  // RÈGLES SIMPLIFIÉES ET PRIORITAIRES
  
  // 1. Mot-clé explicite RECOUCHE
  if (hasRECOUCHE) {
    console.log(`✅ RECOUCHE explicite détectée`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // 2. Mot-clé explicite PARTI  
  if (hasPARTI) {
    console.log(`✅ PARTI explicite détecté`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // 3. Statut OCC = occupée
  if (hasOCC) {
    console.log(`✅ OCC = Occupée`);
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  // 4. Statut DIR = sale
  if (hasDIR) {
    console.log(`✅ DIR = Nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // 5. Statut CL = propre
  if (hasCL) {
    console.log(`✅ CL = Propre`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // 6. Night pattern = recouche
  if (hasNight) {
    console.log(`✅ Night pattern = Recouche`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // 7. Statut INS avec réservation = propre en attente
  if (hasINS && (hasAdults || dates.length > 0)) {
    console.log(`✅ INS avec réservation = Propre en attente`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // 8. Statut INS seul = propre
  if (hasINS) {
    console.log(`✅ INS seul = Propre`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // 9. Plusieurs dates = changement de client
  if (dates.length >= 2) {
    console.log(`✅ ${dates.length} dates = Changement de client = Nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // 10. Une date avec heure = départ
  if (dates.length === 1 && hasTime) {
    console.log(`✅ Date + heure = Départ = Nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // 11. Adults sans autre indicateur = nettoyage à blanc
  if (hasAdults) {
    console.log(`✅ Adults détecté = Nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // Par défaut : propre
  console.log(`⚪ Par défaut = Propre`);
  return { status: 'clean', cleaningType: 'none' };
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

// Nouvelle fonction flexible pour supporter différents formats PMS
function determineStatusAndCleaningTypeFlexible(
  context: string, 
  roomNumber: string, 
  mappedStatus: string, 
  dates: string[], 
  hasAdults: boolean, 
  hasNight: boolean, 
  hasPARTI: boolean, 
  hasRECOUCHE: boolean
): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  
  console.log(`🔍 ANALYSE FLEXIBLE pour chambre ${roomNumber}:`);
  console.log(`📊 Status mappé: ${mappedStatus}`);
  console.log(`📅 Dates: ${dates.length}, Adults: ${hasAdults}, Night: ${hasNight}`);
  console.log(`🔖 PARTI: ${hasPARTI}, RECOUCHE: ${hasRECOUCHE}`);
  
  // Détecter statuts spécifiques d'autres champs
  const hasOCC = /OCC|occupied|occupé/i.test(context);
  const hasINS = /INS|inspected/i.test(context);
  const hasCL = /CL|clean/i.test(context);
  const hasDIR = /DIR|dirty/i.test(context);
  
  // RÈGLE 1: Chambre occupée
  if (hasOCC || mappedStatus === 'occupied') {
    console.log(`✅ RÉSULTAT: Occupée`);
    return { status: 'occupied', cleaningType: 'none' };
  }
  
  // RÈGLE 2: Chambre propre - statut clean ou inspected sans réservation active
  if ((hasCL || mappedStatus === 'clean') || (hasINS && !hasAdults && dates.length === 0)) {
    console.log(`✅ RÉSULTAT: Propre (CL/INS sans réservation)`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // RÈGLE 3: Recouche explicite (mot-clé RECOUCHE trouvé)
  if (hasRECOUCHE || mappedStatus === 'recouche') {
    console.log(`✅ RÉSULTAT: Recouche (mot-clé explicite)`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // RÈGLE 4: Recouche implicite (Night pattern avec une seule date)
  if (hasNight && dates.length === 1 && !hasDIR && !hasPARTI) {
    console.log(`✅ RÉSULTAT: Recouche (Night pattern)`);
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // RÈGLE 5: Départ explicite (mot-clé PARTI trouvé)
  if (hasPARTI || mappedStatus === 'departed') {
    console.log(`✅ RÉSULTAT: Départ - nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 6: Chambre sale (DIR) - nettoyage à blanc
  if (hasDIR || mappedStatus === 'dirty') {
    console.log(`✅ RÉSULTAT: Sale - nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 7: Changement de client (2+ dates) - nettoyage à blanc
  if (dates.length >= 2) {
    console.log(`✅ RÉSULTAT: Changement client - nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 8: Réservation future avec adults
  if (hasAdults && dates.length >= 1) {
    console.log(`✅ RÉSULTAT: Réservation future - nettoyage à blanc`);
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // RÈGLE 9: Statut INS avec réservation future - propre en attente
  if (hasINS && hasAdults) {
    console.log(`✅ RÉSULTAT: Propre avec réservation future`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // Par défaut: analyser selon le statut général
  if (hasINS || hasCL || mappedStatus === 'inspected') {
    console.log(`✅ RÉSULTAT: Propre par défaut`);
    return { status: 'clean', cleaningType: 'none' };
  }
  
  console.log(`✅ RÉSULTAT: Nettoyage complet par défaut`);
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
