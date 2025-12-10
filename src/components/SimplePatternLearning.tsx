import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Brain, Sparkles, Check, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface Annotation {
  id: string;
  text: string;
  field: 'roomNumber' | 'status' | 'cleaningType';
  startIndex: number;
  endIndex: number;
}

interface ExtractedRoom {
  roomNumber: string;
  status: string;
  cleaningType: 'full' | 'quick' | 'none';
  arrivalDate?: string;
  departureDate?: string;
  guestName?: string;
  nightInfo?: string;
  confidence: number;
  originalLine?: string;
}

interface LearnedPattern {
  roomNumberFormat: string;
  roomNumberRegex: string;
  statusKeywords: Record<string, { status: string; cleaning: string }>;
  dateFormat: string;
  lineFormat: string;
}

interface SimplePatternLearningProps {
  rawText: string;
  hotelId: string;
  reportName: string;
  onRoomsExtracted: (rooms: ExtractedRoom[]) => void;
  onPatternsLearned?: (patterns: LearnedPattern) => void;
}

export const SimplePatternLearning = ({ 
  rawText, 
  hotelId, 
  reportName, 
  onRoomsExtracted,
  onPatternsLearned
}: SimplePatternLearningProps) => {
  const { toast } = useToast();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedField, setSelectedField] = useState<string>('roomNumber');
  const [isLearning, setIsLearning] = useState(false);
  const [extractedRooms, setExtractedRooms] = useState<ExtractedRoom[]>([]);
  const [learnedPatterns, setLearnedPatterns] = useState<LearnedPattern | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [existingPatterns, setExistingPatterns] = useState<any[]>([]);
  const [useExistingPattern, setUseExistingPattern] = useState(false);

  const fieldLabels = {
    roomNumber: 'Numéro de chambre',
    status: 'Statut (SAL, INS, DIR...)',
    cleaningType: 'Type nettoyage (Nuit X/Y...)'
  };

  const fieldColors = {
    roomNumber: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300',
    status: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
    cleaningType: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300'
  };

  // Charger les patterns existants pour cet hôtel
  useEffect(() => {
    loadExistingPatterns();
  }, [hotelId]);

  const loadExistingPatterns = async () => {
    console.log(`🔍 Chargement des patterns pour l'hôtel: ${hotelId}`);
    
    // Charger les patterns: créés par cet hôtel OU assignés à cet hôtel OU patterns par défaut
    const { data, error } = await supabase
      .from('report_training_patterns')
      .select('*')
      .or(`hotel_id.eq.${hotelId},assigned_to_hotel_id.eq.${hotelId},is_default.eq.true`)
      .eq('validated', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data && data.length > 0) {
      console.log(`✅ ${data.length} pattern(s) trouvé(s):`);
      data.forEach(p => {
        console.log(`   📋 ${p.pattern_name || 'Sans nom'} - PMS: ${p.pms_type || 'auto'} - Créé par: ${p.hotel_id} - Assigné à: ${p.assigned_to_hotel_id || 'aucun'}`);
      });
      setExistingPatterns(data);
    } else {
      console.log(`⚠️ Aucun pattern trouvé pour cet hôtel`);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    const textContainer = document.getElementById('simple-annotatable-text');
    
    if (!textContainer || !textContainer.contains(range.startContainer)) return;

    preCaretRange.selectNodeContents(textContainer);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const startIndex = preCaretRange.toString().length;
    const endIndex = startIndex + selectedText.length;

    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      text: selectedText,
      field: selectedField as any,
      startIndex,
      endIndex
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    selection.removeAllRanges();

    toast({
      title: "Annotation ajoutée",
      description: `${fieldLabels[selectedField as keyof typeof fieldLabels]}: "${selectedText}"`,
    });
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const renderAnnotatedText = () => {
    // Afficher seulement les premières lignes pour l'annotation
    const previewText = rawText.split('\n').slice(0, 30).join('\n');
    
    if (annotations.length === 0) {
      return <span>{previewText}</span>;
    }

    const sortedAnnotations = [...annotations]
      .filter(a => a.startIndex < previewText.length)
      .sort((a, b) => a.startIndex - b.startIndex);
    
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach((annotation, idx) => {
      if (annotation.startIndex > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {previewText.substring(lastIndex, annotation.startIndex)}
          </span>
        );
      }

      const endIdx = Math.min(annotation.endIndex, previewText.length);
      segments.push(
        <mark
          key={`annotation-${annotation.id}`}
          className={`${fieldColors[annotation.field]} px-1 py-0.5 rounded font-semibold cursor-pointer`}
          title={fieldLabels[annotation.field]}
        >
          {previewText.substring(annotation.startIndex, endIdx)}
        </mark>
      );

      lastIndex = endIdx;
    });

    if (lastIndex < previewText.length) {
      segments.push(
        <span key="text-final">{previewText.substring(lastIndex)}</span>
      );
    }

    return segments;
  };

  const learnAndExtract = async () => {
    if (annotations.length < 2) {
      toast({
        title: "Annotations insuffisantes",
        description: "Annotez au moins 2 éléments (ex: 1 numéro de chambre + 1 statut)",
        variant: "destructive"
      });
      return;
    }

    setIsLearning(true);
    setExtractedRooms([]);

    try {
      const { data, error } = await supabase.functions.invoke('learn-pattern', {
        body: {
          textSample: rawText,
          annotations: annotations.map(a => ({
            text: a.text,
            field: a.field,
            position: { start: a.startIndex, end: a.endIndex }
          })),
          context: {
            hotelId,
            reportName,
            pmsType: 'unknown'
          },
          mode: 'learn'
        }
      });

      if (error) throw error;

      if (data?.rooms && data.rooms.length > 0) {
        setExtractedRooms(data.rooms);
        onRoomsExtracted(data.rooms);
        
        if (data.patterns) {
          setLearnedPatterns(data.patterns);
          onPatternsLearned?.(data.patterns);
        }
        
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }

        // Sauvegarder les patterns appris
        await saveLearnedPatterns(data.patterns, data.rooms);

        toast({
          title: "Apprentissage réussi !",
          description: `${data.rooms.length} chambres extraites à partir de ${annotations.length} annotations`,
        });
      } else {
        toast({
          title: "Aucune chambre trouvée",
          description: "Essayez d'ajouter plus d'annotations",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Erreur apprentissage:', error);
      // Extraire le message d'erreur de l'API
      const errorMessage = error?.message || error?.error || "Erreur lors de l'apprentissage";
      if (errorMessage.includes('Crédits') || errorMessage.includes('402')) {
        toast({
          title: "Crédits IA insuffisants",
          description: "Le parsing local sera utilisé à la place",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setIsLearning(false);
    }
  };

  const saveLearnedPatterns = async (patterns: any, rooms: ExtractedRoom[]) => {
    try {
      const user = await supabase.auth.getUser();
      
      // Détecter le type de PMS depuis les patterns ou le texte
      let pmsType = patterns?.pmsType || 'learned';
      
      // Si pas détecté, essayer de le déduire du texte brut
      if (pmsType === 'learned' || pmsType === 'unknown') {
        const textUpper = rawText.toUpperCase();
        if (textUpper.includes('PARTI') && textUpper.includes('EN ARRIVÉE')) {
          pmsType = 'apaleo';
        } else if (textUpper.includes('DIR') && textUpper.includes('INS') && /NIGHT \d+\/\d+/i.test(rawText)) {
          pmsType = 'mews';
        }
      }
      
      console.log(`💾 Sauvegarde pattern: PMS=${pmsType}, Format=${patterns?.roomFormat}, ${rooms.length} chambres`);
      
      // Structurer les données extraites correctement
      const extractedData = {
        rooms: rooms,
        patterns: patterns,
        extractedAt: new Date().toISOString()
      };
      
      // Structurer les detection_rules
      const detectionRules = {
        roomFormat: patterns?.roomFormat || 'XXX',
        statusKeywords: patterns?.statusKeywords || [],
        hasNightInfo: patterns?.hasNightInfo || false,
        pmsType: pmsType
      };
      
      const { error } = await supabase.from('report_training_patterns').insert({
        hotel_id: hotelId,
        assigned_to_hotel_id: hotelId, // Assigner automatiquement à cet hôtel!
        report_name: reportName,
        pms_type: pmsType,
        pattern_name: `Pattern ${pmsType.toUpperCase()} - ${reportName}`,
        raw_text: rawText.substring(0, 2000),
        extracted_data: extractedData as any,
        detection_rules: detectionRules as any,
        validated: true,
        created_by: user.data.user?.id || '',
        accuracy_score: rooms.reduce((acc, r) => acc + r.confidence, 0) / rooms.length,
        attribution_reason: 'Auto-assigné lors de la création'
      });
      
      if (error) {
        console.error('Erreur sauvegarde pattern:', error);
      } else {
        console.log('✅ Pattern sauvegardé et assigné à l\'hôtel');
      }
    } catch (error) {
      console.error('Erreur sauvegarde patterns:', error);
    }
  };

  const applyExistingPattern = async (patternId: string) => {
    const pattern = existingPatterns.find(p => p.id === patternId);
    if (!pattern) return;

    setIsLearning(true);
    setUseExistingPattern(true);

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

      if (data?.extractedRooms?.rooms) {
        setExtractedRooms(data.extractedRooms.rooms);
        onRoomsExtracted(data.extractedRooms.rooms);
        
        toast({
          title: "Pattern appliqué !",
          description: `${data.extractedRooms.rooms.length} chambres extraites`,
        });
      }
    } catch (error) {
      console.error('Erreur application pattern:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'appliquer le pattern existant",
        variant: "destructive"
      });
    } finally {
      setIsLearning(false);
      setUseExistingPattern(false);
    }
  };

  const getCleaningTypeLabel = (type: string) => {
    switch (type) {
      case 'full': return 'À blanc';
      case 'quick': return 'Recouche';
      case 'none': return 'Aucun';
      default: return type;
    }
  };

  const getCleaningTypeBadge = (type: string) => {
    switch (type) {
      case 'full': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'quick': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'none': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Patterns existants */}
      {existingPatterns.length > 0 && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Patterns déjà appris pour cet hôtel</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Vous pouvez réutiliser un pattern existant ou en créer un nouveau
          </p>
          <div className="flex flex-wrap gap-2">
            {existingPatterns.map(pattern => (
              <Button
                key={pattern.id}
                variant="outline"
                size="sm"
                onClick={() => applyExistingPattern(pattern.id)}
                disabled={isLearning}
              >
                {pattern.report_name}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({new Date(pattern.created_at).toLocaleDateString()})
                </span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Apprentissage simplifié
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>1.</strong> Sélectionnez quelques exemples dans le texte ci-dessous<br/>
              <strong>2.</strong> L'IA apprendra le format et extraira TOUTES les chambres automatiquement
            </p>
          </div>

          {/* Sélecteur de type */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Type de donnée à annoter</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fieldLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${fieldColors[value as keyof typeof fieldColors]}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleTextSelection} variant="secondary">
              Annoter la sélection
            </Button>
          </div>

          {/* Annotations actuelles */}
          {annotations.length > 0 && (
            <div className="space-y-2">
              <Label>Vos annotations ({annotations.length})</Label>
              <div className="flex flex-wrap gap-2">
                {annotations.map(annotation => (
                  <Badge
                    key={annotation.id}
                    variant="outline"
                    className={`${fieldColors[annotation.field]} flex items-center gap-2 py-1`}
                  >
                    <span className="text-xs font-medium">
                      {fieldLabels[annotation.field]}: "{annotation.text}"
                    </span>
                    <button
                      onClick={() => removeAnnotation(annotation.id)}
                      className="hover:bg-foreground/10 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bouton d'apprentissage */}
          <Button
            onClick={learnAndExtract}
            disabled={annotations.length < 2 || isLearning}
            className="w-full"
            size="lg"
          >
            {isLearning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Apprentissage en cours...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Apprendre et extraire toutes les chambres
              </>
            )}
          </Button>

          {annotations.length > 0 && annotations.length < 2 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Ajoutez au moins 2 annotations pour commencer
            </p>
          )}
        </div>
      </Card>

      {/* Zone de texte pour annotation */}
      <Card className="p-4">
        <Label className="mb-2 block">Texte du rapport (30 premières lignes)</Label>
        <p className="text-xs text-muted-foreground mb-3">
          Sélectionnez du texte puis cliquez sur "Annoter la sélection"
        </p>
        <div 
          id="simple-annotatable-text"
          className="bg-muted/30 rounded-md p-4 max-h-[400px] overflow-auto font-mono text-sm whitespace-pre-wrap break-words select-text cursor-text"
        >
          {renderAnnotatedText()}
        </div>
        {rawText.split('\n').length > 30 && (
          <p className="text-xs text-muted-foreground mt-2">
            ... et {rawText.split('\n').length - 30} lignes supplémentaires
          </p>
        )}
      </Card>

      {/* Résultats */}
      {extractedRooms.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              {extractedRooms.length} chambres extraites
            </h3>
            <Badge variant="outline">
              Confiance moyenne: {Math.round(extractedRooms.reduce((acc, r) => acc + r.confidence, 0) / extractedRooms.length * 100)}%
            </Badge>
          </div>

          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left p-2">Chambre</th>
                  <th className="text-left p-2">Statut</th>
                  <th className="text-left p-2">Nettoyage</th>
                  <th className="text-left p-2">Client</th>
                  <th className="text-left p-2">Séjour</th>
                  <th className="text-right p-2">Confiance</th>
                </tr>
              </thead>
              <tbody>
                {extractedRooms.map((room, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono font-bold">{room.roomNumber}</td>
                    <td className="p-2">{room.status}</td>
                    <td className="p-2">
                      <Badge className={getCleaningTypeBadge(room.cleaningType)}>
                        {getCleaningTypeLabel(room.cleaningType)}
                      </Badge>
                    </td>
                    <td className="p-2">{room.guestName || '-'}</td>
                    <td className="p-2">{room.nightInfo || '-'}</td>
                    <td className="p-2 text-right">
                      <Progress value={room.confidence * 100} className="w-16 h-2 inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Suggestions d'amélioration</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span>•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Légende */}
      <div className="flex gap-4 text-xs text-muted-foreground items-center flex-wrap">
        {Object.entries(fieldLabels).map(([field, label]) => (
          <div key={field} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${fieldColors[field as keyof typeof fieldColors]}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
