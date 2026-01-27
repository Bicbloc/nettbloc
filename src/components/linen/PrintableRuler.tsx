import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Printer, Download, Ruler } from 'lucide-react';

interface PrintableRulerProps {
  hotelId: string;
  hotelName?: string;
}

/**
 * Génère une règle étalon imprimable pour calibrer le scan linge
 * Format: A4 avec règle graduée 0-30cm et couleurs distinctes
 */
export const PrintableRuler: React.FC<PrintableRulerProps> = ({ hotelId, hotelName }) => {
  const generateRulerSVG = () => {
    const width = 800;
    const height = 280;
    const rulerHeight = 80;
    const startY = 100;
    
    // Couleurs alternées pour chaque 5cm - très visibles
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
    
    let svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <!-- Background -->
        <rect width="${width}" height="${height}" fill="white"/>
        
        <!-- Title -->
        <text x="${width/2}" y="30" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#1f2937">
          📏 RÈGLE ÉTALON - COMPTAGE LINGE
        </text>
        <text x="${width/2}" y="55" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#6b7280">
          ${hotelName || 'Hôtel'} | ID: ${hotelId.slice(0, 8)}
        </text>
        
        <!-- Ruler base -->
        <rect x="50" y="${startY}" width="700" height="${rulerHeight}" fill="#f3f4f6" stroke="#374151" stroke-width="2"/>
    `;
    
    // Graduations par cm (0 à 30cm = 700px → ~23.33px/cm)
    const pxPerCm = 700 / 30;
    
    for (let cm = 0; cm <= 30; cm++) {
      const x = 50 + (cm * pxPerCm);
      
      // Couleur de fond pour chaque tranche de 5cm
      if (cm < 30 && cm % 5 === 0) {
        const colorIndex = Math.floor(cm / 5);
        svgContent += `<rect x="${x}" y="${startY}" width="${pxPerCm * 5}" height="${rulerHeight}" fill="${colors[colorIndex]}20"/>`;
      }
      
      // Grande graduation tous les 5cm
      if (cm % 5 === 0) {
        svgContent += `
          <line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + rulerHeight}" stroke="#374151" stroke-width="2"/>
          <text x="${x}" y="${startY + rulerHeight + 18}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#1f2937">${cm}</text>
        `;
      } 
      // Moyenne graduation tous les cm
      else {
        svgContent += `<line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + 30}" stroke="#6b7280" stroke-width="1"/>`;
      }
    }
    
    // Indications d'épaisseur type
    svgContent += `
        <!-- Thickness reference markers -->
        <text x="${width/2}" y="${startY + rulerHeight + 50}" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#374151">
          Épaisseurs moyennes: 🛏️ Drap ~1.5cm | 🛁 Serviette ~3cm | 🛋️ Housse ~2cm | 🧱 Taie ~1cm
        </text>
        
        <!-- Cutline -->
        <line x1="30" y1="${height - 10}" x2="${width - 30}" y2="${height - 10}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="5,5"/>
        <text x="${width/2}" y="${height - 2}" font-family="Arial, sans-serif" font-size="9" text-anchor="middle" fill="#9ca3af">✂️ Découper ici</text>
      </svg>
    `;
    
    return svgContent;
  };

  const handlePrint = () => {
    const svgContent = generateRulerSVG();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Règle Étalon - Comptage Linge</title>
          <style>
            @page { size: A4 landscape; margin: 1cm; }
            body { 
              margin: 0; 
              padding: 20px; 
              display: flex; 
              justify-content: center; 
              align-items: center;
              min-height: 100vh;
              font-family: Arial, sans-serif;
            }
            .container { text-align: center; }
            .instructions {
              margin-top: 30px;
              padding: 15px;
              background: #f3f4f6;
              border-radius: 8px;
              text-align: left;
              max-width: 700px;
            }
            .instructions h3 { margin-top: 0; }
            .instructions ol { margin-bottom: 0; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${svgContent}
            <div class="instructions">
              <h3>📋 Mode d'emploi</h3>
              <ol>
                <li>Imprimez cette page à 100% (sans mise à l'échelle)</li>
                <li>Découpez la règle le long de la ligne pointillée</li>
                <li>Lors du scan, placez la règle <strong>verticalement</strong> à côté de la pile de linge</li>
                <li>Assurez-vous que les couleurs et chiffres sont bien visibles</li>
                <li>L'IA détectera automatiquement la règle et calculera le nombre exact de pièces</li>
              </ol>
            </div>
            <button class="no-print" onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px; cursor: pointer;">
              🖨️ Imprimer
            </button>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownload = () => {
    const svgContent = generateRulerSVG();
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regle-etalon-${hotelId.slice(0, 8)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Règle Étalon pour Scan Précis
        </CardTitle>
        <CardDescription>
          Imprimez cette règle et placez-la à côté des piles de linge pour un comptage ultra-précis (98-100%)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div 
            className="w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: generateRulerSVG() }}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePrint} className="flex-1 min-w-[140px]">
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Button onClick={handleDownload} variant="outline" className="flex-1 min-w-[140px]">
            <Download className="h-4 w-4 mr-2" />
            Télécharger SVG
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>💡 Conseil :</strong> Imprimez à 100% sans mise à l'échelle pour une calibration exacte.</p>
          <p><strong>🎯 Utilisation :</strong> Placez la règle verticalement contre la pile de linge avant de scanner.</p>
        </div>
      </CardContent>
    </Card>
  );
};
