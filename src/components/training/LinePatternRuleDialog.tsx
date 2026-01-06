import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Check, X, Eye, Sparkles, Save, AlertTriangle } from "lucide-react";
import { ExtractedRoom } from "@/services/pms";

interface LinePatternRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: ExtractedRoom;
  allRooms: ExtractedRoom[];
  hotelId: string;
  onRuleCreated: (updatedRooms: ExtractedRoom[]) => void;
}

// Patterns détectables dans une ligne
interface DetectedPattern {
  id: string;
  label: string;
  description: string;
  detected: boolean;
  value?: string;
}

// Règle de nettoyage par exemple
export interface LineExampleRule {
  id: string;
  name: string;
  description: string;
  patterns: {
    hasNightInfo: boolean;
    isLastNight: boolean;
    hasArrivalTime: boolean;
    hasDepartureTime: boolean;
    hasKeywords: string[];
    ignoreKeywords: string[];
  };
  resultCleaningType: 'a_blanc' | 'recouche' | 'none';
  hotelId: string;
  createdAt: string;
}

// Analyse une ligne pour détecter les patterns
const analyzeLinePatterns = (originalText: string): DetectedPattern[] => {
  const text = originalText?.toUpperCase() || '';
  const patterns: DetectedPattern[] = [];

  // Nuit X/Y
  const nightMatch = text.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/i);
  if (nightMatch) {
    const current = parseInt(nightMatch[1]);
    const total = parseInt(nightMatch[2]);
    patterns.push({
      id: 'has_night_info',
      label: `Nuit ${current}/${total}`,
      description: `Client en séjour, nuit ${current} sur ${total}`,
      detected: true,
      value: `${current}/${total}`,
    });
    if (current === total) {
      patterns.push({
        id: 'is_last_night',
        label: 'Dernière nuit',
        description: 'C\'est la dernière nuit du séjour → À blanc',
        detected: true,
      });
    }
  }

  // Heure de départ (C/O)
  const depMatch = text.match(/(?:C\/O|CHECK.?OUT|DEP(?:ART)?)\s*:?\s*(\d{1,2}[h:]\d{2})/i) ||
                   text.match(/(\d{1,2}[h:]\d{2})\s*(?:C\/O|DEP)/i);
  if (depMatch) {
    patterns.push({
      id: 'has_departure_time',
      label: `Départ ${depMatch[1]}`,
      description: 'Heure de départ détectée → À blanc',
      detected: true,
      value: depMatch[1],
    });
  }

  // Heure d'arrivée (C/I)
  const arrMatch = text.match(/(?:C\/I|CHECK.?IN|ARR(?:IVÉE)?)\s*:?\s*(\d{1,2}[h:]\d{2})/i) ||
                   text.match(/(\d{1,2}[h:]\d{2})\s*(?:C\/I|ARR)/i);
  if (arrMatch) {
    patterns.push({
      id: 'has_arrival_time',
      label: `Arrivée ${arrMatch[1]}`,
      description: 'Heure d\'arrivée détectée',
      detected: true,
      value: arrMatch[1],
    });
  }

  // Mots-clés statut
  const keywords = [
    { pattern: /\bSAL\b/i, id: 'kw_sal', label: 'SAL', desc: 'Chambre sale' },
    { pattern: /\bPRO\b/i, id: 'kw_pro', label: 'PRO', desc: 'Chambre propre' },
    { pattern: /\bINS\b/i, id: 'kw_ins', label: 'INS', desc: 'Chambre inspectée' },
    { pattern: /\bDIR\b/i, id: 'kw_dir', label: 'DIR', desc: 'Chambre sale (dirty)' },
    { pattern: /\bCLA\b/i, id: 'kw_cla', label: 'CLA', desc: 'Chambre en cours' },
    { pattern: /\bBLC\b/i, id: 'kw_blc', label: 'BLC', desc: 'Bloc/Building' },
    { pattern: /\bOCC\b/i, id: 'kw_occ', label: 'OCC', desc: 'Chambre occupée' },
    { pattern: /\bVAC\b/i, id: 'kw_vac', label: 'VAC', desc: 'Chambre vacante' },
    { pattern: /\bDEP\b/i, id: 'kw_dep', label: 'DEP', desc: 'Départ' },
    { pattern: /\bARR\b/i, id: 'kw_arr', label: 'ARR', desc: 'Arrivée' },
  ];

  keywords.forEach(kw => {
    if (kw.pattern.test(text)) {
      patterns.push({
        id: kw.id,
        label: kw.label,
        description: kw.desc,
        detected: true,
      });
    }
  });

  return patterns;
};

// Trouve les chambres avec des patterns similaires
const findSimilarRooms = (
  targetRoom: ExtractedRoom,
  allRooms: ExtractedRoom[],
  selectedPatterns: Set<string>
): ExtractedRoom[] => {
  if (selectedPatterns.size === 0) return [];

  const targetText = targetRoom.originalText?.toUpperCase() || '';

  return allRooms.filter(room => {
    if (room.roomNumber === targetRoom.roomNumber) return false;
    
    const roomText = room.originalText?.toUpperCase() || '';
    let matches = true;

    selectedPatterns.forEach(patternId => {
      if (patternId === 'is_last_night') {
        const nightMatch = roomText.match(/NUIT\s*(\d+)\s*[\/\\]\s*(\d+)/i);
        if (!nightMatch || parseInt(nightMatch[1]) !== parseInt(nightMatch[2])) {
          matches = false;
        }
      } else if (patternId === 'has_night_info') {
        if (!/NUIT\s*\d+\s*[\/\\]\s*\d+/i.test(roomText)) {
          matches = false;
        }
      } else if (patternId === 'has_departure_time') {
        if (!/(?:C\/O|DEP|CHECK.?OUT)\s*:?\s*\d{1,2}[h:]\d{2}/i.test(roomText) &&
            !/\d{1,2}[h:]\d{2}\s*(?:C\/O|DEP)/i.test(roomText)) {
          matches = false;
        }
      } else if (patternId === 'has_arrival_time') {
        if (!/(?:C\/I|ARR|CHECK.?IN)\s*:?\s*\d{1,2}[h:]\d{2}/i.test(roomText) &&
            !/\d{1,2}[h:]\d{2}\s*(?:C\/I|ARR)/i.test(roomText)) {
          matches = false;
        }
      } else if (patternId.startsWith('kw_')) {
        const keyword = patternId.replace('kw_', '').toUpperCase();
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (!regex.test(roomText)) {
          matches = false;
        }
      }
    });

    return matches;
  });
};

export const LinePatternRuleDialog = ({
  open,
  onOpenChange,
  room,
  allRooms,
  hotelId,
  onRuleCreated,
}: LinePatternRuleDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());
  const [targetCleaningType, setTargetCleaningType] = useState<'a_blanc' | 'recouche' | 'none'>(
    room.cleaningType === 'full' ? 'a_blanc' : room.cleaningType === 'quick' ? 'recouche' : room.cleaningType as any
  );

  // Analyser les patterns de la ligne
  const detectedPatterns = useMemo(() => analyzeLinePatterns(room.originalText || ''), [room.originalText]);

  // Trouver les chambres similaires
  const similarRooms = useMemo(
    () => findSimilarRooms(room, allRooms, selectedPatterns),
    [room, allRooms, selectedPatterns]
  );

  const togglePattern = (patternId: string) => {
    const newSet = new Set(selectedPatterns);
    if (newSet.has(patternId)) {
      newSet.delete(patternId);
    } else {
      newSet.add(patternId);
    }
    setSelectedPatterns(newSet);
  };

  const handleApplyRule = async () => {
    if (selectedPatterns.size === 0) {
      toast({ title: "Sélectionnez au moins un pattern", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      // Appliquer le type de nettoyage aux chambres similaires
      const updatedRooms = allRooms.map(r => {
        const isSimilar = similarRooms.some(sr => sr.roomNumber === r.roomNumber);
        const isTarget = r.roomNumber === room.roomNumber;
        
        if (isSimilar || isTarget) {
          let cleaningType: 'full' | 'quick' | 'none' | 'a_blanc' | 'recouche' = 
            targetCleaningType === 'a_blanc' ? 'full' : 
            targetCleaningType === 'recouche' ? 'quick' : 'none';
          
          return {
            ...r,
            cleaningType,
            validated: true,
          };
        }
        return r;
      });

      // Sauvegarder la règle en base si un nom est fourni
      if (ruleName.trim()) {
        const ruleData = {
          hotel_id: hotelId,
          rule_name: ruleName.trim(),
          rule_type: 'line_example',
          condition: {
            patterns: Array.from(selectedPatterns),
            exampleLine: room.originalText,
          },
          result: {
            cleaningType: targetCleaningType,
          },
          is_active: true,
          priority: 100,
          created_by: (await supabase.auth.getUser()).data.user?.id || 'unknown',
        };

        await supabase.from('hotel_detection_rules').insert(ruleData);
      }

      onRuleCreated(updatedRooms);
      
      toast({
        title: "Règle appliquée",
        description: `${similarRooms.length + 1} chambre(s) mises à jour`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error applying rule:', error);
      toast({ title: "Erreur lors de l'application", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cleaningTypeLabels = {
    'a_blanc': { label: 'À blanc', color: 'bg-orange-500', desc: 'Nettoyage complet (départ)' },
    'recouche': { label: 'Recouche', color: 'bg-blue-500', desc: 'Nettoyage rapide (séjour)' },
    'none': { label: 'Aucun', color: 'bg-gray-400', desc: 'Pas de nettoyage' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Créer une règle depuis cet exemple
          </DialogTitle>
          <DialogDescription>
            Définissez une règle basée sur cette ligne pour l'appliquer automatiquement aux lignes similaires.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Ligne exemple */}
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">Chambre {room.roomNumber}</Badge>
                <Badge className={cleaningTypeLabels[targetCleaningType].color}>
                  {cleaningTypeLabels[targetCleaningType].label}
                </Badge>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap bg-background/50 p-2 rounded">
                {room.originalText || 'Ligne originale non disponible'}
              </pre>
            </Card>

            {/* Type de nettoyage résultant */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type de nettoyage à appliquer</Label>
              <div className="flex gap-2">
                {Object.entries(cleaningTypeLabels).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={targetCleaningType === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetCleaningType(key as any)}
                    className="flex-1"
                  >
                    <span className={`w-2 h-2 rounded-full mr-2 ${config.color}`} />
                    {config.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {cleaningTypeLabels[targetCleaningType].desc}
              </p>
            </div>

            <Separator />

            {/* Patterns détectés */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Critères détectés dans cette ligne
                </Label>
                <span className="text-xs text-muted-foreground">
                  {selectedPatterns.size} sélectionné(s)
                </span>
              </div>

              {detectedPatterns.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun pattern détectable dans cette ligne</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {detectedPatterns.map(pattern => (
                    <div
                      key={pattern.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPatterns.has(pattern.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => togglePattern(pattern.id)}
                    >
                      <Checkbox
                        checked={selectedPatterns.has(pattern.id)}
                        onCheckedChange={() => togglePattern(pattern.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {pattern.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pattern.description}
                        </p>
                      </div>
                      {selectedPatterns.has(pattern.id) && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Aperçu des chambres qui matchent */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Chambres correspondantes
                </Label>
                <Badge variant="outline">
                  {similarRooms.length + 1} chambre(s)
                </Badge>
              </div>

              {selectedPatterns.size === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Sélectionnez des critères pour voir les chambres correspondantes
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  <Badge className="bg-primary">{room.roomNumber}</Badge>
                  {similarRooms.map(r => (
                    <Badge key={r.roomNumber} variant="secondary">
                      {r.roomNumber}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Nom de la règle (optionnel) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Nom de la règle (optionnel)
              </Label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Ex: Dernière nuit = À blanc"
              />
              <p className="text-xs text-muted-foreground">
                Si vous donnez un nom, la règle sera sauvegardée pour les prochains imports.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleApplyRule}
            disabled={saving || selectedPatterns.size === 0}
            className="gap-2"
          >
            {saving ? (
              <>Enregistrement...</>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Appliquer à {similarRooms.length + 1} chambre(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
