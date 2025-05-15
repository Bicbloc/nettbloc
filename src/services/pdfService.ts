
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

// Process PDF file using the existing algorithm
export async function processPdf(file: File): Promise<Room[]> {
  try {
    console.log("Démarrage du traitement standard du PDF:", file.name);
    
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
    
    console.log("PDF texte extrait (standard):", fullText.substring(0, 500) + "...");
    
    // Analyser le texte pour extraire les informations des chambres
    const rooms = parseRoomsFromText(fullText, false);
    console.log("Analyse standard, chambres détectées:", rooms.length);
    console.log("Exemple de chambres:", rooms.slice(0, 3));
    
    toast({
      title: "PDF Traité",
      description: `${file.name} analysé avec succès`,
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
      title: "Échec du traitement",
      description: "Une erreur s'est produite lors du traitement du fichier PDF.",
    });
    throw error;
  }
}

// Process PDF with DeepSeek-enhanced analysis
export async function processWithDeepSeek(file: File, apiKey: string): Promise<Room[]> {
  try {
    console.log("Démarrage de l'analyse avancée du PDF:", file.name);
    
    // Convertir le fichier en ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Charger le document PDF
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    console.log(`Document PDF chargé: ${pdf.numPages} pages`);
    
    // Extraire le texte de toutes les pages
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Extraction du texte de la page ${i}/${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }
    
    console.log("PDF texte extrait pour analyse avancée - longueur:", fullText.length);
    console.log("Extrait:", fullText.substring(0, 500) + "...");
    
    // Extraction des contextes de chambre pour une analyse avancée
    const roomContexts = extractRoomContexts(fullText);
    console.log(`Contextes de chambres extraits: ${roomContexts.length}`);
    
    // Utiliser l'analyse du texte avec la fonction améliorée
    const rooms = parseRoomsFromText(fullText, true);
    
    console.log("Chambres détectées avec analyse avancée:", rooms.length);
    console.log("Exemples de chambres avec types de nettoyage:");
    rooms.slice(0, 5).forEach(room => {
      console.log(`Chambre ${room.number}: status=${room.status}, cleaningType=${room.cleaningType}`);
    });
    
    if (rooms.length === 0) {
      console.log("Aucune chambre détectée avec l'analyse avancée, utilisation des données simulées");
      return generateMockRoomData();
    }
    
    // Vérifier la répartition des types de nettoyage
    const cleaningTypes = {
      full: rooms.filter(r => r.cleaningType === 'full').length,
      quick: rooms.filter(r => r.cleaningType === 'quick').length,
      none: rooms.filter(r => r.cleaningType === 'none').length
    };
    
    console.log("Répartition des types de nettoyage:", cleaningTypes);
    
    toast({
      title: "Analyse Avancée Complète",
      description: `${rooms.length} chambres analysées avec succès`,
    });
    
    return rooms;
  } catch (error) {
    console.error("Error processing PDF with advanced analysis:", error);
    toast({
      variant: "destructive",
      title: "Échec de l'Analyse",
      description: "Une erreur s'est produite lors de l'analyse avancée du PDF.",
    });
    throw error;
  }
}

// Fonction pour extraire le contexte autour des numéros de chambre
function extractRoomContexts(fullText: string): { roomNumber: string, context: string }[] {
  const roomContexts: { roomNumber: string, context: string }[] = [];
  const roomRegex = /\b([1-9]\d{2})\b/g;
  
  let match;
  while ((match = roomRegex.exec(fullText)) !== null) {
    const roomNumber = match[1];
    
    // Ne pas inclure les années comme 2025, 2026, 2027, 2028
    if (/^20(2[5-8])$/.test(roomNumber)) continue;
    
    // Extraire le contexte autour du numéro de chambre (±200 caractères)
    const start = Math.max(0, match.index - 200);
    const end = Math.min(fullText.length, match.index + 200);
    const context = fullText.substring(start, end);
    
    roomContexts.push({
      roomNumber,
      context
    });
  }
  
  // Éliminer les doublons en se basant sur le numéro de chambre
  const uniqueRoomNumbers = new Set<string>();
  return roomContexts.filter(item => {
    if (!uniqueRoomNumbers.has(item.roomNumber)) {
      uniqueRoomNumbers.add(item.roomNumber);
      return true;
    }
    return false;
  });
}

// Implémentation de la fonction d'analyse fournie par l'utilisateur
function determineStatusAndCleaningTypeNewRules(context: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  let status: string = 'needs-cleaning';
  let cleaningType: 'full' | 'quick' | 'none' = 'none';

  const dateMatches = context.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
  const timeMatches = context.match(/\b\d{1,2}:\d{2}\b/g) || [];
  const hasDIR = context.includes('DIR');
  const hasINS = context.includes('INS');
  const hasCL = context.includes('CL');

  // 🟦 Analyse du contexte
  const isLeftColumn = context.includes('Spaces') || context.includes('Espace'); // indicateur gauche
  const hasTwoClientBlocks = dateMatches.length >= 2 && timeMatches.length >= 1;
  const sameClientTwice = (context.match(/× Adultes.*\d{2}\/\d{2}\/\d{4}/g) || []).length >= 2;
  const oneBlockWithOnlyHour = dateMatches.length === 1 && timeMatches.length === 1;

  console.log("🔍 Analyse contexte: dates=" + dateMatches.length + 
              ", heures=" + timeMatches.length + 
              ", DIR=" + hasDIR + 
              ", INS=" + hasINS + 
              ", CL=" + hasCL + 
              ", isLeftColumn=" + isLeftColumn + 
              ", hasTwoClientBlocks=" + hasTwoClientBlocks + 
              ", sameClientTwice=" + sameClientTwice);

  // 🟥 Nettoyage à blanc : uniquement si ce n'est PAS le même client deux fois
  if (
    !sameClientTwice && (
      isLeftColumn ||
      hasTwoClientBlocks ||
      oneBlockWithOnlyHour ||
      (hasDIR && dateMatches.length >= 1)
    )
  ) {
    console.log("✅ Détecté: nettoyage COMPLET (à blanc)");
    return {
      status: 'needs-cleaning',
      cleaningType: 'full',
    };
  }

  // 🔵 Recouche : un seul bloc ou deux blocs du même client
  const hasSingleClient = dateMatches.length === 2 && context.includes('× Adultes');
  if (
    sameClientTwice ||
    (hasSingleClient && !hasTwoClientBlocks && !isLeftColumn && !oneBlockWithOnlyHour)
  ) {
    console.log("✅ Détecté: nettoyage RAPIDE (recouche)");
    return {
      status: 'needs-cleaning',
      cleaningType: 'quick',
    };
  }

  // 🟩 Propre
  const noDates = dateMatches.length === 0;
  if (
    (noDates && (hasINS || hasCL)) ||
    (hasINS && context.includes('× Adultes'))
  ) {
    console.log("✅ Détecté: chambre PROPRE");
    return {
      status: 'clean',
      cleaningType: 'none',
    };
  }

  // 🔧 Maintenance
  if (
    context.toLowerCase().includes('maintenance') ||
    context.toLowerCase().includes('hors service')
  ) {
    console.log("✅ Détecté: chambre en MAINTENANCE");
    return {
      status: 'maintenance',
      cleaningType: 'none',
    };
  }

  // 🟠 Occupée
  if (
    context.toLowerCase().includes('occupied') ||
    context.includes('OCC')
  ) {
    console.log("✅ Détecté: chambre OCCUPÉE");
    return {
      status: 'occupied',
      cleaningType: 'none',
    };
  }

  // 🔁 Par défaut
  console.log("⚠️ Aucun motif reconnu, par défaut: nettoyage COMPLET");
  return {
    status: 'needs-cleaning',
    cleaningType: 'full',
  };
}

// Analyse le texte pour extraire les informations des chambres
function parseRoomsFromText(text: string, useAdvancedAnalysis: boolean = false): Room[] {
  const rooms: Room[] = [];
  
  // Patterns améliorés pour détecter les numéros de chambre dans différents formats
  const patterns = [
    /\b(Spaces|Espace)\s+(\d{3})\b/gi,
    /\b([1-9]\d{2})\s+(SGL|DBL|TWN|DIR|CL|INS|SP|DX|CB)\b/gi,
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
    pattern.lastIndex = 0; // Réinitialiser l'index pour chaque nouvelle recherche
    
    while ((match = pattern.exec(text)) !== null) {
      // Récupérer le numéro de chambre correctement selon le pattern utilisé
      let roomNumber;
      
      if (match[1] === 'Spaces' || match[1] === 'Espace' || match[1] === 'Room' || match[1] === 'Chambre' || match[1] === 'No.' || match[1] === 'N°') {
        roomNumber = match[2];
      } else if (pattern.source.includes('\\d{1,2})(\\d{2})')) {
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
      let status, cleaningType;
      
      if (useAdvancedAnalysis) {
        // Utiliser la fonction d'analyse améliorée
        console.log(`\n🔍 Analyse avancée pour chambre ${roomNumber}`);
        console.log(`Contexte (extrait): "${context.substring(0, 50)}..."`);
        const result = determineStatusAndCleaningTypeNewRules(context);
        status = result.status;
        cleaningType = result.cleaningType;
        console.log(`📊 Résultat pour chambre ${roomNumber}: status=${status}, cleaningType=${cleaningType}`);
      } else {
        // Utiliser l'ancienne fonction d'analyse
        const result = determineStatusAndCleaningType(context);
        status = result.status;
        cleaningType = result.cleaningType;
      }
      
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
  
  // Deuxième passe pour essayer de trouver plus de numéros de chambres
  const genericRoomPattern = /\b(\d{3})\b/g;
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
    
    let status, cleaningType;
    
    if (useAdvancedAnalysis) {
      // Utiliser la fonction d'analyse améliorée
      console.log(`\n🔍 Analyse avancée pour chambre générique ${roomNumber}`);
      console.log(`Contexte (extrait): "${context.substring(0, 50)}..."`);
      const result = determineStatusAndCleaningTypeNewRules(context);
      status = result.status;
      cleaningType = result.cleaningType;
      console.log(`📊 Résultat pour chambre générique ${roomNumber}: status=${status}, cleaningType=${cleaningType}`);
    } else {
      // Utiliser l'ancienne fonction d'analyse
      const result = determineStatusAndCleaningType(context);
      status = result.status;
      cleaningType = result.cleaningType;
    }
    
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
  
  console.log(`\n📋 Détecté ${rooms.length} chambres avec le parsing ${useAdvancedAnalysis ? 'avancé' : 'standard'}`);
  
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
