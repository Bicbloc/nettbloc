import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, Upload, CheckCircle, FileText, Zap, 
  Save, ArrowLeft, ArrowRight, Trash2, Eye, 
  Check, RotateCcw, Loader2, X
} from "lucide-react";
import { processPdf, getLastParsedLines } from "@/services/pdfService";
import { ExtractedRoom, normalizeCleaningType } from "@/services/pms/types";
import { cn } from "@/lib/utils";

interface TrainingWizardProps {
  hotelId: string;
}

// Types de nettoyage
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc', emoji: '🔶', color: 'bg-orange-500', bgLight: 'bg-orange-100 dark:bg-orange-900/30' },
  { value: 'recouche', label: 'Recouche', emoji: '🔄', color: 'bg-green-500', bgLight: 'bg-green-100 dark:bg-green-900/30' },
  { value: 'none', label: 'Aucun', emoji: '⏸️', color: 'bg-gray-500', bgLight: 'bg-gray-100 dark:bg-gray-900/30' },
] as const;

type CleaningType = typeof CLEANING_TYPES[number]['value'];

interface PatternGroup {
  id: string;
  signature: string;
  keywords: string[];
  lines: Array<{ text: string; roomNumber: string | null; }>;
  cleaningType: CleaningType | null;
}

// Mots-clés pour auto-détection
const AUTO_KEYWORDS: Record<string, CleaningType> = {
  'DÉPART': 'a_blanc', 'DEPART': 'a_blanc', 'CHECKOUT': 'a_blanc', 'CHECK-OUT': 'a_blanc',
  'DEP': 'a_blanc', 'SAL': 'a_blanc', 'DIRTY': 'a_blanc', 'LIBRE': 'a_blanc', 'VACANT': 'a_blanc',
  'À BLANC': 'a_blanc', 'A BLANC': 'a_blanc', 'DUE OUT': 'a_blanc',
  'SÉJOUR': 'recouche', 'SEJOUR': 'recouche', 'RECOUCHE': 'recouche', 'STAYOVER': 'recouche',
  'OCCUPÉ': 'recouche', 'OCCUPE': 'recouche', 'OCC': 'recouche', 'PRO': 'recouche', 'INS': 'recouche',
  'PROLONGATION': 'recouche', 'ARR': 'recouche',
  'DND': 'none', 'NE PAS DÉRANGER': 'none', 'PROPRE': 'none', 'CLEAN': 'none',
};

export const TrainingWizard = ({ hotelId }: TrainingWizardProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  // Data
  const [rawText, setRawText] = useState('');
  const [patternGroups, setPatternGroups] = useState<PatternGroup[]>([]);
  const [savedPatterns, setSavedPatterns] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Charger les patterns existants
  useEffect(() => {
    const loadPatterns = async () => {
      const { data } = await supabase
        .from('hotel_detection_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data) setSavedPatterns(data);
    };
    loadPatterns();
  }, [hotelId, refreshKey]);

  // Extraire signature d'une ligne
  const extractSignature = useCallback((text: string): { signature: string; keywords: string[] } => {
    const upper = text.toUpperCase().trim();
    const keywords: string[] = [];
    
    let sig = upper
      .replace(/\b\d{2,4}[A-Z]?\b/g, '{R}')
      .replace(/\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?/g, '{D}')
      .replace(/\d{1,2}[hH:]\d{2}/g, '{T}')
      .replace(/\s+/g, ' ').trim();
    
    for (const kw of Object.keys(AUTO_KEYWORDS)) {
      if (upper.includes(kw)) keywords.push(kw);
    }
    
    return { signature: sig, keywords };
  }, []);

  // Traiter le fichier PDF
  const handleFileUpload = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      toast({ title: "Fichier invalide", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setProgressText('Lecture du PDF...');

    try {
      setProgress(30);
      setProgressText('Analyse IA...');
      
      await processPdf(file, hotelId);
      const lines = getLastParsedLines();
      
      setProgress(60);
      setProgressText('Groupement des patterns...');
      
      // Construire le texte brut
      const fullText = lines.map(l => l.fullText || '').join('\n');
      setRawText(fullText);
      
      // Grouper par signature
      const groups: Map<string, PatternGroup> = new Map();
      const roomPattern = /\b(\d{2,4}[A-Z]?)\b/;
      
      for (const line of lines) {
        const text = line.fullText || '';
        if (text.length < 3) continue;
        
        const { signature, keywords } = extractSignature(text);
        const roomMatch = text.match(roomPattern);
        const roomNum = roomMatch?.[1] || null;
        
        if (groups.has(signature)) {
          groups.get(signature)!.lines.push({ text, roomNumber: roomNum });
        } else {
          // Auto-détecter le type
          let autoType: CleaningType | null = null;
          for (const kw of keywords) {
            if (AUTO_KEYWORDS[kw]) {
              autoType = AUTO_KEYWORDS[kw];
              break;
            }
          }
          
          groups.set(signature, {
            id: `g-${groups.size}`,
            signature,
            keywords,
            lines: [{ text, roomNumber: roomNum }],
            cleaningType: autoType,
          });
        }
      }
      
      // Filtrer et trier
      const filtered = Array.from(groups.values())
        .filter(g => g.lines.some(l => l.roomNumber))
        .sort((a, b) => b.lines.length - a.lines.length);
      
      setPatternGroups(filtered);
      setProgress(100);
      setStep('review');
      
    } catch (error) {
      console.error('Erreur:', error);
      toast({ title: "Erreur d'analyse", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Assigner type à un groupe
  const assignType = useCallback((groupId: string, type: CleaningType) => {
    setPatternGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, cleaningType: g.cleaningType === type ? null : type } : g
    ));
  }, []);

  // Auto-mapper tous
  const autoMapAll = useCallback(() => {
    setPatternGroups(prev => prev.map(g => {
      if (g.cleaningType) return g;
      for (const kw of g.keywords) {
        if (AUTO_KEYWORDS[kw]) return { ...g, cleaningType: AUTO_KEYWORDS[kw] };
      }
      return g;
    }));
    toast({ title: "Auto-mapping appliqué" });
  }, [toast]);

  // Stats
  const stats = useMemo(() => {
    const rooms = patternGroups.flatMap(g => g.lines.filter(l => l.roomNumber));
    const mapped = patternGroups.filter(g => g.cleaningType);
    const aBlanc = patternGroups.filter(g => g.cleaningType === 'a_blanc').flatMap(g => g.lines.filter(l => l.roomNumber)).length;
    const recouche = patternGroups.filter(g => g.cleaningType === 'recouche').flatMap(g => g.lines.filter(l => l.roomNumber)).length;
    
    return { 
      total: rooms.length, 
      groups: patternGroups.length,
      mapped: mapped.length,
      aBlanc, 
      recouche,
      unmapped: rooms.length - aBlanc - recouche
    };
  }, [patternGroups]);

  // Sauvegarder les règles
  const saveRules = async () => {
    setIsProcessing(true);
    setProgressText('Sauvegarde...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Créer les règles pour chaque groupe mappé
      for (const group of patternGroups.filter(g => g.cleaningType)) {
        for (const kw of group.keywords) {
          await supabase.from('hotel_detection_rules').upsert({
            hotel_id: hotelId,
            created_by: user.id,
            rule_name: `Auto: ${kw} → ${group.cleaningType}`,
            rule_type: 'keyword_to_cleaning',
            condition: { keyword: kw, contains: true },
            result: { cleaningType: group.cleaningType },
            priority: 10,
            is_active: true,
          }, { onConflict: 'hotel_id,rule_name' });
        }
      }

      toast({ title: "✅ Règles sauvegardées", description: "L'IA utilisera ces règles pour les prochains imports." });
      setStep('done');
      setRefreshKey(k => k + 1);
      
    } catch (error) {
      console.error('Erreur:', error);
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Supprimer une règle
  const deleteRule = async (ruleId: string) => {
    await supabase.from('hotel_detection_rules').delete().eq('id', ruleId);
    setRefreshKey(k => k + 1);
    toast({ title: "Règle supprimée" });
  };

  // Reset
  const reset = () => {
    setStep('upload');
    setRawText('');
    setPatternGroups([]);
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Entraînement IA</h2>
            <p className="text-sm text-muted-foreground">
              Importez un rapport pour apprendre automatiquement les patterns
            </p>
          </div>
        </div>
      </Card>

      {/* Règles existantes */}
      {savedPatterns.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            {savedPatterns.length} règle(s) active(s)
          </h3>
          <div className="flex flex-wrap gap-2">
            {savedPatterns.slice(0, 10).map(rule => (
              <Badge key={rule.id} variant="secondary" className="gap-1">
                {rule.rule_name}
                <button onClick={() => deleteRule(rule.id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {savedPatterns.length > 10 && (
              <Badge variant="outline">+{savedPatterns.length - 10} autres</Badge>
            )}
          </div>
        </Card>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card className="p-6">
          {isProcessing ? (
            <div className="space-y-4 text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">{progressText}</p>
              <Progress value={progress} className="max-w-xs mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById('training-file')?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Glissez un rapport PDF ici</p>
                <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
                <input 
                  id="training-file" 
                  type="file" 
                  accept=".pdf" 
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </div>
              
              <Alert>
                <AlertDescription>
                  L'IA analysera votre rapport et apprendra automatiquement à reconnaître 
                  les types de ménage (à blanc, recouche, etc.) pour les prochains imports.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </Card>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <Card className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="p-2 text-center bg-muted rounded-lg">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Chambres</p>
            </div>
            <div className="p-2 text-center bg-muted rounded-lg">
              <p className="text-2xl font-bold">{stats.mapped}/{stats.groups}</p>
              <p className="text-xs text-muted-foreground">Groupes</p>
            </div>
            <div className="p-2 text-center bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{stats.aBlanc}</p>
              <p className="text-xs text-orange-600">À blanc</p>
            </div>
            <div className="p-2 text-center bg-green-100 dark:bg-green-900/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.recouche}</p>
              <p className="text-xs text-green-600">Recouche</p>
            </div>
            <div className="p-2 text-center bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{stats.unmapped}</p>
              <p className="text-xs text-yellow-600">À mapper</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" onClick={autoMapAll} className="gap-1">
              <Zap className="h-4 w-4" /> Auto-mapper
            </Button>
            <Button size="sm" variant="outline" onClick={reset} className="gap-1">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </div>

          {/* Pattern groups */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-2">
              {patternGroups.map(group => {
                const roomCount = group.lines.filter(l => l.roomNumber).length;
                const config = CLEANING_TYPES.find(t => t.value === group.cleaningType);
                
                return (
                  <div 
                    key={group.id} 
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      config?.bgLight,
                      !group.cleaningType && "border-dashed border-yellow-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Type buttons */}
                      <div className="flex gap-1">
                        {CLEANING_TYPES.map(t => (
                          <button
                            key={t.value}
                            onClick={() => assignType(group.id, t.value)}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                              group.cleaningType === t.value 
                                ? `${t.color} text-white ring-2 ring-offset-2`
                                : "bg-muted hover:opacity-80"
                            )}
                            title={t.label}
                          >
                            {group.cleaningType === t.value ? <Check className="h-4 w-4" /> : t.emoji}
                          </button>
                        ))}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{roomCount} ch.</Badge>
                          {group.keywords.slice(0, 2).map(kw => (
                            <Badge key={kw} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {group.lines[0]?.text.substring(0, 60)}...
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Navigation */}
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" onClick={reset}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Annuler
            </Button>
            <Button 
              onClick={saveRules} 
              disabled={stats.mapped === 0 || isProcessing}
              className="gap-1"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sauvegarder les règles
            </Button>
          </div>
        </Card>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Entraînement terminé !</h3>
          <p className="text-muted-foreground mb-6">
            L'IA appliquera automatiquement ces règles lors des prochains imports PDF.
          </p>
          <Button onClick={reset}>
            <Upload className="h-4 w-4 mr-2" /> Entraîner avec un autre rapport
          </Button>
        </Card>
      )}
    </div>
  );
};
