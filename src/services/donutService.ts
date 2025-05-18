
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
    
    // Construire le prompt pour l'extraction d'informations spécifiques
    const task_prompt = prompt || 
      "Extract these fields from this housekeeping report: room number, status (recouche/départ/arrivée/stayover/departure/clean/propre/maintenance), cleaning type, clients names";
    
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
    
    // Analyse ligne par ligne
    const lines = donutText.split('\n');
    const rooms = [];
    
    for (const line of lines) {
      // Recherche de patterns comme "Chambre 01: Recouche" ou "01 - Recouche" ou "101 DBL DIR"
      const roomMatch = line.match(/(?:Chambre\s*)?(\d{1,3})(?:\s*[-:]\s*|\s+)(.+)/i);
      
      if (roomMatch) {
        const roomNumber = roomMatch[1].padStart(3, '0');
        const statusInfo = roomMatch[2].toLowerCase();
        
        // Déterminer le statut et le type de nettoyage selon les règles avancées
        const { status, cleaningType } = determineStatusAndCleaningType(line, statusInfo);
        
        // Déterminer la priorité
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (statusInfo.includes('urgent') || statusInfo.includes('vip')) {
          priority = 'high';
        } else if (statusInfo.includes('basse priorité') || statusInfo.includes('low priority')) {
          priority = 'low';
        }
        
        // Déterminer si c'est une chambre twin
        const isTwin = determineIfTwin(line, statusInfo);
        
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
 * @param statusInfo - Informations de statut extraites
 * @returns Booléen indiquant si la chambre est twin
 */
function determineIfTwin(line: string, statusInfo: string): boolean {
  const lowerLine = line.toLowerCase();
  return lowerLine.includes('twin') || 
         lowerLine.includes('twn') || 
         statusInfo.includes('twin') || 
         statusInfo.includes('twn');
}

/**
 * Détermine le statut et le type de nettoyage selon les règles détaillées
 * @param line - Ligne complète contenant les informations de la chambre
 * @param statusInfo - Informations de statut extraites
 * @returns Objet contenant le statut et le type de nettoyage
 */
function determineStatusAndCleaningType(line: string, statusInfo: string): { status: string, cleaningType: 'full' | 'quick' | 'none' } {
  const lowerLine = line.toLowerCase();
  
  // 🛠 CHAMBRE EN MAINTENANCE
  if (lowerLine.includes('maintenance') || 
      lowerLine.includes('out of service') ||
      lowerLine.includes('out of order') ||
      lowerLine.includes('hors d\'usage') ||
      lowerLine.includes('hors service') ||
      lowerLine.includes('punaises de lit') ||
      lowerLine.includes('inutilisable')) {
    return { status: 'maintenance', cleaningType: 'none' };
  }
  
  // 🟥 CHAMBRE À BLANC (Départ)
  // Détection prioritaire par mots-clés explicites
  if (lowerLine.includes('départ') || 
      lowerLine.includes('departure') || 
      lowerLine.includes('to clean') ||
      lowerLine.includes('parti') ||
      lowerLine.includes('dir') || 
      lowerLine.includes('sal') || 
      lowerLine.includes('dirty') ||
      lowerLine.includes('check-out')) {
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // Détection par présence de deux noms/clients différents
  const hasMultipleNames = 
    (line.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || []).length >= 2 || // Détecte au moins deux noms propres
    (lowerLine.includes('/') && !lowerLine.includes('nuit')); // Format "Dupont / Martin"
  
  // Détection par présence d'une heure (format 11:00, 15:00, etc.)
  const hasTimePattern = /\d{1,2}:\d{2}/.test(lowerLine);
  
  // Détection par présence de deux dates (probablement check-in et check-out)
  const hasTwoDates = (line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).length >= 2;
  
  if (hasMultipleNames || hasTimePattern || hasTwoDates) {
    return { status: 'needs-cleaning', cleaningType: 'full' };
  }
  
  // 🔵 CHAMBRE EN RECOUCHE (Recouche / Stayover)
  if (lowerLine.includes('recouche') || 
      lowerLine.includes('stayover') ||
      lowerLine.includes('stay over')) {
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // Détection par "Nuit X/Y"
  if (/nuit \d+\/\d+/.test(lowerLine)) {
    return { status: 'needs-cleaning', cleaningType: 'quick' };
  }
  
  // 🟢 CHAMBRE PROPRE (Propre / Clean / INS / CL)
  if (lowerLine.includes('propre') || 
      lowerLine.includes('clean') ||
      lowerLine.includes('ins') || 
      lowerLine.includes('cl') ||
      lowerLine.includes('inspected') ||
      lowerLine.includes('inspection')) {
    return { status: 'clean', cleaningType: 'none' };
  }
  
  // Par défaut - considérer comme chambre à nettoyer (à blanc)
  return { status: 'needs-cleaning', cleaningType: 'full' };
}
