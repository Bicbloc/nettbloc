import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Brain, Sparkles, Check, Loader2, 
  MousePointer, Eye, Zap, RotateCcw,
  Target, CheckCircle2, Lightbulb, User, UserX
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mewsDetectionService } from "@/services/mewsDetectionService";
import { getCleaningTypeLabel, normalizeCleaningType } from "@/utils/cleaningTypeUtils";
import { HotelDetectionRulesManager } from "./HotelDetectionRulesManager";
import { PatternAttributionDialog } from "./PatternAttributionDialog";

interface Annotation {
  id: string;
  text: string;
  field: 'roomNumber' | 'status' | 'cleaningType' | 'nightInfo' | 'guestName';
  lineIndex: number;
  confidence?: number;
}

interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: 'full' | 'quick' | 'none' | 'a_blanc' | 'recouche';
  arrivalDate?: string;
  departureDate?: string;
  guestName?: string;
  nightInfo?: string;
  confidence: number;
  detectionReason?: string;
  originalLine?: string;
  hasGuest?: boolean;
  rawStatus?: string;
}

interface EnhancedPatternLearningProps {
  rawText: string;
  hotelId: string;
  userId: string;
  reportName: string;
  onRoomsExtracted: (rooms: ExtractedRoom[]) => void;
}

// Étapes du guide
const STEPS = [
  { id: 1, title: "Annoter 2-3 lignes", description: "Sélectionnez des exemples de chambres" },
  { id: 2, title: "Vérifier les détections", description: "L'IA analyse vos exemples" },
  { id: 3, title: "Extraire tout", description: "Appliquer à tout le rapport" }
];

export const EnhancedPatternLearning = ({ 
  rawText, 
  hotelId, 
  userId,
  reportName, 
  onRoomsExtracted
}: EnhancedPatternLearningProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedField, setSelectedField] = useState<string>('roomNumber');
  const [isLearning, setIsLearning] = useState(false);
  const [extractedRooms, setExtractedRooms] = useState<ExtractedRoom[]>([]);
  const [previewResults, setPreviewResults] = useState<Map<number, { cleaningType: string; reason: string; confidence: number; hasGuest: boolean; rawStatus: string | null }>>(new Map());
  const [existingPatterns, setExistingPatterns] = useState<any[]>([]);
  const [showAttributionDialog, setShowAttributionDialog] = useState(false);
  const [savedPatternId, setSavedPatternId] = useState<string | null>(null);
  
  // Diviser le texte en lignes pour affichage
  const lines = rawText.split('\n').filter(l => l.trim().length > 5);
  const previewLines = lines.slice(0, 40);

  const fieldConfig = {
    roomNumber: { 
      label: 'N° Chambre', 
      color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50',
      icon: '🚪',
      hint: 'Ex: 101, 215, 1A...'
    },
    status: { 
      label: 'Statut', 
      color: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50',
      icon: '📊',
      hint: 'Ex: SAL, DIR, INS...'
    },
    nightInfo: { 
      label: 'Nuit X/Y', 
      color: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50',
      icon: '🌙',
      hint: 'Ex: Nuit 2/3, Night 1/2...'
    },
    guestName: { 
      label: 'Client', 
      color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50',
      icon: '👤',
      hint: 'Nom du client'
    }
  };

  useEffect(() => {
    loadExistingPatterns();
    mewsDetectionService.loadCustomRules(hotelId);
  }, [hotelId]);

  // Analyse en temps réel des lignes
  useEffect(() => {
    if (previewLines.length > 0) {
      analyzePreviewLines();
    }
  }, [rawText]);

  const loadExistingPatterns = async () => {
    const { data } = await supabase
      .from('report_training_patterns')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('validated', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) setExistingPatterns(data);
  };

  const analyzePreviewLines = useCallback(() => {
    const results = new Map<number, { cleaningType: string; reason: string; confidence: number; hasGuest: boolean; rawStatus: string | null }>();
    
    previewLines.forEach((line, index) => {
      const analysis = mewsDetectionService.analyzeLine(line);
      if (analysis.cleaningType !== 'none' || analysis.blocks.nightInfo || analysis.blocks.status || analysis.blocks.isOutOfOrder) {
        results.set(index, {
          cleaningType: analysis.cleaningType,
          reason: analysis.detailedReason || analysis.matchedRule || 'Analyse automatique',
          confidence: analysis.confidence,
          hasGuest: analysis.hasGuest,
          rawStatus: analysis.rawStatus
        });
      }
    });
    
    setPreviewResults(results);
  }, [previewLines]);

  const handleLineClick = (lineIndex: number, event: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) return;

    const selectedText = selection.toString().trim();
    
    // Vérifier si c'est un doublon
    const isDuplicate = annotations.some(a => 
      a.text === selectedText && a.field === selectedField
    );
    
    if (isDuplicate) {
      toast.error("Cette annotation existe déjà");
      return;
    }

    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      text: selectedText,
      field: selectedField as any,
      lineIndex
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    selection.removeAllRanges();

    toast.success(`${fieldConfig[selectedField as keyof typeof fieldConfig]?.label}: "${selectedText}"`);

    // Passer à l'étape 2 si assez d'annotations
    if (annotations.length >= 1) {
      setCurrentStep(2);
    }
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const learnAndExtract = async () => {
    if (annotations.length < 2) {
      toast.error("Annotez au moins 2 éléments (ex: 1 numéro + 1 statut ou Nuit X/Y)");
      return;
    }

    setIsLearning(true);
    setCurrentStep(3);

    try {
      const { data, error } = await supabase.functions.invoke('learn-pattern', {
        body: {
          textSample: rawText,
          annotations: annotations.map(a => ({
            text: a.text,
            field: a.field,
            lineIndex: a.lineIndex
          })),
          context: { hotelId, reportName, pmsType: 'mews' },
          mode: 'learn'
        }
      });

      if (error) throw error;

      if (data?.rooms?.length > 0) {
        // Normaliser les types de nettoyage
        const normalizedRooms = data.rooms.map((room: ExtractedRoom) => ({
          ...room,
          cleaningType: normalizeCleaningType(room.cleaningType)
        }));

        setExtractedRooms(normalizedRooms);
        onRoomsExtracted(normalizedRooms);

        // Sauvegarder le pattern
        await savePattern(data.patterns, normalizedRooms);

        toast.success(`${normalizedRooms.length} chambres extraites !`);
      } else {
        toast.error("Aucune chambre trouvée. Essayez avec plus d'annotations.");
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(error instanceof Error ? error.message : "Erreur d'apprentissage");
    } finally {
      setIsLearning(false);
    }
  };

  const applyExistingPattern = async (pattern: any) => {
    setIsLearning(true);

    try {
      const { data, error } = await supabase.functions.invoke('learn-pattern', {
        body: {
          mode: 'apply',
          learnedPatterns: pattern.detection_rules,
          fullText: rawText,
          context: { hotelId, reportName }
        }
      });

      if (error) throw error;

      const rooms = data?.extractedRooms?.rooms || [];
      if (rooms.length > 0) {
        const normalizedRooms = rooms.map((room: ExtractedRoom) => ({
          ...room,
          cleaningType: normalizeCleaningType(room.cleaningType)
        }));
        setExtractedRooms(normalizedRooms);
        onRoomsExtracted(normalizedRooms);
        setCurrentStep(3);
        toast.success(`${normalizedRooms.length} chambres extraites avec le pattern existant !`);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de l'application du pattern");
    } finally {
      setIsLearning(false);
    }
  };

  const savePattern = async (patterns: any, rooms: ExtractedRoom[]) => {
    try {
      const { data, error } = await supabase.from('report_training_patterns').insert({
        hotel_id: hotelId,
        report_name: reportName,
        pms_type: 'learned',
        raw_text: rawText.substring(0, 2000),
        extracted_data: rooms as any,
        detection_rules: patterns as any,
        validated: true,
        created_by: userId,
        accuracy_score: rooms.reduce((acc, r) => acc + r.confidence, 0) / rooms.length,
        pattern_name: reportName,
        assigned_to_hotel_id: hotelId
      }).select().single();
      
      if (data) {
        setSavedPatternId(data.id);
        setShowAttributionDialog(true);
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  };

  const resetLearning = () => {
    setAnnotations([]);
    setExtractedRooms([]);
    setCurrentStep(1);
  };

  const getCleaningBadgeStyle = (type: string) => {
    const normalized = normalizeCleaningType(type);
    switch (normalized) {
      case 'a_blanc': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      case 'recouche': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
      case 'none': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCleaningLabel = (type: string) => {
    const normalized = normalizeCleaningType(type);
    switch (normalized) {
      case 'a_blanc': return 'À Blanc';
      case 'recouche': return 'Recouche';
      case 'none': return 'Aucun';
      default: return getCleaningTypeLabel(type);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className={`flex flex-col items-center ${currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                    currentStep > step.id 
                      ? 'bg-primary text-primary-foreground' 
                      : currentStep === step.id 
                        ? 'bg-primary/20 border-2 border-primary text-primary' 
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                  </div>
                  <div className="text-center mt-2">
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-1 mx-4 rounded ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patterns existants */}
      {existingPatterns.length > 0 && currentStep === 1 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Patterns déjà appris
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {existingPatterns.map(pattern => (
                <Button
                  key={pattern.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyExistingPattern(pattern)}
                  disabled={isLearning}
                  className="hover:bg-primary/10"
                >
                  <Sparkles className="h-3 w-3 mr-2" />
                  {pattern.report_name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="annotate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="annotate">
            <MousePointer className="h-4 w-4 mr-2" />
            Annoter
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Aperçu IA
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Target className="h-4 w-4 mr-2" />
            Règles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="annotate" className="space-y-4">
          {/* Sélecteur de type */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium mr-2">Type à annoter :</span>
                {Object.entries(fieldConfig).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={selectedField === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedField(key)}
                    className={selectedField === key ? '' : config.color}
                  >
                    <span className="mr-1">{config.icon}</span>
                    {config.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Sélectionnez du texte dans les lignes ci-dessous, puis il sera automatiquement annoté
              </p>
            </CardContent>
          </Card>

          {/* Zone d'annotation */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Texte du rapport</CardTitle>
                <Badge variant="outline">{previewLines.length} lignes affichées</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-3 max-h-[400px] overflow-auto space-y-1">
                {previewLines.map((line, index) => {
                  const preview = previewResults.get(index);
                  const lineAnnotations = annotations.filter(a => a.lineIndex === index);
                  
                  return (
                    <div 
                      key={index}
                      className={`group flex items-start gap-2 py-1 px-2 rounded cursor-text hover:bg-muted/50 transition-colors ${
                        lineAnnotations.length > 0 ? 'bg-primary/5 border-l-2 border-primary' : ''
                      }`}
                      onMouseUp={(e) => handleLineClick(index, e)}
                    >
                      <span className="text-xs text-muted-foreground w-6 shrink-0 pt-0.5">
                        {index + 1}
                      </span>
                      <div className="flex-1 font-mono text-sm break-all select-text">
                        {line}
                      </div>
                      {preview && (
                        <Badge 
                          variant="outline" 
                          className={`shrink-0 text-xs ${getCleaningBadgeStyle(preview.cleaningType)}`}
                        >
                          {getCleaningTypeLabel(preview.cleaningType)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Annotations */}
          {annotations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Vos annotations ({annotations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {annotations.map(annotation => (
                    <Badge
                      key={annotation.id}
                      variant="outline"
                      className={`${fieldConfig[annotation.field as keyof typeof fieldConfig]?.color} py-1 px-3 cursor-pointer hover:opacity-70`}
                      onClick={() => removeAnnotation(annotation.id)}
                    >
                      <span className="mr-1">{fieldConfig[annotation.field as keyof typeof fieldConfig]?.icon}</span>
                      "{annotation.text}"
                      <span className="ml-2 text-xs opacity-70">×</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={learnAndExtract}
              disabled={annotations.length < 2 || isLearning}
              className="flex-1"
              size="lg"
            >
              {isLearning ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Apprentissage en cours...
                </>
              ) : (
                <>
                  <Brain className="h-5 w-5 mr-2" />
                  Apprendre et extraire ({annotations.length}/2 min)
                </>
              )}
            </Button>
            {annotations.length > 0 && (
              <Button variant="outline" onClick={resetLearning}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Aperçu de la détection automatique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                L'IA analyse chaque ligne en temps réel selon les règles configurées (INS/SAL sans client = Propre)
              </p>
              
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {previewLines.slice(0, 25).map((line, index) => {
                  const analysis = mewsDetectionService.analyzeLine(line);
                  const hasInfo = analysis.blocks.nightInfo || analysis.blocks.status || 
                                  analysis.blocks.hasDepartureBlock || analysis.blocks.hasArrivalBlock ||
                                  analysis.blocks.isOutOfOrder;
                  
                  if (!hasInfo) return null;
                  
                  return (
                    <div key={index} className="p-3 rounded-lg border bg-card">
                      <p className="font-mono text-xs truncate mb-2">{line}</p>
                      <div className="flex flex-wrap gap-2 text-xs items-center">
                        <Badge className={getCleaningBadgeStyle(analysis.cleaningType)}>
                          {getCleaningLabel(analysis.cleaningType)}
                        </Badge>
                        {analysis.rawStatus && (
                          <Badge variant="secondary" className="text-xs">
                            {analysis.rawStatus}
                          </Badge>
                        )}
                        {analysis.hasGuest ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <User className="h-3 w-3" />
                            {analysis.blocks.guestName || 'Client'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <UserX className="h-3 w-3" />
                            Vide
                          </span>
                        )}
                        {analysis.blocks.nightInfo && (
                          <Badge variant="outline">
                            Nuit {analysis.blocks.nightInfo.current}/{analysis.blocks.nightInfo.total}
                          </Badge>
                        )}
                        <span className="text-muted-foreground ml-auto">
                          {analysis.detailedReason}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <HotelDetectionRulesManager hotelId={hotelId} userId={userId} />
        </TabsContent>
      </Tabs>

      {/* Résultats */}
      {extractedRooms.length > 0 && (
        <Card className="border-green-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              {extractedRooms.length} chambres extraites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b">
                    <th className="text-left p-2">Chambre</th>
                    <th className="text-left p-2">Nettoyage</th>
                    <th className="text-left p-2">Statut</th>
                    <th className="text-left p-2">Client?</th>
                    <th className="text-left p-2">Nuit</th>
                    <th className="text-left p-2">Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedRooms.slice(0, 60).map((room, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{room.roomNumber}</td>
                      <td className="p-2">
                        <Badge className={getCleaningBadgeStyle(room.cleaningType)}>
                          {getCleaningLabel(room.cleaningType)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {room.rawStatus && (
                          <Badge variant="secondary" className="text-xs">
                            {room.rawStatus}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">
                        {room.hasGuest ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <User className="h-3 w-3" />
                            {room.guestName || 'Oui'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <UserX className="h-3 w-3" />
                            Non
                          </span>
                        )}
                      </td>
                      <td className="p-2">{room.nightInfo || '-'}</td>
                      <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate" title={room.detectionReason}>
                        {room.detectionReason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog d'attribution */}
      <PatternAttributionDialog
        open={showAttributionDialog}
        onOpenChange={setShowAttributionDialog}
        hotelId={hotelId}
        patternId={savedPatternId || undefined}
        extractedRoomsCount={extractedRooms.length}
        averageConfidence={extractedRooms.length > 0 
          ? extractedRooms.reduce((acc, r) => acc + r.confidence, 0) / extractedRooms.length 
          : 0
        }
        reportName={reportName}
        onSave={() => loadExistingPatterns()}
      />
    </div>
  );
};
