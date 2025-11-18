import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Check, X, Brain, Sparkles } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { smartExtractionService, type ExtractedRoom as SmartExtractedRoom } from "@/services/smartExtractionService";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ExtractedRoom {
  roomNumber: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  cleaningType: 'full' | 'quick' | 'none';
  validated: boolean;
  confidence?: number;
}

interface TrainingReport {
  name: string;
  rawText: string;
  extractedRooms: ExtractedRoom[];
  validated: boolean;
}

export const ReportTrainingPanel = ({ hotelId }: { hotelId: string }) => {
  const { toast } = useToast();
  const [reports, setReports] = useState<TrainingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<TrainingReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPmsType, setSelectedPmsType] = useState<string>('auto');
  const [detectedPmsType, setDetectedPmsType] = useState<string>('');

  useEffect(() => {
    smartExtractionService.loadLearnedPatterns(hotelId);
  }, [hotelId]);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
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

  const autoExtractRooms = (text: string, pmsType?: string): ExtractedRoom[] => {
    const smartRooms = smartExtractionService.extractRooms(text, pmsType);
    
    if (!pmsType || pmsType === 'auto') {
      const detected = smartExtractionService.detectPmsType(text);
      setDetectedPmsType(detected);
    }
    
    return smartRooms as ExtractedRoom[];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newReports: TrainingReport[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!file.type.includes('pdf')) {
          toast({
            title: "Format non supporté",
            description: `${file.name} n'est pas un PDF`,
            variant: "destructive"
          });
          continue;
        }

        const text = await extractTextFromPdf(file);
        const pmsType = selectedPmsType === 'auto' ? undefined : selectedPmsType;
        const extractedRooms = autoExtractRooms(text, pmsType);

        newReports.push({
          name: file.name,
          rawText: text,
          extractedRooms,
          validated: false
        });
      }

      setReports([...reports, ...newReports]);
      
      if (newReports.length > 0) {
        setSelectedReport(newReports[0]);
        toast({
          title: "Extraction réussie",
          description: `${newReports.length} rapport(s) traité(s), ${newReports.reduce((sum, r) => sum + r.extractedRooms.length, 0)} chambres détectées`
        });
      }
    } catch (error) {
      console.error('Error processing PDFs:', error);
      toast({
        title: "Erreur",
        description: "Impossible de traiter les PDFs",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const saveTrainingPattern = async (report: TrainingReport) => {
    if (!report.extractedRooms.some(r => r.validated)) {
      toast({
        title: "Aucune validation",
        description: "Veuillez valider au moins une chambre",
        variant: "destructive"
      });
      return;
    }

    const pmsType = detectedPmsType || (selectedPmsType === 'auto' ? 'unknown' : selectedPmsType);
    
    const validatedCount = report.extractedRooms.filter(r => r.validated).length;
    const accuracyScore = report.extractedRooms.length > 0 
      ? validatedCount / report.extractedRooms.length 
      : 0;

    const { error } = await supabase
      .from('report_training_patterns')
      .insert([{
        hotel_id: hotelId,
        report_name: report.name,
        raw_text: report.rawText,
        extracted_data: report.extractedRooms as any,
        validated: true,
        pms_type: pmsType,
        accuracy_score: accuracyScore,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }]);

    if (error) {
      console.error('Error saving pattern:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le pattern",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Pattern sauvegardé",
      description: `Pattern ${pmsType} enregistré avec succès (précision: ${(accuracyScore * 100).toFixed(1)}%)`
    });

    await smartExtractionService.loadLearnedPatterns(hotelId);
    
    setReports(reports.map(r => 
      r.name === report.name ? { ...r, validated: true } : r
    ));
  };

  const updateRoomData = (roomNumber: string, field: keyof ExtractedRoom, value: any) => {
    if (!selectedReport) return;

    const updatedRooms = selectedReport.extractedRooms.map(room =>
      room.roomNumber === roomNumber ? { ...room, [field]: value } : room
    );

    const updatedReport = { ...selectedReport, extractedRooms: updatedRooms };
    setSelectedReport(updatedReport);
    setReports(reports.map(r => r.name === selectedReport.name ? updatedReport : r));
  };

  const validateRoom = (roomNumber: string) => {
    updateRoomData(roomNumber, 'validated', true);
  };

  const validateAllRooms = () => {
    if (!selectedReport) return;

    const allValidated = selectedReport.extractedRooms.map(room => ({ ...room, validated: true }));
    const updatedReport = { ...selectedReport, extractedRooms: allValidated };
    
    setSelectedReport(updatedReport);
    setReports(reports.map(r => r.name === selectedReport.name ? updatedReport : r));

    saveTrainingPattern(updatedReport);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Entraînement Intelligent IA</h3>
              <p className="text-sm text-muted-foreground">
                Téléchargez des rapports PDF et sélectionnez le type de PMS pour améliorer la précision
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pms-type">Type de PMS</Label>
              <Select value={selectedPmsType} onValueChange={setSelectedPmsType}>
                <SelectTrigger id="pms-type">
                  <SelectValue placeholder="Sélectionner le type de PMS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Détection automatique
                    </div>
                  </SelectItem>
                  <SelectItem value="apaleo">Apaleo</SelectItem>
                  <SelectItem value="medialog">Medialog</SelectItem>
                  <SelectItem value="space">Space / Mews</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {detectedPmsType && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  PMS détecté: <Badge variant="secondary">{detectedPmsType}</Badge>
                </span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="file-upload">Télécharger des rapports PDF</Label>
            <div className="mt-2">
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
              >
                <div className="flex flex-col items-center">
                  <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Traitement en cours..." : "Cliquez ou glissez des PDF ici"}
                  </span>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {reports.length > 0 && (
            <div className="space-y-2">
              <Label>Rapports chargés ({reports.length})</Label>
              <div className="space-y-2">
                {reports.map((report, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedReport(report)}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedReport?.name === report.name ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {report.extractedRooms.length} chambres détectées
                        </div>
                      </div>
                    </div>
                    {report.validated && (
                      <Badge variant="secondary">
                        <Check className="h-3 w-3 mr-1" />
                        Validé
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {selectedReport && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold">{selectedReport.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedReport.extractedRooms.filter(r => r.validated).length} / {selectedReport.extractedRooms.length} validées
                </p>
              </div>
              <Button onClick={validateAllRooms} disabled={selectedReport.validated}>
                <Check className="h-4 w-4 mr-2" />
                Valider tout et enregistrer
              </Button>
            </div>

            <div className="space-y-2">
              {selectedReport.extractedRooms.map((room, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg ${room.validated ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Chambre {room.roomNumber}</Badge>
                      <Badge>{room.status}</Badge>
                      <Badge variant={room.cleaningType === 'full' ? 'default' : room.cleaningType === 'quick' ? 'secondary' : 'outline'}>
                        {room.cleaningType === 'full' ? 'Nettoyage complet' : room.cleaningType === 'quick' ? 'Recouche' : 'Aucun'}
                      </Badge>
                      {room.confidence && (
                        <span className="text-xs text-muted-foreground">
                          {(room.confidence * 100).toFixed(0)}% confiance
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={room.validated ? "secondary" : "default"}
                      onClick={() => validateRoom(room.roomNumber)}
                      disabled={room.validated}
                    >
                      {room.validated ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <Label className="text-xs">Numéro</Label>
                      <Input
                        value={room.roomNumber}
                        onChange={(e) => updateRoomData(room.roomNumber, 'roomNumber', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Statut</Label>
                      <Input
                        value={room.status}
                        onChange={(e) => updateRoomData(room.roomNumber, 'status', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Arrivée</Label>
                      <Input
                        value={room.arrivalDate}
                        onChange={(e) => updateRoomData(room.roomNumber, 'arrivalDate', e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Départ</Label>
                      <Input
                        value={room.departureDate}
                        onChange={(e) => updateRoomData(room.roomNumber, 'departureDate', e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
