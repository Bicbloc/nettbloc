
// Clé API Hugging Face
const API_TOKEN = "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";
const API_URL = "https://api-inference.huggingface.co/models/naver-clova-ix/donut-base-finetuned-docvqa";

interface DonutResponse {
  generated_text: string;
}

/**
 * Envoie une image au modèle Donut pour l'OCR et l'extraction d'informations
 * @param imageData - Les données de l'image en ArrayBuffer
 * @param prompt - Le prompt pour guider l'extraction (optionnel)
 * @returns Les données extraites sous forme de texte JSON
 */
export async function processImageWithDonut(imageData: ArrayBuffer, prompt?: string): Promise<string> {
  try {
    console.log("Envoi de l'image au modèle Donut...");
    
    // Prompt amélioré pour mieux reconnaître les formats Apaleo avec instructions explicites sur les numéros de chambre
    const task_prompt = prompt || 
      `Extract room data from this housekeeping report.
      
      Room numbers are found at the beginning of lines, consisting of 2-3 digits (e.g. 101, 01) followed by room types/status (e.g. DBL, SGL, DIR, CL).
      
      Don't confuse with time (11:00) or date (11/05/2025).
      
      Valid examples:
      - "101 DBL DIR"
      - "011 SGL CL"
      - "10 TWN SAL"
      
      Extract: room number, type, and status (DIR/SAL/CL/INS/OUT/recouche/départ/clean).`;
    
    // Créer un FormData pour envoyer l'image et le prompt
    const formData = new FormData();
    formData.append("file", new Blob([imageData], {type: "application/pdf"}));
    formData.append("task_prompt", task_prompt);
    
    // Appeler l'API Hugging Face
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }
    
    const result: DonutResponse = await response.json();
    console.log("Réponse Donut:", result);
    
    return result.generated_text;
  } catch (error) {
    console.error("Erreur lors du traitement avec Donut:", error);
    throw error;
  }
}

/**
 * Parse les données textuelles extraites par Donut selon les règles de classification avancées
 * @param donutText - Le texte extrait par Donut
 * @returns Un objet structuré avec les chambres et leurs informations
 */
export function parseDonutOutput(donutText: string) {
  try {
    // Tentative de parsing JSON si la sortie est au format JSON
    try {
      return JSON.parse(donutText);
    } catch {
      // Si ce n'est pas du JSON, on continue avec le parsing de texte
    }
    
    // Analyse ligne par ligne avec règles améliorées
    const lines = donutText.split('\n');
    const rooms = [];
    
    // REGEX améliorée pour détecter les numéros de chambre au début des lignes
    // suivis d'un type ou statut de chambre (mais pas d'une heure ou date)
    const roomPattern = /^\s*(\d{2,3})\s+(DBL|SGL|TWN|ST|DIR|CL|INS|SAL|CLEAN|REC|OUT)\b/i;
    
    for (const line of lines) {
      // Appliquer la REGEX pour vérifier si la ligne commence par un numéro de chambre valide
      const roomMatch = line.match(roomPattern);
      
      if (roomMatch) {
        const roomNumber = roomMatch[1].padStart(3, '0');
        const roomType = roomMatch[2].toUpperCase();
        
        // S'assurer que ce n'est pas une heure ou une date
        if (line.includes(':') && line.indexOf(':') < 5) continue; // Éviter les lignes commençant par une heure
        if (line.includes('/') && line.indexOf('/') < 5) continue; // Éviter les lignes commençant par une date
        
        // Déterminer le statut et le type de nettoyage selon les règles avancées
        const { status, cleaningType } = determineStatusAndCleaningType(line);
        
        // Déterminer la priorité
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (line.toLowerCase().includes('urgent') || line.toLowerCase().includes('vip')) {
          priority = 'high';
        } else if (line.toLowerCase().includes('basse priorité') || line.toLowerCase().includes('low priority')) {
          priority = 'low';
        }
        
        // Déterminer si c'est une chambre twin
        const isTwin = determineIfTwin(line, roomType);
        
        // Récupérer l'étage
        const floor = parseInt(roomNumber[0]);
        
        rooms.push({
          number: roomNumber,
          status,
          cleaningType,
          priority,
          isTwin,
          isUrgent: priority === 'high',
          notUrgent: priority === 'low',
          floor,
          notes: line // Conserver la ligne complète comme note
        });
        
        console.log(`Chambre détectée: ${roomNumber}, Type: ${roomType}, Statut: ${status}, Nettoyage: ${cleaningType}`);
      }
    }
    
    return { rooms };
  } catch (error) {
    console.error("Erreur lors du parsing de la sortie Donut:", error);
    return { rooms: [] };
  }
}

/**
 * Détermine si une chambre est de type Twin
 * @param line - Ligne complète contenant les informations de la chambre
 * @param roomType - Type de chambre extrait
 * @returns Booléen indiquant si la chambre est twin
 */
function determineIfTwin(line: string, roomType: string): boolean {
  const lowerLine = line.toLowerCase();
  return lowerLine.includes('twin') || 
         lowerLine.includes('twn') || 
         roomType.includes('TWN') ||
         roomType.includes('TWIN');
}

/**
 * Détermine le statut et le type de nettoyage selon les règles détaillées
 * @param line - Ligne complète contenant les informations de la chambre
 * @param statusInfo - Informations de statut extraites
 * @returns Objet contenant le statut et le type de nettoyage
 */
function determineStatusAndCleaningType(line: string, statusInfo?: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  const lowerLine = (line || '').toLowerCase();
  const lowerStatus = (statusInfo || '').toLowerCase();
  
  // 🛠 CHAMBRE EN MAINTENANCE
  if (lowerLine.includes('maintenance') || 
      lowerLine.includes('out of service') ||
      lowerLine.includes('out of order') ||
      lowerLine.includes('hors d\'usage') ||
      lowerLine.includes('hors service') ||
      lowerLine.includes('punaises de lit') ||
      lowerLine.includes('inutilisable') ||
      lowerLine.includes(' out ') ||
      lowerStatus.includes('maintenance')) {
    return { status: 'maintenance', cleaningType: 'none' };
  }
  
  // 🟥 CHAMBRE À BLANC (Départ)
  // Détection directe par codes Apaleo
  if (lowerLine.includes(' dir ') || lowerLine.includes(' sal ') ||
      lowerLine.match(/\bdir\b/) || lowerLine.match(/\bsal\b/)) {
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // Détection prioritaire par mots-clés explicites
  if (lowerLine.includes('départ') || 
      lowerLine.includes('departure') || 
      lowerLine.includes('to clean') ||
      lowerLine.includes('parti') ||
      lowerLine.includes('dirty') ||
      lowerLine.includes('check-out') ||
      lowerStatus.includes('départ') ||
      lowerStatus.includes('departure') ||
      lowerStatus.includes('dir') ||
      lowerStatus.includes('sal') ||
      lowerStatus.includes('dirty')) {
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // Format Apaleo - Départ (à blanc)
  // Recherche spécifique pour le format Apaleo avec heure de départ
  if (lowerLine.match(/\d{1,2}[:h]\d{2}/) && !lowerLine.includes('nuit')) {
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // Détection par présence de deux noms/clients différents
  const hasMultipleNames = 
    (line.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || []).length >= 2 || // Détecte au moins deux noms propres
    (lowerLine.includes('/') && !lowerLine.includes('nuit')); // Format "Dupont / Martin"
  
  // Détection par présence de deux dates (probablement check-in et check-out)
  const hasTwoDates = (line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).length >= 2;
  
  if (hasMultipleNames || hasTwoDates) {
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // 🔵 CHAMBRE EN RECOUCHE (Recouche / Stayover)
  if (lowerLine.includes('recouche') || 
      lowerLine.includes('stayover') ||
      lowerLine.includes('stay over') ||
      lowerLine.includes(' rec ') ||
      lowerLine.match(/\brec\b/) ||
      lowerStatus.includes('recouche') ||
      lowerStatus.includes('stayover')) {
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // Détection par "Nuit X/Y"
  if (lowerLine.match(/nuit \d+\/\d+/)) {
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // 🟢 CHAMBRE PROPRE (Propre / Clean / INS / CL)
  if (lowerLine.includes(' cl ') || lowerLine.includes(' ins ') ||
      lowerLine.match(/\bcl\b/) || lowerLine.match(/\bins\b/) ||
      lowerLine.includes('propre') || 
      lowerLine.includes('clean') ||
      lowerLine.includes('inspected') ||
      lowerLine.includes('inspection') ||
      lowerStatus.includes('cl') ||
      lowerStatus.includes('ins') ||
      lowerStatus.includes('propre') ||
      lowerStatus.includes('clean')) {
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // Par défaut - considérer comme chambre à nettoyer (à blanc)
  return { status: 'needs-cleaning', cleaningType: 'full' };
}
