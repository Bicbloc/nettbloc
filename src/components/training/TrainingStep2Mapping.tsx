import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, ArrowRight, Zap, Filter, X, Plus, 
  Info, AlertTriangle, CheckCircle2, Search, 
  MousePointerClick, Layers, Sparkles, RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';
import { ExtractedRoom, normalizeCleaningType } from '@/services/pms/types';
import { cn } from '@/lib/utils';

// Types de nettoyage disponibles
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc (Départ)', color: 'bg-orange-500', bgLight: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-400', emoji: '🔶' },
  { value: 'recouche', label: 'Recouche (Occupé)', color: 'bg-green-500', bgLight: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-400', emoji: '🔄' },
  { value: 'none', label: 'Pas de ménage', color: 'bg-gray-500', bgLight: 'bg-gray-100 dark:bg-gray-900/30', border: 'border-gray-400', emoji: '⏸️' },
  { value: 'exclude', label: 'Exclure', color: 'bg-red-500', bgLight: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-400', emoji: '🚫' },
];

// Patterns d'exclusion par défaut
const DEFAULT_EXCLUSION_PATTERNS = [
  'fermé', 'hors service', 'out of order', 'ooo', 'maintenance', 
  'total', 'page', 'imprimé', 'date :', 'http', 'www.'
];

interface ParsedLine {
  id: string;
  lineNumber: number;
  rawText: string;
  normalizedText: string;
  hasRoomNumber: boolean;
  roomNumber: string | null;
  signature: string; // Signature de pattern pour grouper les lignes similaires
  cleaningType: 'a_blanc' | 'recouche' | 'none' | 'exclude' | null;
  isExcluded: boolean;
  matchedPattern: string | null;
}

interface PatternGroup {
  signature: string;
  cleaningType: 'a_blanc' | 'recouche' | 'none' | 'exclude' | null;
  lines: ParsedLine[];
  example: string;
  keywords: string[];
}

interface TrainingStep2MappingProps {
  trainingData: TrainingData;
  hotelId: string;
  onComplete: (mappedRooms: ExtractedRoom[], mapping: Record<string, string>, exclusions: string[]) => void;
  onBack: () => void;
}

export const TrainingStep2Mapping: React.FC<TrainingStep2MappingProps> = ({
  trainingData,
  hotelId,
  onComplete,
  onBack,
}) => {
  const { toast } = useToast();
  
  // États
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [exclusionPatterns, setExclusionPatterns] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showOnlyRooms, setShowOnlyRooms] = useState(false);
  const [currentAssignType, setCurrentAssignType] = useState<'a_blanc' | 'recouche' | 'none' | 'exclude'>('a_blanc');

  // Extraire la signature de pattern d'une ligne (pour grouper les lignes similaires)
  const extractSignature = useCallback((text: string): { signature: string; keywords: string[] } => {
    const normalized = text.toUpperCase().trim();
    const keywords: string[] = [];
    
    // Remplacer les numéros de chambre par un placeholder
    let signature = normalized.replace(/\b\d{2,4}[A-Z]?\b/g, '{ROOM}');
    
    // Remplacer les dates par un placeholder
    signature = signature.replace(/\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?/g, '{DATE}');
    
    // Remplacer les heures
    signature = signature.replace(/\d{1,2}[hH:]\d{2}/g, '{TIME}');
    
    // Remplacer les noms propres (commençant par majuscule)
    signature = signature.replace(/\b[A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?\b/g, '{NAME}');
    
    // Extraire les mots-clés significatifs
    const keywordPatterns = [
      'DÉPART', 'DEPART', 'ARRIVÉE', 'ARRIVEE', 'CHECKOUT', 'CHECKIN',
      'SÉJOUR', 'SEJOUR', 'RECOUCHE', 'OCCUPÉ', 'OCCUPE', 'PROLONGATION',
      'À BLANC', 'A BLANC', 'LIBRE', 'SALE', 'DIRTY', 'PROPRE', 'CLEAN',
      'FAIT', 'À FAIRE', 'A FAIRE', 'EN COURS', 'COMPLET', 'REFAIT',
      'DND', 'REFUS', 'MAINTENANCE', 'OOO', 'OUT', 'VIP', 'OK',
      // MisterBooking specific
      'DEP', 'ARR', 'PRO', 'OCC', 'INS', 'SAL', 'VAC', 'RES',
      // Cases cochées
      '☑', '☐', '✓', '✗', 'X', '○', '●'
    ];
    
    for (const kw of keywordPatterns) {
      if (normalized.includes(kw)) {
        keywords.push(kw);
      }
    }
    
    // Simplifier les espaces multiples
    signature = signature.replace(/\s+/g, ' ').trim();
    
    return { signature, keywords };
  }, []);

  // Parser le texte brut en lignes analysées
  useEffect(() => {
    const rawText = trainingData.rawText || '';
    const lines = rawText.split('\n');
    const roomPattern = /\b(\d{2,4}[A-Z]?)\b/;
    
    const parsed: ParsedLine[] = lines.map((line, index) => {
      const trimmed = line.trim();
      const { signature, keywords } = extractSignature(trimmed);
      const roomMatch = trimmed.match(roomPattern);
      const hasRoom = !!roomMatch && parseInt(roomMatch[1], 10) > 0 && parseInt(roomMatch[1], 10) < 9999;
      
      return {
        id: `line-${index}`,
        lineNumber: index + 1,
        rawText: trimmed,
        normalizedText: trimmed.toUpperCase(),
        hasRoomNumber: hasRoom,
        roomNumber: hasRoom ? roomMatch![1] : null,
        signature,
        cleaningType: null,
        isExcluded: false,
        matchedPattern: keywords.length > 0 ? keywords[0] : null,
      };
    }).filter(l => l.rawText.length > 2);

    // Charger les exclusions sauvegardées
    const savedExclusions = localStorage.getItem(`training_exclusions_${hotelId}`);
    if (savedExclusions) {
      try {
        const exclusions = JSON.parse(savedExclusions);
        setExclusionPatterns(exclusions);
        // Appliquer les exclusions
        parsed.forEach(line => {
          for (const pattern of exclusions) {
            if (line.normalizedText.includes(pattern.toUpperCase())) {
              line.isExcluded = true;
              break;
            }
          }
        });
      } catch {
        setExclusionPatterns([...DEFAULT_EXCLUSION_PATTERNS]);
      }
    } else {
      setExclusionPatterns([...DEFAULT_EXCLUSION_PATTERNS]);
    }

    setParsedLines(parsed);
  }, [trainingData.rawText, hotelId, extractSignature]);

  // Grouper les lignes par signature de pattern
  const patternGroups = useMemo(() => {
    const groups: Map<string, PatternGroup> = new Map();
    
    for (const line of parsedLines) {
      if (line.isExcluded) continue;
      
      const existing = groups.get(line.signature);
      if (existing) {
        existing.lines.push(line);
      } else {
        groups.set(line.signature, {
          signature: line.signature,
          cleaningType: line.cleaningType,
          lines: [line],
          example: line.rawText,
          keywords: line.matchedPattern ? [line.matchedPattern] : [],
        });
      }
    }
    
    return Array.from(groups.values()).sort((a, b) => b.lines.length - a.lines.length);
  }, [parsedLines]);

  // Lignes filtrées pour affichage
  const filteredLines = useMemo(() => {
    return parsedLines.filter(line => {
      if (showOnlyRooms && !line.hasRoomNumber) return false;
      if (searchFilter) {
        const search = searchFilter.toUpperCase();
        return line.normalizedText.includes(search) || 
               line.roomNumber?.includes(search) ||
               line.signature.includes(search);
      }
      return true;
    });
  }, [parsedLines, searchFilter, showOnlyRooms]);

  // Sélectionner une ligne et toutes les lignes similaires
  const handleLineClick = useCallback((line: ParsedLine, addToSelection: boolean = false) => {
    const newSelection = new Set(addToSelection ? selectedLines : []);
    
    // Trouver toutes les lignes avec la même signature
    const similarLines = parsedLines.filter(l => l.signature === line.signature && !l.isExcluded);
    
    if (selectedLines.has(line.id) && selectedLines.size === similarLines.length) {
      // Désélectionner tout le groupe si déjà sélectionné
      similarLines.forEach(l => newSelection.delete(l.id));
    } else {
      // Sélectionner tout le groupe
      similarLines.forEach(l => newSelection.add(l.id));
    }
    
    setSelectedLines(newSelection);
    
    if (!addToSelection && similarLines.length > 1) {
      toast({
        title: `${similarLines.length} lignes similaires sélectionnées`,
        description: `Pattern: "${line.signature.substring(0, 50)}..."`,
      });
    }
  }, [parsedLines, selectedLines, toast]);

  // Désélectionner une seule ligne
  const handleDeselectLine = useCallback((lineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedLines);
    newSelection.delete(lineId);
    setSelectedLines(newSelection);
  }, [selectedLines]);

  // Assigner un type de nettoyage aux lignes sélectionnées
  const assignTypeToSelection = useCallback((type: 'a_blanc' | 'recouche' | 'none' | 'exclude') => {
    if (selectedLines.size === 0) {
      toast({ title: "Aucune ligne sélectionnée", variant: "destructive" });
      return;
    }

    setParsedLines(prev => prev.map(line => {
      if (selectedLines.has(line.id)) {
        return { ...line, cleaningType: type, isExcluded: type === 'exclude' };
      }
      return line;
    }));

    const typeLabel = CLEANING_TYPES.find(t => t.value === type)?.label || type;
    toast({
      title: `${selectedLines.size} lignes assignées`,
      description: `Type: ${typeLabel}`,
    });
    
    setSelectedLines(new Set());
  }, [selectedLines, toast]);

  // Auto-mapping intelligent
  const autoMap = useCallback(() => {
    const departureKeywords = ['DÉPART', 'DEPART', 'CHECKOUT', 'CHECK-OUT', 'LIBRE', 'VACANT', 'À BLANC', 'A BLANC', 'SALE', 'DIRTY', 'DEP'];
    const stayoverKeywords = ['SÉJOUR', 'SEJOUR', 'RECOUCHE', 'OCCUPÉ', 'OCCUPE', 'PROLONGATION', 'OCC', 'PRO', 'INS', 'EN COURS'];
    const noServiceKeywords = ['PROPRE', 'CLEAN', 'FAIT', 'OK', 'DND', 'REFUS', 'TERMINÉ'];
    const excludeKeywords = ['MAINTENANCE', 'OOO', 'HORS SERVICE', 'FERMÉ', 'TOTAL', 'PAGE'];

    setParsedLines(prev => prev.map(line => {
      const upper = line.normalizedText;
      let type: ParsedLine['cleaningType'] = null;
      
      // Vérifier les exclusions d'abord
      for (const kw of excludeKeywords) {
        if (upper.includes(kw)) {
          return { ...line, cleaningType: 'exclude', isExcluded: true };
        }
      }
      
      // Départ = À blanc
      for (const kw of departureKeywords) {
        if (upper.includes(kw)) {
          type = 'a_blanc';
          break;
        }
      }
      
      // Séjour = Recouche (si pas déjà assigné)
      if (!type) {
        for (const kw of stayoverKeywords) {
          if (upper.includes(kw)) {
            type = 'recouche';
            break;
          }
        }
      }
      
      // Pas de ménage
      if (!type) {
        for (const kw of noServiceKeywords) {
          if (upper.includes(kw)) {
            type = 'none';
            break;
          }
        }
      }
      
      return { ...line, cleaningType: type };
    }));

    toast({ title: "Auto-mapping appliqué", description: "Revérifiez les assignations." });
  }, [toast]);

  // Reset le mapping
  const resetMapping = useCallback(() => {
    setParsedLines(prev => prev.map(line => ({
      ...line,
      cleaningType: null,
      isExcluded: false,
    })));
    setSelectedLines(new Set());
    toast({ title: "Mapping réinitialisé" });
  }, [toast]);

  // Ajouter un pattern d'exclusion
  const addExclusion = useCallback(() => {
    const trimmed = newExclusion.trim().toLowerCase();
    if (trimmed && !exclusionPatterns.includes(trimmed)) {
      const newPatterns = [...exclusionPatterns, trimmed];
      setExclusionPatterns(newPatterns);
      localStorage.setItem(`training_exclusions_${hotelId}`, JSON.stringify(newPatterns));
      
      // Appliquer l'exclusion
      setParsedLines(prev => prev.map(line => {
        if (line.normalizedText.includes(trimmed.toUpperCase())) {
          return { ...line, isExcluded: true, cleaningType: 'exclude' };
        }
        return line;
      }));
      
      setNewExclusion('');
      toast({ title: "Exclusion ajoutée", description: `"${trimmed}"` });
    }
  }, [newExclusion, exclusionPatterns, hotelId, toast]);

  // Statistiques
  const stats = useMemo(() => {
    const withRoom = parsedLines.filter(l => l.hasRoomNumber && !l.isExcluded);
    const aBlanc = withRoom.filter(l => l.cleaningType === 'a_blanc').length;
    const recouche = withRoom.filter(l => l.cleaningType === 'recouche').length;
    const none = withRoom.filter(l => l.cleaningType === 'none').length;
    const excluded = parsedLines.filter(l => l.isExcluded).length;
    const unmapped = withRoom.filter(l => !l.cleaningType).length;
    
    return { 
      total: withRoom.length, 
      aBlanc, 
      recouche, 
      none, 
      excluded,
      unmapped,
      totalLines: parsedLines.length 
    };
  }, [parsedLines]);

  // Générer le mapping et continuer
  const handleContinue = useCallback(() => {
    // Créer le mapping keyword -> type depuis les lignes assignées
    const mapping: Record<string, string> = {};
    const seenPatterns = new Set<string>();
    
    for (const line of parsedLines) {
      if (line.cleaningType && line.cleaningType !== 'exclude' && line.matchedPattern) {
        if (!seenPatterns.has(line.matchedPattern)) {
          mapping[line.matchedPattern] = line.cleaningType;
          seenPatterns.add(line.matchedPattern);
        }
      }
    }

    // Convertir les lignes en ExtractedRoom
    const rooms: ExtractedRoom[] = parsedLines
      .filter(l => l.hasRoomNumber && !l.isExcluded && l.cleaningType && l.cleaningType !== 'exclude')
      .map(line => ({
        roomNumber: line.roomNumber!,
        status: line.cleaningType === 'a_blanc' ? 'checkout' : 
                line.cleaningType === 'recouche' ? 'stayover' : 'clean',
        cleaningType: normalizeCleaningType(line.cleaningType as any),
        originalText: line.rawText,
        validated: false,
        confidence: 80,
      }));

    onComplete(rooms, mapping, exclusionPatterns);
  }, [parsedLines, exclusionPatterns, onComplete]);

  const getTypeStyle = (type: string | null) => {
    const t = CLEANING_TYPES.find(ct => ct.value === type);
    return t ? t.bgLight : '';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
          <span>
            PMS: <Badge variant="secondary">{trainingData.detectedPmsType.toUpperCase()}</Badge>
            {' '}• {stats.totalLines} lignes • {stats.total} chambres détectées
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={autoMap}>
              <Zap className="h-4 w-4 mr-1" />
              Auto-mapper
            </Button>
            <Button size="sm" variant="ghost" onClick={resetMapping}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <Card className="p-2 text-center">
          <p className="text-xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Chambres</p>
        </Card>
        <Card className="p-2 text-center bg-orange-50 dark:bg-orange-900/20">
          <p className="text-xl font-bold text-orange-600">{stats.aBlanc}</p>
          <p className="text-xs text-orange-600">À blanc</p>
        </Card>
        <Card className="p-2 text-center bg-green-50 dark:bg-green-900/20">
          <p className="text-xl font-bold text-green-600">{stats.recouche}</p>
          <p className="text-xs text-green-600">Recouche</p>
        </Card>
        <Card className="p-2 text-center bg-gray-50 dark:bg-gray-900/20">
          <p className="text-xl font-bold text-gray-600">{stats.none}</p>
          <p className="text-xs text-gray-600">Aucun</p>
        </Card>
        <Card className="p-2 text-center bg-red-50 dark:bg-red-900/20">
          <p className="text-xl font-bold text-red-600">{stats.excluded}</p>
          <p className="text-xs text-red-600">Exclus</p>
        </Card>
        <Card className="p-2 text-center bg-yellow-50 dark:bg-yellow-900/20">
          <p className="text-xl font-bold text-yellow-600">{stats.unmapped}</p>
          <p className="text-xs text-yellow-600">À mapper</p>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="p-3 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-2">
          <MousePointerClick className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Comment mapper :</p>
            <ol className="list-decimal ml-4 mt-1 text-muted-foreground space-y-0.5">
              <li>Cliquez sur une ligne - les lignes similaires sont auto-sélectionnées</li>
              <li>Cliquez sur le ✕ pour désélectionner une ligne individuelle</li>
              <li>Assignez un type avec les boutons ci-dessous</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Boutons d'assignation */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">
          {selectedLines.size > 0 ? `${selectedLines.size} sélectionnée(s) →` : 'Sélectionnez des lignes puis :'}
        </span>
        {CLEANING_TYPES.map(type => (
          <Button
            key={type.value}
            size="sm"
            variant={selectedLines.size > 0 ? "default" : "outline"}
            className={cn(
              selectedLines.size > 0 && type.value === 'a_blanc' && 'bg-orange-500 hover:bg-orange-600',
              selectedLines.size > 0 && type.value === 'recouche' && 'bg-green-500 hover:bg-green-600',
              selectedLines.size > 0 && type.value === 'none' && 'bg-gray-500 hover:bg-gray-600',
              selectedLines.size > 0 && type.value === 'exclude' && 'bg-red-500 hover:bg-red-600',
            )}
            disabled={selectedLines.size === 0}
            onClick={() => assignTypeToSelection(type.value as any)}
          >
            {type.emoji} {type.label}
          </Button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les lignes..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          size="sm"
          variant={showOnlyRooms ? "secondary" : "outline"}
          onClick={() => setShowOnlyRooms(!showOnlyRooms)}
        >
          <Filter className="h-4 w-4 mr-1" />
          Chambres uniquement
        </Button>
      </div>

      {/* Exclusions rapides */}
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Ajouter un pattern d'exclusion..."
          value={newExclusion}
          onChange={(e) => setNewExclusion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
          className="flex-1"
        />
        <Button size="sm" variant="secondary" onClick={addExclusion}>
          <Plus className="h-4 w-4 mr-1" />
          Exclure
        </Button>
      </div>

      {/* Liste des lignes */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Lignes du rapport ({filteredLines.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[350px]">
            <div className="divide-y">
              {filteredLines.map((line) => {
                const isSelected = selectedLines.has(line.id);
                const typeStyle = getTypeStyle(line.cleaningType);
                
                return (
                  <div
                    key={line.id}
                    onClick={() => !line.isExcluded && handleLineClick(line, false)}
                    className={cn(
                      "px-3 py-2 cursor-pointer transition-all text-sm",
                      line.isExcluded && "opacity-40 cursor-not-allowed bg-red-50 dark:bg-red-900/10",
                      !line.isExcluded && !isSelected && "hover:bg-muted/50",
                      isSelected && "bg-primary/10 border-l-4 border-primary",
                      !isSelected && typeStyle && `${typeStyle} border-l-4 ${CLEANING_TYPES.find(t => t.value === line.cleaningType)?.border || ''}`,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Checkbox visuel */}
                      <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      )}>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                      </div>
                      
                      {/* Numéro de chambre */}
                      {line.hasRoomNumber && (
                        <Badge variant="outline" className="shrink-0 font-mono">
                          {line.roomNumber}
                        </Badge>
                      )}
                      
                      {/* Texte de la ligne */}
                      <span className="flex-1 truncate font-mono text-xs">
                        {line.rawText}
                      </span>
                      
                      {/* Type assigné */}
                      {line.cleaningType && line.cleaningType !== 'exclude' && (
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "shrink-0 text-xs",
                            line.cleaningType === 'a_blanc' && "bg-orange-100 text-orange-700",
                            line.cleaningType === 'recouche' && "bg-green-100 text-green-700",
                            line.cleaningType === 'none' && "bg-gray-100 text-gray-700",
                          )}
                        >
                          {CLEANING_TYPES.find(t => t.value === line.cleaningType)?.emoji}
                        </Badge>
                      )}
                      
                      {/* Bouton désélectionner */}
                      {isSelected && (
                        <button
                          onClick={(e) => handleDeselectLine(line.id, e)}
                          className="p-1 rounded hover:bg-destructive/20 text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      
                      {/* Indicateur lignes similaires */}
                      {!line.isExcluded && patternGroups.find(g => g.signature === line.signature)?.lines.length! > 1 && (
                        <span className="text-xs text-muted-foreground">
                          ×{patternGroups.find(g => g.signature === line.signature)?.lines.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button onClick={handleContinue} disabled={stats.total === 0}>
          Continuer
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
