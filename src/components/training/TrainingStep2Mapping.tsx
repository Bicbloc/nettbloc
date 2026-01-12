import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, ArrowRight, Zap, Check, X, 
  Layers, Sparkles, RotateCcw, Eye, EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';
import { ExtractedRoom, normalizeCleaningType } from '@/services/pms/types';
import { cn } from '@/lib/utils';

// Types de nettoyage disponibles
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc', shortLabel: 'Blanc', color: 'bg-orange-500', textColor: 'text-orange-600', bgLight: 'bg-orange-100 dark:bg-orange-900/30', emoji: '🔶' },
  { value: 'recouche', label: 'Recouche', shortLabel: 'Rec.', color: 'bg-green-500', textColor: 'text-green-600', bgLight: 'bg-green-100 dark:bg-green-900/30', emoji: '🔄' },
  { value: 'none', label: 'Aucun', shortLabel: 'Non', color: 'bg-gray-500', textColor: 'text-gray-600', bgLight: 'bg-gray-100 dark:bg-gray-900/30', emoji: '⏸️' },
  { value: 'exclude', label: 'Exclure', shortLabel: 'Excl.', color: 'bg-red-500', textColor: 'text-red-600', bgLight: 'bg-red-100 dark:bg-red-900/30', emoji: '🚫' },
] as const;

type CleaningTypeValue = typeof CLEANING_TYPES[number]['value'];

interface PatternGroup {
  id: string;
  signature: string;
  keywords: string[];
  lines: Array<{
    lineNumber: number;
    text: string;
    roomNumber: string | null;
    hasRoom: boolean;
  }>;
  cleaningType: CleaningTypeValue | null;
  isCollapsed: boolean;
}

interface TrainingStep2MappingProps {
  trainingData: TrainingData;
  hotelId: string;
  onComplete: (mappedRooms: ExtractedRoom[], mapping: Record<string, string>, exclusions: string[]) => void;
  onBack: () => void;
}

// Mots-clés pour l'auto-détection
const KEYWORD_MAPPING: Record<string, CleaningTypeValue> = {
  // Départ = À blanc
  'DÉPART': 'a_blanc', 'DEPART': 'a_blanc', 'CHECKOUT': 'a_blanc', 'CHECK-OUT': 'a_blanc',
  'C/O': 'a_blanc', 'DEP': 'a_blanc', 'LIBRE': 'a_blanc', 'VACANT': 'a_blanc',
  'À BLANC': 'a_blanc', 'A BLANC': 'a_blanc', 'SALE': 'a_blanc', 'DIRTY': 'a_blanc', 'SAL': 'a_blanc',
  // Séjour = Recouche
  'SÉJOUR': 'recouche', 'SEJOUR': 'recouche', 'RECOUCHE': 'recouche', 'STAYOVER': 'recouche',
  'OCCUPÉ': 'recouche', 'OCCUPE': 'recouche', 'OCC': 'recouche', 'PROLONGATION': 'recouche',
  'PRO': 'recouche', 'INS': 'recouche', 'EN COURS': 'recouche',
  // Pas de ménage
  'PROPRE': 'none', 'CLEAN': 'none', 'FAIT': 'none', 'OK': 'none', 'TERMINÉ': 'none',
  'DND': 'none', 'REFUS': 'none', 'NE PAS DÉRANGER': 'none',
  // Exclusions
  'MAINTENANCE': 'exclude', 'OOO': 'exclude', 'HORS SERVICE': 'exclude', 'FERMÉ': 'exclude',
  'TOTAL': 'exclude', 'PAGE': 'exclude', 'HTTP': 'exclude', 'WWW': 'exclude',
};

export const TrainingStep2Mapping: React.FC<TrainingStep2MappingProps> = ({
  trainingData,
  hotelId,
  onComplete,
  onBack,
}) => {
  const { toast } = useToast();
  const [patternGroups, setPatternGroups] = useState<PatternGroup[]>([]);
  const [showOnlyWithRooms, setShowOnlyWithRooms] = useState(true);

  // Extraire la signature d'une ligne
  const extractSignature = useCallback((text: string): { signature: string; keywords: string[] } => {
    const normalized = text.toUpperCase().trim();
    const keywords: string[] = [];
    
    // Remplacer les données variables par des placeholders
    let signature = normalized
      .replace(/\b\d{2,4}[A-Z]?\b/g, '{ROOM}')
      .replace(/\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?/g, '{DATE}')
      .replace(/\d{1,2}[hH:]\d{2}/g, '{TIME}')
      .replace(/\b[A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?\b/g, '{NAME}')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extraire les mots-clés significatifs
    for (const kw of Object.keys(KEYWORD_MAPPING)) {
      if (normalized.includes(kw)) {
        keywords.push(kw);
      }
    }
    
    return { signature, keywords };
  }, []);

  // Parser et grouper les lignes
  useEffect(() => {
    const rawText = trainingData.rawText || '';
    const lines = rawText.split('\n');
    const roomPattern = /\b(\d{2,4}[A-Z]?)\b/;
    
    const groups: Map<string, PatternGroup> = new Map();
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.length <= 2) return;
      
      const { signature, keywords } = extractSignature(trimmed);
      const roomMatch = trimmed.match(roomPattern);
      const hasRoom = !!roomMatch && parseInt(roomMatch[1], 10) > 0 && parseInt(roomMatch[1], 10) < 9999;
      
      const lineData = {
        lineNumber: index + 1,
        text: trimmed,
        roomNumber: hasRoom ? roomMatch![1] : null,
        hasRoom,
      };
      
      if (groups.has(signature)) {
        groups.get(signature)!.lines.push(lineData);
      } else {
        // Auto-détecter le type de nettoyage
        let autoType: CleaningTypeValue | null = null;
        for (const kw of keywords) {
          if (KEYWORD_MAPPING[kw]) {
            autoType = KEYWORD_MAPPING[kw];
            break;
          }
        }
        
        groups.set(signature, {
          id: `group-${groups.size}`,
          signature,
          keywords,
          lines: [lineData],
          cleaningType: autoType,
          isCollapsed: true,
        });
      }
    });
    
    // Trier par nombre de lignes (plus gros groupes en premier)
    const sortedGroups = Array.from(groups.values())
      .sort((a, b) => b.lines.length - a.lines.length);
    
    setPatternGroups(sortedGroups);
  }, [trainingData.rawText, extractSignature]);

  // Filtrer les groupes
  const filteredGroups = useMemo(() => {
    if (showOnlyWithRooms) {
      return patternGroups.filter(g => g.lines.some(l => l.hasRoom));
    }
    return patternGroups;
  }, [patternGroups, showOnlyWithRooms]);

  // Statistiques
  const stats = useMemo(() => {
    const roomLines = patternGroups.flatMap(g => g.lines).filter(l => l.hasRoom);
    const mappedGroups = patternGroups.filter(g => g.cleaningType && g.lines.some(l => l.hasRoom));
    const aBlanc = patternGroups.filter(g => g.cleaningType === 'a_blanc').flatMap(g => g.lines.filter(l => l.hasRoom)).length;
    const recouche = patternGroups.filter(g => g.cleaningType === 'recouche').flatMap(g => g.lines.filter(l => l.hasRoom)).length;
    const none = patternGroups.filter(g => g.cleaningType === 'none').flatMap(g => g.lines.filter(l => l.hasRoom)).length;
    const excluded = patternGroups.filter(g => g.cleaningType === 'exclude').flatMap(g => g.lines.filter(l => l.hasRoom)).length;
    
    return {
      totalRooms: roomLines.length,
      mappedGroups: mappedGroups.length,
      totalGroups: patternGroups.filter(g => g.lines.some(l => l.hasRoom)).length,
      aBlanc,
      recouche,
      none,
      excluded,
      unmapped: roomLines.length - aBlanc - recouche - none - excluded,
    };
  }, [patternGroups]);

  // Assigner un type à un groupe
  const assignType = useCallback((groupId: string, type: CleaningTypeValue) => {
    setPatternGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, cleaningType: g.cleaningType === type ? null : type } : g
    ));
  }, []);

  // Toggle collapse
  const toggleCollapse = useCallback((groupId: string) => {
    setPatternGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
    ));
  }, []);

  // Auto-mapper tous les groupes
  const autoMapAll = useCallback(() => {
    setPatternGroups(prev => prev.map(g => {
      if (g.cleaningType) return g;
      
      for (const kw of g.keywords) {
        if (KEYWORD_MAPPING[kw]) {
          return { ...g, cleaningType: KEYWORD_MAPPING[kw] };
        }
      }
      return g;
    }));
    toast({ title: "Auto-mapping appliqué" });
  }, [toast]);

  // Reset
  const resetAll = useCallback(() => {
    setPatternGroups(prev => prev.map(g => ({ ...g, cleaningType: null })));
    toast({ title: "Mapping réinitialisé" });
  }, [toast]);

  // Continuer
  const handleContinue = useCallback(() => {
    const mapping: Record<string, string> = {};
    const exclusions: string[] = [];
    
    for (const group of patternGroups) {
      if (group.cleaningType === 'exclude') {
        exclusions.push(group.signature);
      }
      for (const kw of group.keywords) {
        if (group.cleaningType && group.cleaningType !== 'exclude') {
          mapping[kw] = group.cleaningType;
        }
      }
    }
    
    const rooms: ExtractedRoom[] = patternGroups
      .filter(g => g.cleaningType && g.cleaningType !== 'exclude')
      .flatMap(g => g.lines
        .filter(l => l.hasRoom)
        .map(l => ({
          roomNumber: l.roomNumber!,
          status: g.cleaningType === 'a_blanc' ? 'checkout' : 
                  g.cleaningType === 'recouche' ? 'stayover' : 'clean',
          cleaningType: normalizeCleaningType(g.cleaningType as any),
          originalText: l.text,
          validated: false,
          confidence: 80,
        }))
      );
    
    onComplete(rooms, mapping, exclusions);
  }, [patternGroups, onComplete]);

  const getTypeConfig = (type: CleaningTypeValue | null) => {
    return CLEANING_TYPES.find(t => t.value === type);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        <Card className="p-2 text-center">
          <p className="text-2xl font-bold">{stats.totalRooms}</p>
          <p className="text-xs text-muted-foreground">Chambres</p>
        </Card>
        <Card className="p-2 text-center">
          <p className="text-2xl font-bold">{stats.mappedGroups}/{stats.totalGroups}</p>
          <p className="text-xs text-muted-foreground">Groupes</p>
        </Card>
        <Card className="p-2 text-center bg-orange-50 dark:bg-orange-900/20">
          <p className="text-2xl font-bold text-orange-600">{stats.aBlanc}</p>
          <p className="text-xs text-orange-600">À blanc</p>
        </Card>
        <Card className="p-2 text-center bg-green-50 dark:bg-green-900/20">
          <p className="text-2xl font-bold text-green-600">{stats.recouche}</p>
          <p className="text-xs text-green-600">Recouche</p>
        </Card>
        <Card className="p-2 text-center bg-gray-50 dark:bg-gray-900/20">
          <p className="text-2xl font-bold text-gray-600">{stats.none}</p>
          <p className="text-xs text-gray-600">Aucun</p>
        </Card>
        <Card className="p-2 text-center bg-red-50 dark:bg-red-900/20">
          <p className="text-2xl font-bold text-red-600">{stats.excluded}</p>
          <p className="text-xs text-red-600">Exclus</p>
        </Card>
        <Card className="p-2 text-center bg-yellow-50 dark:bg-yellow-900/20">
          <p className="text-2xl font-bold text-yellow-600">{stats.unmapped}</p>
          <p className="text-xs text-yellow-600">À mapper</p>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={autoMapAll} className="gap-1">
          <Zap className="h-4 w-4" />
          Auto-mapper
        </Button>
        <Button size="sm" variant="outline" onClick={resetAll} className="gap-1">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowOnlyWithRooms(!showOnlyWithRooms)}
          className="gap-1"
        >
          {showOnlyWithRooms ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showOnlyWithRooms ? 'Chambres uniquement' : 'Tout afficher'}
        </Button>
      </div>

      {/* Instructions */}
      <Alert>
        <Layers className="h-4 w-4" />
        <AlertDescription>
          Cliquez sur un type pour l'assigner au groupe. Les lignes similaires sont automatiquement groupées.
        </AlertDescription>
      </Alert>

      {/* Pattern Groups */}
      <ScrollArea className="h-[400px] border rounded-lg">
        <div className="p-2 space-y-2">
          {filteredGroups.map(group => {
            const typeConfig = getTypeConfig(group.cleaningType);
            const roomCount = group.lines.filter(l => l.hasRoom).length;
            
            return (
              <Card 
                key={group.id} 
                className={cn(
                  "overflow-hidden transition-all",
                  typeConfig?.bgLight,
                  !group.cleaningType && "border-dashed border-yellow-400"
                )}
              >
                {/* Group Header */}
                <div 
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleCollapse(group.id)}
                >
                  {/* Type Buttons */}
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {CLEANING_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => assignType(group.id, t.value)}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all",
                          group.cleaningType === t.value 
                            ? `${t.color} text-white ring-2 ring-offset-2 ring-${t.color}`
                            : "bg-muted hover:bg-muted/80"
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
                      <Badge variant="secondary" className="shrink-0">
                        {roomCount} ch. / {group.lines.length} lignes
                      </Badge>
                      {group.keywords.slice(0, 3).map(kw => (
                        <Badge 
                          key={kw} 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            KEYWORD_MAPPING[kw] === 'a_blanc' && "border-orange-400 text-orange-600",
                            KEYWORD_MAPPING[kw] === 'recouche' && "border-green-400 text-green-600",
                            KEYWORD_MAPPING[kw] === 'exclude' && "border-red-400 text-red-600"
                          )}
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      Ex: {group.lines[0]?.text.substring(0, 60)}...
                    </p>
                  </div>

                  {/* Expand indicator */}
                  <span className="text-xs text-muted-foreground">
                    {group.isCollapsed ? '▼' : '▲'}
                  </span>
                </div>

                {/* Expanded Lines */}
                {!group.isCollapsed && (
                  <div className="border-t bg-muted/30 max-h-48 overflow-y-auto">
                    {group.lines.slice(0, 20).map((line, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "px-3 py-1.5 text-xs border-b border-muted/50 last:border-0",
                          line.hasRoom && "font-medium"
                        )}
                      >
                        {line.hasRoom && (
                          <Badge variant="secondary" className="mr-2 text-xs">
                            {line.roomNumber}
                          </Badge>
                        )}
                        <span className="text-muted-foreground">{line.text}</span>
                      </div>
                    ))}
                    {group.lines.length > 20 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground italic">
                        ... et {group.lines.length - 20} autres lignes
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          
          {filteredGroups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun groupe trouvé
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Button 
          onClick={handleContinue} 
          className="gap-2"
          disabled={stats.unmapped > 0 && stats.mappedGroups === 0}
        >
          Continuer
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
