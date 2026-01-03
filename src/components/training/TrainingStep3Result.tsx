import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle, RefreshCw, Play, Sparkles, 
  FileText, Brain, ArrowRight 
} from "lucide-react";
import { TrainingData } from "./TrainingWizard";
import { pmsAdapterFactory, unifiedParserService } from "@/services/pms";
import { CleaningType } from "@/services/pms/types";

interface TrainingStep3ResultProps {
  trainingData: TrainingData;
  hotelId: string;
  onReset: () => void;
}

/**
 * Extrait les mots-clés contextuels d'une ligne de texte
 * Ces mots-clés seront utilisés pour l'apprentissage contextuel
 */
function extractContextKeywords(text: string): string[] {
  const upper = text.toUpperCase();
  const keywords: string[] = [];
  
  // Patterns de départ (→ à blanc)
  if (/\bDEP\b|DÉPART|DEPARTURE|CHECKOUT|C\/O/.test(upper)) {
    keywords.push('DEPART');
  }
  
  // Patterns de dernière nuit (→ à blanc)
  const lastNightMatch = upper.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/);
  if (lastNightMatch && lastNightMatch[1] === lastNightMatch[2]) {
    keywords.push('DERNIERE_NUIT');
  }
  
  // Patterns de nuit intermédiaire (→ recouche)
  if (lastNightMatch && lastNightMatch[1] !== lastNightMatch[2]) {
    keywords.push('NUIT_INTERMEDIAIRE');
  }
  
  // Patterns de stayover (→ recouche)
  if (/\bSTAYOVER|RECOUCHE|STAY|OCC\b/.test(upper)) {
    keywords.push('STAYOVER');
  }
  
  // Patterns de propre (→ none)
  if (/\bPRO\b|PROPRE|CLEAN|READY|INS\b/.test(upper)) {
    keywords.push('PROPRE');
  }
  
  // Patterns de sale (à analyser selon contexte)
  if (/\bSAL\b|SALE|DIRTY|DIR\b/.test(upper)) {
    keywords.push('SALE');
  }
  
  // Patterns d'arrivée
  if (/\bARR\b|ARRIVÉE|ARRIVAL|CHECKIN|C\/I/.test(upper)) {
    keywords.push('ARRIVEE');
  }
  
  return keywords;
}

/**
 * Construit les patterns contextuels à partir des chambres validées
 * Associe les mots-clés aux types de nettoyage
 */
function buildContextPatterns(rooms: any[]): { [keyword: string]: CleaningType } {
  const patterns: { [keyword: string]: { count: number; cleaningType: CleaningType } } = {};
  
  for (const room of rooms) {
    const keywords = room.contextKeywords || [];
    const cleaningType = room.cleaningType as CleaningType;
    
    for (const keyword of keywords) {
      if (!patterns[keyword]) {
        patterns[keyword] = { count: 0, cleaningType };
      }
      
      // Si le même mot-clé est associé au même cleaningType, renforcer
      if (patterns[keyword].cleaningType === cleaningType) {
        patterns[keyword].count++;
      } else {
        // Conflit: garder le plus fréquent
        patterns[keyword].count--;
        if (patterns[keyword].count < 0) {
          patterns[keyword] = { count: 1, cleaningType };
        }
      }
    }
  }
  
  // Convertir en format simple keyword → cleaningType
  const result: { [keyword: string]: CleaningType } = {};
  for (const [keyword, data] of Object.entries(patterns)) {
    result[keyword] = data.cleaningType;
  }
  
  return result;
}

export const TrainingStep3Result = ({
  trainingData,
  hotelId,
  onReset,
}: TrainingStep3ResultProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const validatedRooms = trainingData.extractedRooms.filter((r) => r.validated);
  const accuracy = Math.round((validatedRooms.length / trainingData.extractedRooms.length) * 100);

  const isUpdate = !!trainingData.existingPatternId;

  const saveTraining = async () => {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erreur", description: "Vous devez être connecté", variant: "destructive" });
        return;
      }

      // IMPORTANT: Ne sauvegarder QUE les chambres validées (validated: true)
      // Les chambres non validées ne doivent JAMAIS apparaître dans l'analyse
      // NOUVEAU: Extraire les mots-clés contextuels pour un apprentissage intelligent
      const roomsToSave = validatedRooms.map(r => {
        const contextKeywords = extractContextKeywords(r.originalText || '');
        return {
          ...r,
          validated: true, // S'assurer que le flag est bien présent
          contextKeywords, // Mots-clés détectés dans le contexte
          isPermanentRule: (r as any).isPermanentRule || false, // Si c'est une règle permanente (pas contextuelle)
        };
      });

      // Construire les patterns contextuels globaux
      const contextPatterns = buildContextPatterns(roomsToSave);

      const patternData = {
        hotel_id: hotelId,
        report_name: trainingData.reportName,
        pms_type: trainingData.detectedPmsType,
        raw_text: trainingData.rawText.substring(0, 10000), // Limit size
        extracted_data: roomsToSave as any,
        validated: true,
        created_by: user.id,
        updated_at: new Date().toISOString(),
        detection_rules: {
          connected_rooms: validatedRooms
            .filter((r) => r.isConnected)
            .map((r) => ({ pattern: r.roomNumber, rooms: r.linkedRooms })),
          contextPatterns, // NOUVEAU: Patterns contextuels appris
        },
      };

      let error;

      if (isUpdate && trainingData.existingPatternId) {
        // Update existing pattern
        const result = await supabase
          .from("report_training_patterns")
          .update(patternData)
          .eq("id", trainingData.existingPatternId);
        error = result.error;
      } else {
        // Insert new pattern
        const result = await supabase
          .from("report_training_patterns")
          .insert([patternData]);
        error = result.error;
      }

      if (error) throw error;

      await unifiedParserService.loadHotelPatterns(hotelId);
      setSaved(true);
      toast({ 
        title: isUpdate ? "Entraînement mis à jour" : "Entraînement sauvegardé", 
        description: "L'IA a appris de ce rapport" 
      });
    } catch (error) {
      console.error("Erreur:", error);
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testExtraction = () => {
    if (!testText.trim()) {
      toast({ title: "Collez un extrait de rapport", variant: "destructive" });
      return;
    }

    setTesting(true);

    try {
      const detection = pmsAdapterFactory.detectPms(testText);
      const rooms = detection.adapter.extractRooms(testText);

      setTestResult({
        pmsType: detection.detection.pmsType,
        confidence: detection.detection.confidence,
        roomsFound: rooms.length,
        rooms: rooms.slice(0, 10), // Show max 10
      });

      toast({
        title: `${rooms.length} chambres détectées`,
        description: `PMS: ${detection.detection.pmsType.toUpperCase()}`,
      });
    } catch (error) {
      toast({ title: "Erreur lors du test", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Card */}
      <Card className="p-6 border-green-500/50 bg-green-500/5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-green-500/20">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold mb-1">
              {isUpdate ? "Mise à jour terminée !" : "Entraînement terminé !"}
            </h3>
            <p className="text-muted-foreground">
              {validatedRooms.length} chambres validées à partir de "{trainingData.reportName}"
              {isUpdate && " (mise à jour)"}
            </p>
            
            <div className="flex flex-wrap gap-3 mt-4">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="w-3 h-3" />
                PMS: {trainingData.detectedPmsType.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Brain className="w-3 h-3" />
                Précision: {accuracy}%
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileText className="w-3 h-3" />
                {validatedRooms.length} chambres
              </Badge>
            </div>
          </div>
        </div>

        {!saved && (
          <div className="mt-6 pt-4 border-t">
            <Button onClick={saveTraining} disabled={saving} className="w-full gap-2">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Sauvegarde...
                </>
              ) : (
              <>
                <Brain className="w-4 h-4" />
                {isUpdate ? "Mettre à jour l'entraînement" : "Sauvegarder l'entraînement"}
              </>
              )}
            </Button>
          </div>
        )}

        {saved && (
          <div className="mt-6 pt-4 border-t flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Entraînement sauvegardé avec succès</span>
          </div>
        )}
      </Card>

      {/* Test Zone */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Play className="w-4 h-4" />
          Tester l'extraction
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          Collez un extrait de rapport pour vérifier que l'IA le reconnaît correctement.
        </p>

        <Textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Collez un extrait de rapport ici..."
          className="min-h-[100px] mb-4 font-mono text-sm"
        />

        <Button onClick={testExtraction} disabled={testing} variant="outline" className="w-full gap-2">
          {testing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
              Test en cours...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Lancer le test
            </>
          )}
        </Button>

        {testResult && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">PMS détecté:</span>
              <Badge>{testResult.pmsType.toUpperCase()}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Confiance:</span>
              <Badge variant="secondary">{Math.round(testResult.confidence * 100)}%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Chambres trouvées:</span>
              <Badge variant="outline">{testResult.roomsFound}</Badge>
            </div>
            {testResult.rooms.length > 0 && (
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground">Aperçu:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {testResult.rooms.map((r: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {r.roomNumber} ({r.cleaningType})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Nouvel entraînement
        </Button>
        <Button variant="ghost" onClick={onReset} className="gap-2">
          Retour au tableau de bord
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
