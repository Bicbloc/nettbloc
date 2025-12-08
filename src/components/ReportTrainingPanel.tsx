import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, Check, X, Brain, Sparkles, Link2, Unlink, Eye, Wand2, BarChart3, AlertCircle } from "lucide-react";
import { SimplePatternLearning } from "./SimplePatternLearning";
import { EnhancedPatternLearning } from "./EnhancedPatternLearning";
import { PatternValidation } from "./PatternValidation";
import { ErrorAnalysisDashboard } from "./ErrorAnalysisDashboard";
import { ConnectedRoomRulesManager } from "./ConnectedRoomRulesManager";
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
  const [activeTab, setActiveTab] = useState<string>("validation");
  const [learnedPatterns, setLearnedPatterns] = useState<any>(null);
  const [manualAnnotations, setManualAnnotations] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    smartExtractionService.loadLearnedPatterns(hotelId);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
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
        console.log('📄 Texte extrait:', text.substring(0, 200));
        
        const pmsType = selectedPmsType === 'auto' ? undefined : selectedPmsType;
        const extractedRooms = autoExtractRooms(text, pmsType);
        
        console.log('🏠 Chambres extraites:', extractedRooms.length, extractedRooms);

        if (extractedRooms.length === 0) {
          toast({
            title: "Aucune chambre détectée",
            description: `Impossible d'extraire des chambres de ${file.name}. Vérifiez le format du PDF.`,
            variant: "destructive"
          });
          continue;
        }

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
      linkedRooms: roomNumbers,
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
    if (!room.isConnected || !room.linkedRooms) {
      toast({
        title: "Erreur",
        description: "Cette chambre n'est pas connectée",
        variant: "destructive"
      });
      return;
    }

    const separatedRooms: ExtractedRoom[] = room.linkedRooms.map(roomNum => ({
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
          rooms: r.linkedRooms
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

  // Fonction pour surligner le texte avec les chambres détectées
  const highlightRoomsInText = (text: string, rooms: ExtractedRoom[]) => {
    if (!rooms || rooms.length === 0) return [{ text, isHighlighted: false }];

    // Trier les chambres par ordre décroissant de longueur pour éviter les conflits
    const sortedRooms = [...rooms].sort((a, b) => 
      b.roomNumber.length - a.roomNumber.length
    );

    const segments: { text: string; isHighlighted: boolean; roomIndex?: number }[] = [];
    const positions: { start: number; end: number; roomIndex: number }[] = [];

    // Trouver toutes les positions des chambres dans le texte
    sortedRooms.forEach((room, roomIndex) => {
      const roomNumber = room.roomNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${roomNumber}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // Vérifier qu'il n'y a pas de chevauchement
        const overlap = positions.some(pos => 
          (match.index >= pos.start && match.index < pos.end) ||
          (match.index + match[0].length > pos.start && match.index + match[0].length <= pos.end)
        );
        
        if (!overlap) {
          positions.push({
            start: match.index,
            end: match.index + match[0].length,
            roomIndex
          });
        }
      }
    });

    // Trier les positions par ordre d'apparition
    positions.sort((a, b) => a.start - b.start);

    // Créer les segments
    let lastIndex = 0;
    positions.forEach(pos => {
      // Texte avant
      if (pos.start > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, pos.start),
          isHighlighted: false
        });
      }
      // Texte surligné
      segments.push({
        text: text.substring(pos.start, pos.end),
        isHighlighted: true,
        roomIndex: pos.roomIndex
      });
      lastIndex = pos.end;
    });

    // Reste du texte
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isHighlighted: false
      });
    }

    return segments.length > 0 ? segments : [{ text, isHighlighted: false }];
  };

  // Rendu de la prévisualisation du texte
  const renderTextPreview = () => {
    if (!selectedReport) return null;

    const segments = highlightRoomsInText(selectedReport.rawText, selectedReport.extractedRooms);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Texte brut extrait</h3>
            <p className="text-sm text-muted-foreground">
              {selectedReport.extractedRooms.length} chambre(s) détectée(s) et surlignée(s)
            </p>
          </div>
          <Badge variant="outline" className="gap-2">
            <Eye className="h-3 w-3" />
            Prévisualisation
          </Badge>
        </div>

        <Card className="p-4">
          <div className="bg-muted/30 rounded-md p-4 max-h-[600px] overflow-auto font-mono text-sm whitespace-pre-wrap break-words">
            {segments.map((segment, idx) => (
              segment.isHighlighted ? (
                <mark
                  key={idx}
                  className="bg-primary/20 text-primary font-semibold px-1 rounded cursor-pointer hover:bg-primary/30 transition-colors"
                  title={segment.roomIndex !== undefined ? `Chambre ${selectedReport.extractedRooms[segment.roomIndex]?.roomNumber}` : ''}
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={idx}>{segment.text}</span>
              )
            ))}
          </div>
        </Card>

        <div className="flex gap-2 text-xs text-muted-foreground items-center">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary/20 rounded" />
            <span>Chambres détectées</span>
          </div>
        </div>
      </div>
    );
  };

  const handlePatternsLearned = (patterns: any) => {
    setLearnedPatterns(patterns);
    toast({
      title: "Patterns appris",
      description: "Les nouveaux patterns ont été appris et seront utilisés pour les prochaines extractions",
    });
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
              <div className="relative">
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                {uploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                      <span>Analyse en cours...</span>
                    </div>
                  </div>
                )}
              </div>
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6 mb-4">
                <TabsTrigger value="validation">Validation</TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4 mr-2" />
                  Prévisualisation
                </TabsTrigger>
                <TabsTrigger value="learn">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Apprentissage
                </TabsTrigger>
                <TabsTrigger value="metrics">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Métriques
                </TabsTrigger>
                <TabsTrigger value="analysis">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Analyse
                </TabsTrigger>
                <TabsTrigger value="rules">
                  <Link2 className="h-4 w-4 mr-2" />
                  Règles
                </TabsTrigger>
              </TabsList>

            <TabsContent value="validation" className="space-y-4">
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
                    
                    {room.linkedRooms && room.linkedRooms.length > 0 && (
                      <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                        <strong>Chambres liées:</strong> {room.linkedRooms.join(', ')}
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
          </TabsContent>

          <TabsContent value="preview">
            {renderTextPreview()}
          </TabsContent>

          <TabsContent value="learn">
            <EnhancedPatternLearning
              rawText={selectedReport.rawText}
              hotelId={hotelId}
              userId={currentUserId}
              reportName={selectedReport.name}
              onRoomsExtracted={(rooms) => {
                // Mettre à jour les chambres extraites avec les résultats de l'IA
                const updatedRooms = rooms.map(room => ({
                  roomNumber: room.roomNumber,
                  status: room.status,
                  cleaningType: (room.cleaningType === 'a_blanc' ? 'full' : room.cleaningType === 'recouche' ? 'quick' : room.cleaningType) as 'full' | 'quick' | 'none',
                  arrivalDate: room.arrivalDate || '',
                  departureDate: room.departureDate || '',
                  validated: false,
                  confidence: room.confidence,
                  originalText: room.originalLine
                }));
                
                setSelectedReport({
                  ...selectedReport,
                  extractedRooms: updatedRooms
                });
                
                toast({
                  title: "Chambres mises à jour",
                  description: `${updatedRooms.length} chambres extraites par l'IA`
                });
              }}
            />
          </TabsContent>

          <TabsContent value="metrics">
            <PatternValidation
              annotations={manualAnnotations}
              extractedRooms={selectedReport.extractedRooms}
              patterns={learnedPatterns}
              hotelId={hotelId}
              reportName={selectedReport.name}
              pmsType={detectedPmsType || selectedPmsType}
            />
          </TabsContent>

          <TabsContent value="analysis">
            <ErrorAnalysisDashboard hotelId={hotelId} />
          </TabsContent>

          <TabsContent value="rules">
            <ConnectedRoomRulesManager hotelId={hotelId} />
          </TabsContent>

        </Tabs>
        </Card>
      )}
    </div>
  );
};
