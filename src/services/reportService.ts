
import { Room, CleaningConfig } from "./pdfService";
import html2pdf from 'html2pdf.js';

export async function generateHousekeeperReport(
  housekeeperName: string,
  rooms: Room[],
  config: CleaningConfig
): Promise<void> {
  // Trier les chambres avant de générer le rapport
  const sortedRooms = [...rooms].sort((a, b) => {
    // D'abord par priorité (urgent en premier)
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    
    // Ensuite par type de nettoyage (à blanc d'abord)
    if (a.cleaningType === 'full' && b.cleaningType !== 'full') return -1;
    if (a.cleaningType !== 'full' && b.cleaningType === 'full') return 1;
    
    // Puis par numéro de chambre (ordre naturel)
    return a.number.localeCompare(b.number, undefined, {numeric: true});
  });

  // Créer la structure HTML du rapport
  const reportHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #333;">Rapport de Nettoyage</h1>
        <h2 style="margin: 5px 0; color: #666;">${housekeeperName}</h2>
        <p style="margin: 5px 0; color: #888;">${new Date().toLocaleDateString()}</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <p><strong>Total des chambres:</strong> ${sortedRooms.length}</p>
        <p><strong>Chambres à blanc:</strong> ${sortedRooms.filter(r => r.cleaningType === 'full').length}</p>
        <p><strong>Recouches:</strong> ${sortedRooms.filter(r => r.cleaningType === 'quick').length}</p>
        <p><strong>Temps estimé:</strong> 
          ${calculateEstimatedTime(sortedRooms, config)} minutes
        </p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Chambre</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Type</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Statut</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${sortedRooms.map(room => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; ${room.isUrgent ? 'color: red; font-weight: bold;' : ''}">${room.number}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                ${room.cleaningType === 'full' ? 'À BLANC' : 
                 room.cleaningType === 'quick' ? 'RECOUCHE' : 'N/A'}
                ${room.isTwin ? ' (Twin)' : ''}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                ${getStatusText(room.status)}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                ${room.isUrgent ? '⚠️ PRIORITAIRE' : ''}
                ${room.notUrgent ? '🕒 Pas urgent' : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  // Configuration des options pour html2pdf
  const options = {
    margin: 10,
    filename: `rapport_${housekeeperName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  // Création du PDF
  const element = document.createElement('div');
  element.innerHTML = reportHTML;
  document.body.appendChild(element);
  
  try {
    await html2pdf().from(element).set(options).save();
    console.log(`Rapport généré pour ${housekeeperName}`);
  } catch (error) {
    console.error("Erreur lors de la génération du rapport:", error);
  } finally {
    document.body.removeChild(element);
  }
}

function calculateEstimatedTime(rooms: Room[], config: CleaningConfig): number {
  return rooms.reduce((total, room) => {
    if (room.cleaningType === 'full') {
      return total + config.fullCleaningTime;
    } else if (room.cleaningType === 'quick') {
      return total + config.quickCleaningTime;
    }
    return total;
  }, 0);
}

function getStatusText(status: string): string {
  switch (status) {
    case 'needs-cleaning': return 'À nettoyer';
    case 'clean': return 'Propre';
    case 'occupied': return 'Occupé';
    case 'maintenance': return 'Maintenance';
    default: return status;
  }
}
