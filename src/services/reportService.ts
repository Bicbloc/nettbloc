import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Room, CleaningConfig } from './pdfService';
import { toast } from '@/hooks/use-toast';

// Admin email address to receive notifications
const ADMIN_EMAIL = "admin@bicbloc.eu"; // Replace with the desired admin email address

export interface ReportFields {
  toDoItems: string[];
  toKnowItems: string[];
  instructions?: string; // Added instructions field
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
    
    // Create a PDF using client-side method
    const pdfBytes = await createSimplePDF(housekeeperName, rooms, config, customFields);
    
    // Use client-side method directly without server call
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

    // Try sending email in background without blocking PDF download
    try {
      fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: htmlContent,
          filename: `${housekeeperName.replace(/\s+/g, '_')}_rapport.pdf`,
          email: emailAddress,
          adminEmail: ADMIN_EMAIL,
          notificationSubject: `Rapport téléchargé: ${housekeeperName}`,
          notificationText: `Un rapport pour ${housekeeperName} a été téléchargé et envoyé à ${emailAddress}`
        }),
      }).then(response => {
        if (response.ok) {
          console.log("Email sent successfully");
        }
      }).catch(err => {
        console.log("Email sending failed, but PDF was downloaded", err);
      });
    } catch (emailError) {
      console.log("Email sending failed, but PDF was downloaded", emailError);
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
    // For multiple reports, generate each PDF individually
    let successCount = 0;
    
    for (const { name, rooms } of housekeepersWithRooms) {
      try {
        await generateHousekeeperReport(name, rooms, config, emailAddress, customFields);
        successCount++;
      } catch (err) {
        console.error(`Error generating report for ${name}:`, err);
      }
    }
    
    if (successCount > 0) {
      toast({
        title: "Rapports générés",
        description: `${successCount} rapport(s) sur ${housekeepersWithRooms.length} ont été téléchargés`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Aucun rapport n'a pu être généré",
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
    const priorityText = room.priority === 'high' ? 'Oui' : 'Non';
    const cleaningTypeText = room.cleaningType === 'full' ? 'À Blanc' : 
                           room.cleaningType === 'quick' ? 'Recouche' : 'Aucun';
    const status = room.status === 'needs-cleaning' ? 'À Nettoyer' : 
                  room.status === 'clean' ? 'Propre' : 
                  room.status === 'occupied' ? 'Occupé' : 
                  room.status === 'maintenance' ? 'Maintenance' : room.status;
    
    return `
      <tr class="${priorityClass}">
        <td>${room.number}</td>
        <td>${status}</td>
        <td>${cleaningTypeText}</td>
        <td>${room.isTwin ? 'Oui' : 'Non'}</td>
        <td>${priorityText}</td>
        <td>${room.notes || ''}</td>
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
        .instructions-section { margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px; border-left: 4px solid #0066cc; }
        .footer-link { color: #0066cc; text-decoration: none; }
        tr:nth-child(even) { background-color: #f9f9f9; }
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
              <th>Statut</th>
              <th>Type Nettoyage</th>
              <th>Twin</th>
              <th>Prioritaire</th>
              <th>Remarque</th>
            </tr>
          </thead>
          <tbody>
            ${roomRows}
          </tbody>
        </table>
        
        ${customFields?.instructions ? `
        <div class="instructions-section">
          <h2>Instructions</h2>
          <p>${customFields.instructions}</p>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>Généré par <a href="https://www.bicbloc.eu" class="footer-link" target="_blank">BicBloc.eu Staffing Agency</a></p>
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
async function createSimplePDF(
  housekeeperName: string, 
  rooms: Room[], 
  config: CleaningConfig,
  customFields?: ReportFields
): Promise<Uint8Array> {
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
  
  // Add custom fields if present
  let yPosition = height - 200;
  
  // Add to-do items if present
  if (customFields?.toDoItems && customFields.toDoItems.length > 0) {
    page.drawText('À faire:', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
    });
    yPosition -= 20;
    
    for (const item of customFields.toDoItems.filter(item => item.trim() !== '')) {
      page.drawText(`• ${item}`, {
        x: 60,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 15;
      
      // Add a new page if we're running out of space
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage();
        yPosition = height - 50;
      }
    }
    
    yPosition -= 10;
  }
  
  // Add to-know items if present
  if (customFields?.toKnowItems && customFields.toKnowItems.length > 0) {
    page.drawText('À savoir:', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
    });
    yPosition -= 20;
    
    for (const item of customFields.toKnowItems.filter(item => item.trim() !== '')) {
      page.drawText(`• ${item}`, {
        x: 60,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 15;
      
      // Add a new page if we're running out of space
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage();
        yPosition = height - 50;
      }
    }
    
    yPosition -= 10;
  }
  
  // Add room list title
  page.drawText('Liste des Chambres:', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
  });
  yPosition -= 20;
  
  // Draw table header
  const tableTop = yPosition;
  const colWidth = 100;
  const rowHeight = 20;
  const columns = ['Chambre', 'Statut', 'Type', 'Twin', 'Prioritaire', 'Remarque'];
  const columnWidths = [70, 80, 70, 50, 70, 150]; // Width for each column
  
  // Draw table headers
  let xPosition = 50;
  for (let i = 0; i < columns.length; i++) {
    // Draw header background
    page.drawRectangle({
      x: xPosition,
      y: tableTop - rowHeight,
      width: columnWidths[i],
      height: rowHeight,
      color: rgb(0.9, 0.9, 0.9),
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 1,
    });
    
    // Draw header text
    page.drawText(columns[i], {
      x: xPosition + 5,
      y: tableTop - 15,
      size: 10,
      font: boldFont,
    });
    
    xPosition += columnWidths[i];
  }
  
  // Draw table rows
  yPosition = tableTop - rowHeight;
  for (const room of rooms) {
    const cleaningType = room.cleaningType === 'full' ? 'À Blanc' : room.cleaningType === 'quick' ? 'Recouche' : 'Aucun';
    const status = room.status === 'needs-cleaning' ? 'À Nettoyer' : 
                  room.status === 'clean' ? 'Propre' : 
                  room.status === 'occupied' ? 'Occupé' : 
                  room.status === 'maintenance' ? 'Maintenance' : room.status;
    const isTwin = room.isTwin ? 'Oui' : 'Non';
    const isPriority = room.priority === 'high' ? 'Oui' : 'Non';
    const notes = room.notes || '';
    
    // Add a new page if we're running out of space
    if (yPosition < 50) {
      const newPage = pdfDoc.addPage();
      yPosition = height - 50;
      
      // Redraw table header on new page
      xPosition = 50;
      for (let i = 0; i < columns.length; i++) {
        page.drawRectangle({
          x: xPosition,
          y: yPosition - rowHeight,
          width: columnWidths[i],
          height: rowHeight,
          color: rgb(0.9, 0.9, 0.9),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });
        
        page.drawText(columns[i], {
          x: xPosition + 5,
          y: yPosition - 15,
          size: 10,
          font: boldFont,
        });
        
        xPosition += columnWidths[i];
      }
      yPosition -= rowHeight;
    }
    
    // Draw cell backgrounds (alternating for readability)
    const rowIndex = rooms.indexOf(room);
    const isEvenRow = rowIndex % 2 === 0;
    
    // Draw cell backgrounds for priority rooms
    if (room.priority === 'high') {
      xPosition = 50;
      for (let i = 0; i < columns.length; i++) {
        page.drawRectangle({
          x: xPosition,
          y: yPosition - rowHeight,
          width: columnWidths[i],
          height: rowHeight,
          color: rgb(1.0, 0.9, 0.9),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });
        xPosition += columnWidths[i];
      }
    } else {
      // Draw regular cell backgrounds
      xPosition = 50;
      for (let i = 0; i < columns.length; i++) {
        page.drawRectangle({
          x: xPosition,
          y: yPosition - rowHeight,
          width: columnWidths[i],
          height: rowHeight,
          color: isEvenRow ? rgb(1, 1, 1) : rgb(0.97, 0.97, 0.97),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });
        xPosition += columnWidths[i];
      }
    }
    
    // Write cell contents
    const rowData = [room.number, status, cleaningType, isTwin, isPriority, notes];
    xPosition = 50;
    for (let i = 0; i < rowData.length; i++) {
      const cellText = rowData[i];
      const maxLength = Math.floor(columnWidths[i] / 6) - 2; // Approximate characters that fit
      const truncatedText = cellText.length > maxLength ? cellText.substring(0, maxLength) + '...' : cellText;
      
      page.drawText(truncatedText, {
        x: xPosition + 5,
        y: yPosition - 15,
        size: 9,
        font,
      });
      xPosition += columnWidths[i];
    }
    
    yPosition -= rowHeight;
  }
  
  // Add instructions if present
  if (customFields?.instructions) {
    // Start a new page for instructions if we're running out of space
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage();
      yPosition = height - 50;
    } else {
      yPosition -= 30;
    }
    
    page.drawText('Instructions:', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
    });
    yPosition -= 20;
    
    // Split instructions into multiple lines if needed
    const instructionLines = splitTextIntoLines(customFields.instructions, 80);
    for (const line of instructionLines) {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 10,
        font,
      });
      yPosition -= 15;
      
      // Add a new page if we're running out of space
      if (yPosition < 50) {
        const newPage = pdfDoc.addPage();
        yPosition = height - 50;
      }
    }
  }
  
  // Add footer
  page.drawText('Généré par BicBloc.eu Staffing Agency - Commander un extra en trois clics', {
    x: 50,
    y: 20,
    size: 8,
    font: font,
  });
  
  return pdfDoc.save();
}

// Helper function to split text into lines with max character count
function splitTextIntoLines(text: string, maxCharPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length <= maxCharPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}
