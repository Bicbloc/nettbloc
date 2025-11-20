import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Annotation {
  id: string;
  text: string;
  field: 'roomNumber' | 'status' | 'cleaningType' | 'arrivalDate' | 'departureDate';
  value?: string;
  startIndex: number;
  endIndex: number;
}

interface TextAnnotationToolProps {
  rawText: string;
  hotelId: string;
  reportName: string;
  pmsType: string;
  onPatternsLearned: (patterns: any) => void;
}

export const TextAnnotationTool = ({ 
  rawText, 
  hotelId, 
  reportName, 
  pmsType,
  onPatternsLearned 
}: TextAnnotationToolProps) => {
  const { toast } = useToast();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedField, setSelectedField] = useState<string>('roomNumber');
  const [customValue, setCustomValue] = useState('');
  const [isLearning, setIsLearning] = useState(false);

  const fieldLabels = {
    roomNumber: 'Numéro de chambre',
    status: 'Statut',
    cleaningType: 'Type de nettoyage',
    arrivalDate: 'Date d\'arrivée',
    departureDate: 'Date de départ'
  };

  const fieldColors = {
    roomNumber: 'bg-blue-100 text-blue-800 border-blue-300',
    status: 'bg-green-100 text-green-800 border-green-300',
    cleaningType: 'bg-purple-100 text-purple-800 border-purple-300',
    arrivalDate: 'bg-orange-100 text-orange-800 border-orange-300',
    departureDate: 'bg-red-100 text-red-800 border-red-300'
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Trouver l'index dans le texte brut
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    const textContainer = document.getElementById('annotatable-text');
    
    if (!textContainer || !textContainer.contains(range.startContainer)) return;

    preCaretRange.selectNodeContents(textContainer);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const startIndex = preCaretRange.toString().length;
    const endIndex = startIndex + selectedText.length;

    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      text: selectedText,
      field: selectedField as any,
      value: customValue || selectedText,
      startIndex,
      endIndex
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setCustomValue('');
    selection.removeAllRanges();

    toast({
      title: "Annotation ajoutée",
      description: `${fieldLabels[selectedField as keyof typeof fieldLabels]}: ${selectedText}`,
    });
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const renderAnnotatedText = () => {
    if (annotations.length === 0) {
      return <span>{rawText}</span>;
    }

    // Trier les annotations par position
    const sortedAnnotations = [...annotations].sort((a, b) => a.startIndex - b.startIndex);
    
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedAnnotations.forEach((annotation, idx) => {
      // Texte avant l'annotation
      if (annotation.startIndex > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {rawText.substring(lastIndex, annotation.startIndex)}
          </span>
        );
      }

      // Annotation
      segments.push(
        <mark
          key={`annotation-${annotation.id}`}
          className={`${fieldColors[annotation.field]} px-1 py-0.5 rounded font-semibold cursor-pointer`}
          title={`${fieldLabels[annotation.field]}: ${annotation.value || annotation.text}`}
        >
          {annotation.text}
        </mark>
      );

      lastIndex = annotation.endIndex;
    });

    // Texte restant
    if (lastIndex < rawText.length) {
      segments.push(
        <span key="text-final">{rawText.substring(lastIndex)}</span>
      );
    }

    return segments;
  };

  const learnFromAnnotations = async () => {
    if (annotations.length === 0) {
      toast({
        title: "Aucune annotation",
        description: "Ajoutez au moins une annotation avant d'apprendre",
        variant: "destructive"
      });
      return;
    }

    setIsLearning(true);

    try {
      const { data, error } = await supabase.functions.invoke('learn-pattern', {
        body: {
          textSample: rawText,
          annotations: annotations.map(a => ({
            text: a.text,
            field: a.field,
            value: a.value,
            position: {
              start: a.startIndex,
              end: a.endIndex
            }
          })),
          context: {
            pmsType,
            reportName,
            totalRooms: annotations.filter(a => a.field === 'roomNumber').length
          }
        }
      });

      if (error) throw error;

      if (data?.patterns) {
        toast({
          title: "Apprentissage réussi",
          description: `${data.patterns.patterns?.length || 0} nouveaux patterns appris`,
        });
        
        onPatternsLearned(data.patterns);
        
        // Sauvegarder dans la base de données
        const user = await supabase.auth.getUser();
        const { error: saveError } = await supabase
          .from('report_training_patterns')
          .insert([{
            hotel_id: hotelId,
            report_name: `${reportName} - Apprentissage manuel`,
            pms_type: pmsType,
            raw_text: rawText.substring(0, 1000), // Limiter la taille
            extracted_data: annotations as any,
            validated: true,
            created_by: user.data.user?.id || '',
            detection_rules: data.patterns as any
          }]);

        if (saveError) {
          console.error('Erreur sauvegarde:', saveError);
        }
      }
    } catch (error) {
      console.error('Erreur apprentissage:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'apprentissage",
        variant: "destructive"
      });
    } finally {
      setIsLearning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Mode d'apprentissage interactif</h3>
            <p className="text-sm text-muted-foreground">
              Sélectionnez du texte dans le rapport pour annoter manuellement et apprendre de nouveaux patterns
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Type de donnée</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fieldLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valeur personnalisée (optionnel)</Label>
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Laisser vide pour utiliser le texte sélectionné"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleTextSelection} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Annoter la sélection
              </Button>
            </div>
          </div>

          {annotations.length > 0 && (
            <div className="space-y-2">
              <Label>Annotations ({annotations.length})</Label>
              <div className="flex flex-wrap gap-2">
                {annotations.map(annotation => (
                  <Badge
                    key={annotation.id}
                    variant="outline"
                    className={`${fieldColors[annotation.field]} flex items-center gap-2`}
                  >
                    <span className="text-xs">
                      {fieldLabels[annotation.field]}: {annotation.value || annotation.text}
                    </span>
                    <button
                      onClick={() => removeAnnotation(annotation.id)}
                      className="hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={learnFromAnnotations}
            disabled={annotations.length === 0 || isLearning}
            className="w-full"
            size="lg"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isLearning ? "Apprentissage en cours..." : "Apprendre de ces annotations"}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="bg-muted/30 rounded-md p-4 max-h-[600px] overflow-auto font-mono text-sm whitespace-pre-wrap break-words select-text">
          <div id="annotatable-text">
            {renderAnnotatedText()}
          </div>
        </div>
      </Card>

      <div className="flex gap-2 text-xs text-muted-foreground items-center flex-wrap">
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
