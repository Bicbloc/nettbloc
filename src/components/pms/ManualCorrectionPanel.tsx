import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Brain, X, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExtractedRoom, CleaningType } from "@/services/pms";

interface Annotation {
  id: string;
  text: string;
  field: 'roomNumber' | 'status' | 'cleaningType';
  startIndex: number;
  endIndex: number;
}

interface ManualCorrectionPanelProps {
  rawText: string;
  hotelId: string;
  existingRooms: ExtractedRoom[];
  onRoomsUpdated: (rooms: ExtractedRoom[]) => void;
  onClose: () => void;
}

export const ManualCorrectionPanel = ({
  rawText,
  hotelId,
  existingRooms,
  onRoomsUpdated,
  onClose
}: ManualCorrectionPanelProps) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedField, setSelectedField] = useState<'roomNumber' | 'status' | 'cleaningType'>('roomNumber');
  const [isLearning, setIsLearning] = useState(false);

  const fieldLabels = {
    roomNumber: 'Numéro chambre',
    status: 'Statut',
    cleaningType: 'Type nettoyage'
  };

  const fieldColors = {
    roomNumber: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300',
    status: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
    cleaningType: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300'
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const textContainer = document.getElementById('correction-text-container');
    
    if (!textContainer || !textContainer.contains(range.startContainer)) return;

    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(textContainer);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const startIndex = preCaretRange.toString().length;
    const endIndex = startIndex + selectedText.length;

    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      text: selectedText,
      field: selectedField,
      startIndex,
      endIndex
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    selection.removeAllRanges();
    toast.success(`Annoté: ${selectedText} comme ${fieldLabels[selectedField]}`);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  // Augmenté de 40 à 200 lignes pour capturer plus de chambres
  const MAX_PREVIEW_LINES = 200;
  
  const renderAnnotatedText = () => {
    const previewText = rawText.split('\n').slice(0, MAX_PREVIEW_LINES).join('\n');
    
    if (annotations.length === 0) {
      return <span className="whitespace-pre-wrap">{previewText}</span>;
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
          className={`${fieldColors[annotation.field]} px-1 rounded font-semibold`}
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

    return <span className="whitespace-pre-wrap">{segments}</span>;
  };

  const handleLearnFromAnnotations = async () => {
    if (annotations.length < 2) {
      toast.error('Annotez au moins 2 éléments (ex: 1 numéro + 1 statut)');
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
            position: { start: a.startIndex, end: a.endIndex }
          })),
          context: {
            hotelId,
            reportName: 'Correction manuelle',
            pmsType: 'unknown'
          },
          mode: 'learn'
        }
      });

      if (error) throw error;

      if (data?.rooms && data.rooms.length > 0) {
        // Vérifier les chambres manquantes par rapport aux annotations
        const annotatedRoomNumbers = annotations
          .filter(a => a.field === 'roomNumber')
          .map(a => a.text.trim().replace(/^0+/, ''));
        
        const extractedRoomNumbers = data.rooms.map((r: ExtractedRoom) => 
          r.roomNumber.replace(/^0+/, '')
        );
        
        const missingRooms = annotatedRoomNumbers.filter(
          room => !extractedRoomNumbers.includes(room) && 
                  !extractedRoomNumbers.some(e => e === room || room === e)
        );
        
        if (missingRooms.length > 0) {
          toast.warning(`⚠️ ${missingRooms.length} chambre(s) annotée(s) non trouvée(s): ${missingRooms.join(', ')}`);
        }
        
        onRoomsUpdated(data.rooms);
        
        // Sauvegarder le pattern appris
        const user = await supabase.auth.getUser();
        await supabase.from('report_training_patterns').insert({
          hotel_id: hotelId,
          assigned_to_hotel_id: hotelId,
          report_name: 'Correction manuelle',
          pms_type: data.patterns?.pmsType || 'learned',
          pattern_name: `Correction manuelle - ${new Date().toLocaleDateString()}`,
          raw_text: rawText.substring(0, 5000), // Augmenté de 2000 à 5000
          extracted_data: { rooms: data.rooms, patterns: data.patterns },
          detection_rules: data.patterns || {},
          validated: true,
          created_by: user.data.user?.id || '',
          attribution_reason: 'Correction manuelle'
        });

        toast.success(`${data.rooms.length} chambres extraites avec les corrections!`);
        onClose();
      } else {
        toast.error('Aucune chambre trouvée. Essayez d\'ajouter plus d\'annotations.');
      }
    } catch (error: any) {
      console.error('Erreur apprentissage:', error);
      // Extraire le message d'erreur de l'API
      const errorMessage = error?.message || error?.error || 'Erreur lors de l\'apprentissage';
      if (errorMessage.includes('Crédits') || errorMessage.includes('402')) {
        toast.error('Crédits IA insuffisants. Le parsing local sera utilisé.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLearning(false);
    }
  };

  return (
    <Card className="p-4 border-primary/50 bg-primary/5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Correction Manuelle</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Sélectionnez du texte ci-dessous et annotez les éléments corrects. L'IA apprendra de vos corrections.
        </p>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]">
            <Label>Type de donnée</Label>
            <Select value={selectedField} onValueChange={(v: any) => setSelectedField(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roomNumber">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    Numéro chambre
                  </div>
                </SelectItem>
                <SelectItem value="status">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500" />
                    Statut
                  </div>
                </SelectItem>
                <SelectItem value="cleaningType">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-purple-500" />
                    Type nettoyage
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" size="sm" onClick={handleTextSelection}>
            <Plus className="h-4 w-4 mr-1" />
            Annoter la sélection
          </Button>
        </div>

        {annotations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {annotations.map(a => (
              <Badge
                key={a.id}
                variant="outline"
                className={`${fieldColors[a.field]} flex items-center gap-1`}
              >
                {a.text}
                <button onClick={() => removeAnnotation(a.id)} className="hover:bg-foreground/10 rounded p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div
          id="correction-text-container"
          className="p-3 bg-muted/50 rounded-lg font-mono text-sm max-h-[250px] overflow-auto border cursor-text"
          onMouseUp={handleTextSelection}
        >
          {renderAnnotatedText()}
        </div>

        <Button
          onClick={handleLearnFromAnnotations}
          disabled={annotations.length < 2 || isLearning}
          className="w-full"
        >
          {isLearning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Apprentissage en cours...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Apprendre de mes corrections ({annotations.length} annotations)
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
