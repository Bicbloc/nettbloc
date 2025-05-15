import { CleaningConfig, Room } from "@/services/pdfService";
import html2pdf from 'html2pdf.js';
import { toast } from "@/hooks/use-toast";
import { ReportFields } from "@/components/ReportCustomFields"; // Import from ReportCustomFields

export async function generateHousekeeperReport(
  housekeeperName: string, 
  rooms: Room[],
  config: CleaningConfig,
  emailAddress: string,
  customFields?: ReportFields
): Promise<boolean> {
  try {
    // Generate individual report HTML
    const reportHtml = generateHousekeeperReportHtml(housekeeperName, rooms, config, customFields);
    
    const opt = {
      margin: 10,
      filename: `${housekeeperName.replace(/\s+/g, '_')}_rapport.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    const pdf = await html2pdf().set(opt).from(reportHtml).save();
    return true;
  } catch (error) {
    console.error("Error generating PDF:", error);
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible de générer le PDF."
    });
    return false;
  }
}

export async function generateAllHousekeeperReports(
  housekeepersWithRooms: { name: string, rooms: Room[] }[],
  config: CleaningConfig,
  emailAddress: string,
  customFields?: ReportFields
): Promise<boolean> {
  try {
    // For multiple reports, we'll generate them one by one
    for (const { name, rooms } of housekeepersWithRooms) {
      await generateHousekeeperReport(name, rooms, config, emailAddress, customFields);
    }
    return true;
  } catch (error) {
    console.error("Error generating PDFs:", error);
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible de générer les PDFs."
    });
    return false;
  }
}

// New function to generate a combined PDF report for all housekeepers
export async function generateCombinedHousekeeperReport(
  housekeepersWithRooms: { name: string, rooms: Room[] }[],
  config: CleaningConfig,
  emailAddress: string,
  customFields?: ReportFields
): Promise<boolean> {
  try {
    // Create a container for all reports
    const combinedHtml = document.createElement('div');
    
    // Add each housekeeper's report to the container
    for (let i = 0; i < housekeepersWithRooms.length; i++) {
      const { name, rooms } = housekeepersWithRooms[i];
      
      // Generate the HTML for this housekeeper
      const reportHtml = generateHousekeeperReportHtml(name, rooms, config, customFields);
      combinedHtml.innerHTML += reportHtml;
      
      // Add page break between reports (except for the last one)
      if (i < housekeepersWithRooms.length - 1) {
        const pageBreak = document.createElement('div');
        pageBreak.style.pageBreakAfter = 'always';
        pageBreak.innerHTML = '<hr style="border: none; margin: 0; padding: 0;">';
        combinedHtml.appendChild(pageBreak);
      }
    }
    
    // Generate the PDF with all reports
    const opt = {
      margin: 10,
      filename: `rapport_complet_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    await html2pdf().set(opt).from(combinedHtml).save();
    return true;
  } catch (error) {
    console.error("Error generating combined PDF:", error);
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible de générer le PDF combiné."
    });
    return false;
  }
}

// Helper function to generate the HTML for a housekeeper report
function generateHousekeeperReportHtml(
  housekeeperName: string, 
  rooms: Room[], 
  config: CleaningConfig,
  customFields?: ReportFields
): string {
  // Sort rooms by floor and then by room number
  const sortedRooms = [...rooms].sort((a, b) => {
    const floorA = parseInt(a.number.charAt(0));
    const floorB = parseInt(b.number.charAt(0));
    if (floorA !== floorB) return floorA - floorB;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });
  
  // Group rooms by floor
  const roomsByFloor: Record<number, Room[]> = {};
  sortedRooms.forEach(room => {
    const floor = parseInt(room.number.charAt(0));
    if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
    roomsByFloor[floor].push(room);
  });
  
  // Calculate counts
  const totalRooms = rooms.length;
  const fullCleaningRooms = rooms.filter(r => r.cleaningType === 'full').length;
  const quickCleaningRooms = rooms.filter(r => r.cleaningType === 'quick').length;
  const priorityRooms = rooms.filter(r => r.priority === 'high').length;
  const twinRooms = rooms.filter(r => r.isTwin).length;
  
  // Calculate estimated time
  const estimatedTime = rooms.reduce((total, room) => {
    if (room.cleaningType === 'full') {
      return total + config.fullCleaningTime;
    } else if (room.cleaningType === 'quick') {
      return total + config.quickCleaningTime;
    }
    return total;
  }, 0);
  
  const hours = Math.floor(estimatedTime / 60);
  const minutes = estimatedTime % 60;
  
  // Generate HTML for the report
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="text-align: center; color: #333;">Rapport de Nettoyage</h1>
      <h2 style="text-align: center; margin-bottom: 20px;">${housekeeperName}</h2>
      
      <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
        <h3 style="margin-top: 0;">Résumé</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          <li><strong>Total des chambres:</strong> ${totalRooms}</li>
          <li><strong>Chambres à blanc:</strong> ${fullCleaningRooms}</li>
          <li><strong>Recouches:</strong> ${quickCleaningRooms}</li>
          <li><strong>Chambres prioritaires:</strong> ${priorityRooms}</li>
          <li><strong>Chambres twin:</strong> ${twinRooms}</li>
          <li><strong>Temps estimé:</strong> ${hours}h${minutes ? ` ${minutes}min` : ''}</li>
        </ul>
      </div>
  `;
  
  // Add custom fields if provided
  if (customFields) {
    // Add general instructions if provided
    if (customFields.generalInstructions) {
      html += `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #f5f5f5;">
          <h3 style="margin-top: 0;">Instructions Générales</h3>
          <p>${customFields.generalInstructions}</p>
        </div>
      `;
    }
    
    // Add specific instructions for this housekeeper if provided
    if (customFields.housekeeperInstructions && customFields.housekeeperInstructions[housekeeperName]) {
      html += `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #fff0db;">
          <h3 style="margin-top: 0;">Instructions pour ${housekeeperName}</h3>
          <p>${customFields.housekeeperInstructions[housekeeperName]}</p>
        </div>
      `;
    }
    
    // Add to-do items if provided
    if (customFields.toDoItems && customFields.toDoItems.length > 0) {
      const filteredItems = customFields.toDoItems.filter(item => item.trim().length > 0);
      if (filteredItems.length > 0) {
        html += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #fff8dc;">
            <h3 style="margin-top: 0;">À Faire</h3>
            <ul>
              ${filteredItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    }
    
    // Add to-know items if provided
    if (customFields.toKnowItems && customFields.toKnowItems.length > 0) {
      const filteredItems = customFields.toKnowItems.filter(item => item.trim().length > 0);
      if (filteredItems.length > 0) {
        html += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #e6f7ff;">
            <h3 style="margin-top: 0;">À Savoir</h3>
            <ul>
              ${filteredItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    }
  }
  
  // Add rooms by floor
  html += `<h3>Chambres par Étage</h3>`;
  
  Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(floor => {
      html += `
        <div style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px;">Étage ${floor === 0 ? 'RDC' : floor}</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f2f2f2;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Chambre</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Type</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Statut</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Twin</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Priorité</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Temps (min)</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      roomsByFloor[floor]
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
        .forEach(room => {
          const cleaningTime = room.cleaningType === 'full' 
            ? config.fullCleaningTime 
            : room.cleaningType === 'quick' 
              ? config.quickCleaningTime 
              : 0;
          
          const cleaningTypeText = room.cleaningType === 'full' 
            ? 'À Blanc' 
            : room.cleaningType === 'quick' 
              ? 'Recouche' 
              : 'Aucun';
          
          const statusText = room.status === 'needs-cleaning' 
            ? 'À Nettoyer' 
            : room.status === 'clean' 
              ? 'Propre' 
              : room.status === 'occupied' 
                ? 'Occupé' 
                : room.status === 'maintenance' 
                  ? 'Maintenance' 
                  : 'Inconnu';
          
          html += `
            <tr>
              <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${room.number}</td>
              <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">
                <span style="display: inline-block; padding: 3px 8px; border-radius: 3px; background-color: ${room.cleaningType === 'full' ? '#e0b0ff' : room.cleaningType === 'quick' ? '#b0e0ff' : '#e0e0e0'};">
                  ${cleaningTypeText}
                </span>
              </td>
              <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">
                <span style="display: inline-block; padding: 3px 8px; border-radius: 3px; background-color: ${room.status === 'needs-cleaning' ? '#fff2b0' : room.status === 'clean' ? '#b0ffc0' : room.status === 'occupied' ? '#b0c0ff' : '#ffb0b0'};">
                  ${statusText}
                </span>
              </td>
              <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${room.isTwin ? '✓' : '-'}</td>
              <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">
                ${room.priority === 'high' ? '⚠️ Haute' : room.priority === 'low' ? '⏳ Basse' : '-'}
              </td>
              <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${cleaningTime}</td>
            </tr>
          `;
        });
      
      html += `
            </tbody>
          </table>
        </div>
      `;
    });
  
  // Close the container
  html += `
      <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px;">
        <p style="color: #666; font-size: 12px; text-align: center;">Généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  `;
  
  return html;
}
