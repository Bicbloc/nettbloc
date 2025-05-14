
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Room, CleaningConfig } from './pdfService';
import { toast } from '@/hooks/use-toast';

// Admin email address to receive notifications
const ADMIN_EMAIL = "admin@bicbloc.eu"; // Replace with the desired admin email address

export interface ReportFields {
  toDoItems: string[];
  toKnowItems: string[];
}

export async function generateHousekeeperReport(
  housekeeperName: string,
  rooms: Room[],
  config: CleaningConfig,
  emailAddress: string,
  customFields?: ReportFields
): Promise<void> {
  try {
    // Generate HTML content
    const htmlContent = generateHousekeeperReportHTML(housekeeperName, rooms, config, customFields);
    
    // Create a simple PDF as fallback in case the server endpoint fails
    const pdfBytes = await createSimplePDF(housekeeperName, rooms, config);
    
    try {
      // Convert HTML to PDF using a server endpoint
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: htmlContent,
          filename: `${housekeeperName.replace(/\s+/g, '_')}_rapport.pdf`,
          email: emailAddress,
          adminEmail: ADMIN_EMAIL, // Send a notification to the admin
          notificationSubject: `Rapport téléchargé: ${housekeeperName}`,
          notificationText: `Un rapport pour ${housekeeperName} a été téléchargé et envoyé à ${emailAddress}`
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF via server');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Rapport généré",
          description: `Le rapport pour ${housekeeperName} a été envoyé à ${emailAddress}`,
        });
        return;
      } else {
        throw new Error(result.message || 'Unknown server error');
      }
    } catch (serverError) {
      console.error('Server PDF generation failed, using fallback method:', serverError);
      
      // Use client-side fallback method
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${housekeeperName.replace(/\s+/g, '_')}_rapport.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "Rapport généré",
        description: `Le rapport pour ${housekeeperName} a été téléchargé`,
      });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible de générer le rapport PDF",
    });
    throw error;
  }
}

export async function generateAllHousekeeperReports(
  housekeepersWithRooms: { name: string; rooms: Room[] }[],
  config: CleaningConfig,
  emailAddress: string,
  customFields?: ReportFields
): Promise<void> {
  try {
    // Generate HTML content for each housekeeper
    const htmlContents = housekeepersWithRooms.map(({ name, rooms }) => ({
      name,
      html: generateHousekeeperReportHTML(name, rooms, config, customFields)
    }));
    
    try {
      // Convert HTML to PDF using a server endpoint
      const response = await fetch('/api/generate-multiple-pdfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reports: htmlContents.map(item => ({
            html: item.html,
            filename: `${item.name.replace(/\s+/g, '_')}_rapport.pdf`,
          })),
          email: emailAddress,
          adminEmail: ADMIN_EMAIL, // Send a notification to the admin
          notificationSubject: `Rapports multiples téléchargés`,
          notificationText: `${htmlContents.length} rapports ont été téléchargés et envoyés à ${emailAddress}`
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDFs via server');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Rapports générés",
          description: `${htmlContents.length} rapports ont été envoyés à ${emailAddress}`,
        });
        return;
      } else {
        throw new Error(result.message || 'Unknown server error');
      }
    } catch (serverError) {
      console.error('Server PDF generation failed, creating individual PDFs:', serverError);
      
      // Client-side fallback: generate each PDF individually 
      for (const { name, rooms } of housekeepersWithRooms) {
        await generateHousekeeperReport(name, rooms, config, emailAddress, customFields);
      }
      
      toast({
        title: "Rapports générés",
        description: `${housekeepersWithRooms.length} rapports ont été téléchargés individuellement`,
      });
    }
  } catch (error) {
    console.error('Error generating reports:', error);
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible de générer les rapports PDF",
    });
    throw error;
  }
}

// This function is used to generate the HTML content for a housekeeper's report
function generateHousekeeperReportHTML(
  housekeeperName: string,
  rooms: Room[],
  config: CleaningConfig,
  customFields?: ReportFields
): string {
  // Sort rooms by priority and then by number
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });
  
  // Count different types of rooms
  const fullCleaningCount = rooms.filter(room => room.cleaningType === 'full').length;
  const quickCleaningCount = rooms.filter(room => room.cleaningType === 'quick').length;
  const highPriorityCount = rooms.filter(room => room.priority === 'high').length;
  const twinCount = rooms.filter(room => room.isTwin).length;
  
  // Calculate estimated time
  const estimatedTimeInMinutes = rooms.reduce((total, room) => {
    if (room.cleaningType === 'full') {
      return total + config.fullCleaningTime;
    } else if (room.cleaningType === 'quick') {
      return total + config.quickCleaningTime;
    }
    return total;
  }, 0);
  
  // Build HTML table rows
  const roomRows = sortedRooms.map(room => {
    const priorityClass = room.priority === 'high' ? 'priority-high' : '';
    const cleaningType = room.cleaningType === 'full' ? 'À Blanc' : room.cleaningType === 'quick' ? 'Recouche' : 'Aucun';
    const status = room.status === 'needs-cleaning' ? 'À Nettoyer' : 
                  room.status === 'clean' ? 'Propre' : 
                  room.status === 'occupied' ? 'Occupé' : 
                  room.status === 'maintenance' ? 'Maintenance' : room.status;
    
    return `
      <tr class="${priorityClass}">
        <td>${room.number}</td>
        <td>${cleaningType}</td>
        <td>${status}</td>
        <td>${room.isTwin ? 'Oui' : 'Non'}</td>
        <td>${room.priority === 'high' ? 'Haute' : room.priority === 'low' ? 'Basse' : 'Normale'}</td>
      </tr>
    `;
  }).join('');
  
  // Generate to-do and to-know lists
  const todoItems = (customFields?.toDoItems || [])
    .filter(item => item.trim() !== '')
    .map(item => `<li>${item}</li>`)
    .join('');
    
  const toKnowItems = (customFields?.toKnowItems || [])
    .filter(item => item.trim() !== '')
    .map(item => `<li>${item}</li>`)
    .join('');
  
  // Create the full HTML document
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Rapport de Nettoyage - ${housekeeperName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .container { max-width: 100%; margin: 0 auto; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { margin-bottom: 20px; }
        .summary { margin-bottom: 15px; }
        .footer { margin-top: 30px; font-size: 0.9em; color: #666; text-align: center; }
        .priority-high { background-color: #ffebee; }
        h1 { margin-top: 0; color: #333; }
        h2 { color: #555; }
        .banner { width: 100%; text-align: center; margin-top: 30px; }
        .banner img { width: 100%; height: auto; max-height: 200px; object-fit: contain; }
        .todo-section { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
        .footer-link { color: #0066cc; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rapport de Nettoyage</h1>
          <p><strong>Nom:</strong> ${housekeeperName}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="summary">
          <h2>Résumé</h2>
          <p><strong>Total des chambres:</strong> ${rooms.length}</p>
          <p><strong>Nettoyages à blanc:</strong> ${fullCleaningCount}</p>
          <p><strong>Recouches:</strong> ${quickCleaningCount}</p>
          <p><strong>Chambres prioritaires:</strong> ${highPriorityCount}</p>
          <p><strong>Chambres twin:</strong> ${twinCount}</p>
          <p><strong>Temps estimé:</strong> ${estimatedTimeInMinutes} minutes (${Math.floor(estimatedTimeInMinutes/60)}h${estimatedTimeInMinutes%60})</p>
        </div>
        
        ${todoItems ? `
        <div class="todo-section">
          <h2>À faire</h2>
          <ul>
            ${todoItems}
          </ul>
        </div>
        ` : ''}
        
        ${toKnowItems ? `
        <div class="todo-section">
          <h2>À savoir</h2>
          <ul>
            ${toKnowItems}
          </ul>
        </div>
        ` : ''}
        
        <h2>Liste des Chambres</h2>
        <table>
          <thead>
            <tr>
              <th>Chambre</th>
              <th>Type Nettoyage</th>
              <th>Statut</th>
              <th>Twin</th>
              <th>Priorité</th>
            </tr>
          </thead>
          <tbody>
            ${roomRows}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Généré par <a href="https://www.bicbloc.eu" class="footer-link" target="_blank">BicBloc</a></p>
          <p style="margin-top: 0;"><a href="https://www.bicbloc.eu/extra" class="footer-link" target="_blank">Commander un extra en trois clics</a></p>
        </div>
        
        <div class="banner">
          <a href="https://www.bicbloc.eu" target="_blank" style="display: block;">
            <img src="/lovable-uploads/c8c4ab5d-01f9-48ea-970c-2ba1488f614d.png" alt="BicBloc Banner" style="width: 100%; height: auto;" />
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Function to create a simple PDF (fallback if HTML conversion fails)
async function createSimplePDF(housekeeperName: string, rooms: Room[], config: CleaningConfig): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Add title
  page.drawText(`Rapport de Nettoyage - ${housekeeperName}`, {
    x: 50,
    y: height - 50,
    size: 16,
    font: boldFont,
  });
  
  // Add date
  page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
    x: 50,
    y: height - 80,
    size: 12,
    font,
  });
  
  // Add summary
  const fullCleaningCount = rooms.filter(room => room.cleaningType === 'full').length;
  const quickCleaningCount = rooms.filter(room => room.cleaningType === 'quick').length;
  
  page.drawText(`Total des chambres: ${rooms.length}`, {
    x: 50,
    y: height - 120,
    size: 12,
    font,
  });
  
  page.drawText(`Nettoyages à blanc: ${fullCleaningCount}`, {
    x: 50,
    y: height - 140,
    size: 12,
    font,
  });
  
  page.drawText(`Recouches: ${quickCleaningCount}`, {
    x: 50,
    y: height - 160,
    size: 12,
    font,
  });
  
  // Add room list title
  page.drawText('Liste des Chambres:', {
    x: 50,
    y: height - 200,
    size: 14,
    font: boldFont,
  });
  
  // Add room list
  let yPosition = height - 230;
  for (const room of rooms) {
    const cleaningType = room.cleaningType === 'full' ? 'À Blanc' : room.cleaningType === 'quick' ? 'Recouche' : 'Aucun';
    page.drawText(`${room.number} - ${cleaningType}${room.priority === 'high' ? ' (Prioritaire)' : ''}`, {
      x: 50,
      y: yPosition,
      size: 10,
      font,
    });
    yPosition -= 20;
    
    // Add a new page if we're running out of space
    if (yPosition < 50) {
      const newPage = pdfDoc.addPage();
      yPosition = height - 50;
    }
  }
  
  return pdfDoc.save();
}
