
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
      "Extract these fields from this housekeeping report: room number, status (recouche/départ/arrivée), cleaning type";
    
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
 * Parse les données textuelles extraites par Donut
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
      // Recherche de patterns comme "Chambre 01: Recouche" ou "01 - Recouche"
      const roomMatch = line.match(/(?:Chambre\s*)?(\d{1,3})(?:\s*[-:]\s*|\s+)(.+)/i);
      
      if (roomMatch) {
        const roomNumber = roomMatch[1].padStart(3, '0');
        const statusInfo = roomMatch[2].toLowerCase();
        
        // Déterminer le statut et le type de nettoyage
        let status = 'needs-cleaning';
        let cleaningType: 'full' | 'quick' | 'none' = 'none';
        
        if (statusInfo.includes('recouche')) {
          cleaningType = 'quick';
        } else if (statusInfo.includes('départ') || statusInfo.includes('parti')) {
          cleaningType = 'full';
        } else if (statusInfo.includes('arrivée')) {
          cleaningType = 'full';
        } else if (statusInfo.includes('maintenance') || statusInfo.includes('hors service')) {
          status = 'maintenance';
        } else if (statusInfo.includes('propre') || statusInfo.includes('clean')) {
          status = 'clean';
        }
        
        // Déterminer la priorité
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (statusInfo.includes('urgent') || statusInfo.includes('vip')) {
          priority = 'high';
        }
        
        // Déterminer si c'est une chambre twin
        const isTwin = statusInfo.includes('twin') || statusInfo.includes('twn');
        
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
