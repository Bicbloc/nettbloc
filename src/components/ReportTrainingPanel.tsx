import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjs from 'pdfjs-dist';
import { FileUp, Trash2, Check, X, Download } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface ExtractedRoom {
  roomNumber: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  cleaningType: 'full' | 'quick' | 'none';
  validated: boolean;
}

interface TrainingReport {
  id?: string;
  name: string;
  rawText: string;
  extractedData: ExtractedRoom[];
  validated: boolean;
}

export function ReportTrainingPanel() {
  const [reports, setReports] = useState<TrainingReport[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TrainingReport | null>(null);
  const [editingRoom, setEditingRoom] = useState<ExtractedRoom | null>(null);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const autoExtractRooms = (text: string): ExtractedRoom[] => {
    const rooms: ExtractedRoom[] = [];
    const foundRooms = new Set<string>();
    
    // Pattern pour numéros de chambres (2 ou 3 chiffres, pas les années)
    const roomPattern = /\b([1-9]\d{1,2})\b/g;
    
    let match;
    while ((match = roomPattern.exec(text)) !== null) {
      const roomNumber = match[1];
      
      // Ignorer les années et numéros trop grands
      if (parseInt(roomNumber) > 999 || /^20(2[0-9])$/.test(roomNumber)) continue;
      if (foundRooms.has(roomNumber)) continue;
      
      foundRooms.add(roomNumber);
      
      // Contexte autour du numéro de chambre
      const start = Math.max(0, match.index - 200);
      const end = Math.min(text.length, match.index + 400);
      const context = text.substring(start, end).toUpperCase();
      
      // Extraction des dates (plusieurs formats)
      const dates4 = context.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
      const dates2 = context.match(/\d{2}\/\d{2}\/\d{2}/g) || [];
      const allDates = [...dates4, ...dates2];
      
      // Détection des statuts - Format Apaleo anglais
      const hasDIR = /\bDIR\b/.test(context);
      const hasINS = /\bINS\b/.test(context);
      const hasCleaning = /\bCLEANING\b/.test(context);
      const hasOCC = /\bOCC\b/.test(context);
      
      // Format Apaleo français
      const hasRecouche = /\bRECOUCHE\b/.test(context);
      const hasParti = /\bPARTI\b/.test(context);
      const hasDepart = /\bDEPART\b/.test(context);
      const hasEnArrivee = /\bEN ARRIVEE\b/.test(context);
      const hasSale = /\bSALE\b/.test(context);
      
      // Format Medialog
      const hasDraps = /\bDRAPS\b/.test(context);
      
      let status = 'unknown';
      let cleaningType: 'full' | 'quick' | 'none' = 'none';
      
      // Logique de détection
      if (hasINS) {
        status = 'inspected';
        cleaningType = 'none';
      } else if (hasOCC) {
        status = 'occupied';
        cleaningType = 'none';
      } else if (hasDIR || hasSale) {
        status = 'dirty';
        cleaningType = 'full';
      } else if (hasDepart || hasParti || hasEnArrivee) {
        status = hasDepart || hasParti ? 'checkout' : 'arrival';
        cleaningType = 'full';
      } else if (hasDraps) {
        status = 'change-sheets';
        cleaningType = 'full';
      } else if (hasRecouche) {
        status = 'stayover';
        cleaningType = 'quick';
      } else if (hasCleaning) {
        status = 'to-clean';
        cleaningType = 'full';
      } else if (allDates.length >= 2) {
        // Si deux dates, probablement départ
        status = 'checkout';
        cleaningType = 'full';
      } else if (allDates.length === 1) {
        status = 'stayover';
        cleaningType = 'quick';
      }
      
      rooms.push({
        roomNumber: roomNumber.padStart(3, '0'),
        status,
        arrivalDate: allDates[0] || '',
        departureDate: allDates[allDates.length - 1] || '',
        cleaningType,
        validated: false
      });
    }
    
    return rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setIsUploading(true);
    
    try {
      const newReports: TrainingReport[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.type !== 'application/pdf') {
          toast({
            variant: "destructive",
            title: "Fichier invalide",
            description: `${file.name} n'est pas un PDF`,
          });
          continue;
        }
        
        const rawText = await extractTextFromPdf(file);
        const extractedData = autoExtractRooms(rawText);
        
        newReports.push({
          name: file.name,
          rawText,
          extractedData,
          validated: false
        });
      }
      
      setReports(prev => [...prev, ...newReports]);
      
      toast({
        title: "Rapports chargés",
        description: `${newReports.length} rapport(s) traité(s)`,
      });
    } catch (error) {
      console.error('Error processing PDFs:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors du traitement des fichiers",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const saveTrainingPattern = async (report: TrainingReport) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      
      const { data: hotels } = await supabase
        .from('hotels')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!hotels) throw new Error('Hôtel introuvable');
      
      const { error } = await supabase
        .from('report_training_patterns')
        .insert({
          hotel_id: hotels.id,
          report_name: report.name,
          raw_text: report.rawText,
          extracted_data: report.extractedData as any,
          validated: report.validated,
          created_by: user.id
        } as any);
      
      if (error) throw error;
      
      toast({
        title: "Pattern sauvegardé",
        description: "Le pattern d'entraînement a été enregistré",
      });
    } catch (error) {
      console.error('Error saving pattern:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la sauvegarde",
      });
    }
  };

  const updateRoomData = (room: ExtractedRoom) => {
    if (!selectedReport) return;
    
    const updatedData = selectedReport.extractedData.map(r => 
      r.roomNumber === room.roomNumber ? room : r
    );
    
    setSelectedReport({
      ...selectedReport,
      extractedData: updatedData
    });
    
    setReports(prev => prev.map(r => 
      r.name === selectedReport.name 
        ? { ...r, extractedData: updatedData }
        : r
    ));
  };

  const validateRoom = (roomNumber: string) => {
    if (!selectedReport) return;
    
    const updatedData = selectedReport.extractedData.map(r => 
      r.roomNumber === roomNumber ? { ...r, validated: true } : r
    );
    
    setSelectedReport({
      ...selectedReport,
      extractedData: updatedData
    });
    
    setReports(prev => prev.map(r => 
      r.name === selectedReport.name 
        ? { ...r, extractedData: updatedData }
        : r
    ));
  };

  const validateAllRooms = () => {
    if (!selectedReport) return;
    
    const updatedData = selectedReport.extractedData.map(r => ({ ...r, validated: true }));
    const updatedReport = { ...selectedReport, extractedData: updatedData, validated: true };
    
    setSelectedReport(updatedReport);
    setReports(prev => prev.map(r => 
      r.name === selectedReport.name ? updatedReport : r
    ));
    
    saveTrainingPattern(updatedReport);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Entraînement de l'algorithme</h2>
          <p className="text-muted-foreground">
            Téléchargez des rapports et validez les données extraites pour améliorer la reconnaissance
          </p>
        </div>
        
        <div className="flex gap-2">
          <Label htmlFor="pdf-upload" className="cursor-pointer">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              <FileUp className="h-4 w-4" />
              Télécharger des rapports
            </div>
          </Label>
          <Input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des rapports */}
        <Card className="p-4 lg:col-span-1">
          <h3 className="font-semibold mb-4">Rapports chargés ({reports.length})</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {reports.map((report, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedReport(report)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedReport?.name === report.name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{report.name}</p>
                    <p className="text-xs opacity-70">
                      {report.extractedData.length} chambres
                    </p>
                  </div>
                  {report.validated && (
                    <Badge variant="outline" className="ml-2">
                      <Check className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            
            {reports.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun rapport chargé
              </p>
            )}
          </div>
        </Card>

        {/* Données extraites */}
        {selectedReport && (
          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Données extraites - {selectedReport.name}</h3>
              <Button onClick={validateAllRooms} size="sm">
                <Check className="h-4 w-4 mr-2" />
                Valider tout
              </Button>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {selectedReport.extractedData.map((room) => (
                <Card key={room.roomNumber} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      {editingRoom?.roomNumber === room.roomNumber ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Numéro</Label>
                            <Input
                              value={editingRoom.roomNumber}
                              onChange={(e) => setEditingRoom({ ...editingRoom, roomNumber: e.target.value })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Statut</Label>
                            <Input
                              value={editingRoom.status}
                              onChange={(e) => setEditingRoom({ ...editingRoom, status: e.target.value })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Arrivée</Label>
                            <Input
                              value={editingRoom.arrivalDate}
                              onChange={(e) => setEditingRoom({ ...editingRoom, arrivalDate: e.target.value })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Départ</Label>
                            <Input
                              value={editingRoom.departureDate}
                              onChange={(e) => setEditingRoom({ ...editingRoom, departureDate: e.target.value })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Type nettoyage</Label>
                            <select
                              value={editingRoom.cleaningType}
                              onChange={(e) => setEditingRoom({ ...editingRoom, cleaningType: e.target.value as any })}
                              className="w-full h-8 px-3 rounded-md border bg-background"
                            >
                              <option value="full">À blanc</option>
                              <option value="quick">Recouche</option>
                              <option value="none">Aucun</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Chambre:</span>
                            <span className="font-semibold ml-2">{room.roomNumber}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Statut:</span>
                            <span className="ml-2">{room.status}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Arrivée:</span>
                            <span className="ml-2">{room.arrivalDate || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Départ:</span>
                            <span className="ml-2">{room.departureDate || 'N/A'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Type:</span>
                            <Badge className="ml-2" variant={
                              room.cleaningType === 'full' ? 'destructive' :
                              room.cleaningType === 'quick' ? 'default' : 'outline'
                            }>
                              {room.cleaningType === 'full' ? 'À blanc' :
                               room.cleaningType === 'quick' ? 'Recouche' : 'Aucun'}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1 ml-4">
                      {editingRoom?.roomNumber === room.roomNumber ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              updateRoomData(editingRoom);
                              setEditingRoom(null);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingRoom(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingRoom(room)}
                          >
                            Éditer
                          </Button>
                          {!room.validated && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => validateRoom(room.roomNumber)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {room.validated && (
                            <Badge variant="outline" className="text-green-600">
                              Validé
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}