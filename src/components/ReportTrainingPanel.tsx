import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Check, X, Brain, Sparkles, Link2, Unlink } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { smartExtractionService, type ExtractedRoom } from "@/services/smartExtractionService";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [mergingMode, setMergingMode] = useState(false);

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
    
    return smartRooms;
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
      console.error('Erreur lors du traitement:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du traitement des fichiers",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const updateRoomData = (index: number, field: keyof ExtractedRoom, value: any) => {
    if (!selectedReport) return;

    const updatedRooms = [...selectedReport.extractedRooms];
    updatedRooms[index] = { ...updatedRooms[index], [field]: value };
    setSelectedReport({ ...selectedReport, extractedRooms: updatedRooms });
  };

  const validateRoom = (index: number) => {
    if (!selectedReport) return;

    const updatedRooms = [...selectedReport.extractedRooms];
    updatedRooms[index] = { ...updatedRooms[index], validated: !updatedRooms[index].validated };
    setSelectedReport({ ...selectedReport, extractedRooms: updatedRooms });
  };

  const validateAllRooms = async () => {
    if (!selectedReport) return;

    const updatedRooms = selectedReport.extractedRooms.map(room => ({
      ...room,
      validated: true
    }));

    setSelectedReport({ ...selectedReport, extractedRooms: updatedRooms, validated: true });
    await saveTrainingPattern(updatedRooms);
  };

  const mergeSelectedRooms = () => {
    if (!selectedReport || selectedRooms.size < 2) {
      toast({
        title: "Erreur",
        description: "Sélectionnez au moins 2 chambres à fusionner",
        variant: "destructive"
      });
      return;
    }

    const selectedIndices = Array.from(selectedRooms).sort((a, b) => a - b);
    const roomsToMerge = selectedIndices.map(i => selectedReport.extractedRooms[i]);
    const roomNumbers = roomsToMerge.map(r => r.roomNumber);
    
    const mergedRoom: ExtractedRoom = {
      roomNumber: roomNumbers.join('-'),
      status: roomsToMerge[0].status,
      arrivalDate: roomsToMerge[0].arrivalDate,
      departureDate: roomsToMerge[0].departureDate,
      cleaningType: roomsToMerge[0].cleaningType,
      validated: true,
      isConnected: true,
      connectedRooms: roomNumbers,
      originalText: roomsToMerge.map(r => r.originalText || r.roomNumber).join(' + ')
    };

    const updatedRooms = selectedReport.extractedRooms.filter((_, i) => !selectedRooms.has(i));
    updatedRooms.push(mergedRoom);

    setSelectedReport({ ...selectedReport, extractedRooms: updatedRooms });
    setSelectedRooms(new Set());
    setMergingMode(false);
    toast({
      title: "Succès",
      description: "Chambres fusionnées avec succès"
    });
  };

  const splitConnectedRoom = (index: number) => {
    if (!selectedReport) return;

    const room = selectedReport.extractedRooms[index];
    if (!room.isConnected || !room.connectedRooms) {
      toast({
        title: "Erreur",
        description: "Cette chambre n'est pas connectée",
        variant: "destructive"
      });
      return;
    }

    const separatedRooms: ExtractedRoom[] = room.connectedRooms.map(roomNum => ({
      roomNumber: roomNum,
      status: room.status,
      arrivalDate: room.arrivalDate,
      departureDate: room.departureDate,
      cleaningType: room.cleaningType,
      validated: true,
      originalText: roomNum
    }));

    const updatedRooms = [...selectedReport.extractedRooms];
    updatedRooms.splice(index, 1, ...separatedRooms);

    setSelectedReport({ ...selectedReport, extractedRooms: updatedRooms });
    toast({
      title: "Succès",
      description: "Chambres séparées avec succès"
    });
  };

  const toggleRoomSelection = (index: number) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedRooms(newSelection);
  };

  const saveTrainingPattern = async (rooms: ExtractedRoom[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase.from('report_training_patterns').insert([{
      hotel_id: hotelId,
      report_name: selectedReport?.name || 'rapport',
      pms_type: detectedPmsType || selectedPmsType,
      raw_text: selectedReport?.rawText || '',
      extracted_data: rooms as any,
      validated: true,
      created_by: user.id,
      detection_rules: {
        connected_rooms: rooms.filter(r => r.isConnected).map(r => ({
          pattern: r.roomNumber,
          rooms: r.connectedRooms
        }))
      }
    }]);

    if (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la sauvegarde",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Succès",
        description: "Pattern d'entraînement sauvegardé"
      });
      await smartExtractionService.loadLearnedPatterns(hotelId);
    }
  };

  const availablePmsTypes = smartExtractionService.getAvailablePmsTypes();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Entraînement de l'IA
            </h3>
            <p className="text-sm text-muted-foreground">
              Uploadez vos rapports PDF pour entraîner l'IA à reconnaître le format spécifique de votre PMS
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Type de PMS</Label>
              <Select value={selectedPmsType} onValueChange={setSelectedPmsType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-détection</SelectItem>
                  {availablePmsTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label htmlFor="pdf-upload">Upload PDF</Label>
              <Input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
          </div>

          {detectedPmsType && (
            <Badge variant="secondary" className="flex items-center gap-2 w-fit">
              <Sparkles className="w-3 h-3" />
              PMS détecté: {detectedPmsType.toUpperCase()}
            </Badge>
          )}
        </div>
      </Card>

      {reports.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Rapports uploadés</h3>
            <div className="grid gap-2">
              {reports.map((report, index) => (
                <Button
                  key={index}
                  variant={selectedReport?.name === report.name ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setSelectedReport(report)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {report.name} ({report.extractedRooms.length} chambres)
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {selectedReport && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Validation des données</h3>
              <Badge variant={selectedReport.validated ? "default" : "secondary"}>
                {selectedReport.validated ? "Validé" : "En attente"}
              </Badge>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={validateAllRooms}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-2" />
                Valider toutes les chambres
              </Button>
              <Button
                onClick={() => {
                  setMergingMode(!mergingMode);
                  setSelectedRooms(new Set());
                }}
                variant={mergingMode ? "default" : "outline"}
                className="flex-1"
              >
                <Link2 className="w-4 h-4 mr-2" />
                {mergingMode ? "Annuler fusion" : "Fusionner chambres"}
              </Button>
              {mergingMode && selectedRooms.size >= 2 && (
                <Button onClick={mergeSelectedRooms} variant="secondary">
                  Confirmer fusion ({selectedRooms.size} chambres)
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {selectedReport.extractedRooms.map((room, index) => (
                <Card 
                  key={index} 
                  className={`p-4 ${room.validated ? 'border-green-500' : 'border-yellow-500'} ${
                    mergingMode && selectedRooms.has(index) ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {mergingMode && (
                          <Checkbox
                            checked={selectedRooms.has(index)}
                            onCheckedChange={() => toggleRoomSelection(index)}
                          />
                        )}
                        {room.isConnected && (
                          <Badge variant="secondary" className="text-xs">
                            <Link2 className="w-3 h-3 mr-1" />
                            Connectées
                          </Badge>
                        )}
                        <Label className="font-medium">Chambre {room.roomNumber}</Label>
                      </div>
                      <div className="flex gap-2">
                        {room.isConnected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => splitConnectedRoom(index)}
                            title="Séparer les chambres"
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={room.validated ? "default" : "outline"}
                          onClick={() => validateRoom(index)}
                        >
                          {room.validated ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    {room.connectedRooms && room.connectedRooms.length > 0 && (
                      <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                        <strong>Chambres liées:</strong> {room.connectedRooms.join(', ')}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Statut</Label>
                        <Input
                          value={room.status}
                          onChange={(e) => updateRoomData(index, 'status', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Type de nettoyage</Label>
                        <Select
                          value={room.cleaningType}
                          onValueChange={(value) => updateRoomData(index, 'cleaningType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Complet</SelectItem>
                            <SelectItem value="quick">Rapide</SelectItem>
                            <SelectItem value="none">Aucun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Arrivée</Label>
                        <Input
                          value={room.arrivalDate}
                          onChange={(e) => updateRoomData(index, 'arrivalDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Départ</Label>
                        <Input
                          value={room.departureDate}
                          onChange={(e) => updateRoomData(index, 'departureDate', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
