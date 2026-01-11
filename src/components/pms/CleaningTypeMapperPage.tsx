import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Search, Check, X, ArrowLeft, ArrowRight, Save, Trash2, RefreshCw, 
  Eye, EyeOff, Filter, Layers, Sparkles, AlertCircle, Info, Ban, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { fieldExtractor, ExtractedFields } from '@/services/pms/FieldExtractor';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LineData {
  index: number;
  raw: string;
  roomNumber: string | null;
  fields: ExtractedFields | null;
  pattern: LinePattern;
  cleaningType: 'a_blanc' | 'recouche' | 'none' | null;
  isHeader: boolean;
  defaultCleaningType: 'a_blanc' | 'recouche' | 'none'; // Type calculé par défaut
}

interface LinePattern {
  hasArrivalDate: boolean;
  hasDepartureDate: boolean;
  hasArrivalTime: boolean;
  hasDepartureTime: boolean;
  hasNightInfo: boolean;
  statusCodes: string[];
  patternKey: string;
  detectedDates: string[];
  detectedTimes: string[];
}

interface CleaningTypeMapperPageProps {
  hotelId: string;
  onBack: () => void;
  onContinue?: () => void;
}

const PATTERN_COLORS: Record<string, string> = {
  'a_blanc': 'bg-red-100 border-red-300 text-red-800',
  'recouche': 'bg-blue-100 border-blue-300 text-blue-800',
  'none': 'bg-gray-100 border-gray-300 text-gray-600',
};

// Termes exclus par défaut du pattern matching (types de chambres, etc.)
const DEFAULT_EXCLUDED_TERMS = [
  'SGL', 'DBL', 'TWN', 'TWIN', 'TRIPLE', 'QUAD', 'KING', 'QUEEN',
  'CLA', 'SUP', 'DLX', 'STD', 'FAM', 'COC', 'PMR', 'JUN', 'STE',
  'Twinable', 'BLC', 'VIP', 'ECO', 'LUX', 'EXE'
];

function extractPatternFromLine(line: string, excludedTerms: string[] = []): LinePattern {
  // Nettoyer la ligne en retirant les termes exclus
  let cleanedLine = line;
  excludedTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    cleanedLine = cleanedLine.replace(regex, ' ');
  });
  
  const dateMatches = cleanedLine.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g) || [];
  const timeMatches = cleanedLine.match(/\d{1,2}:\d{2}/g) || [];
  const hasNightPattern = /(?:nuit|night)\s*\d+\s*[\/\\]\s*\d+/i.test(cleanedLine);
  
  const upper = cleanedLine.toUpperCase();
  const statusCodes: string[] = [];
  
  // Codes de statut PMS
  if (/\bSAL\b/.test(upper)) statusCodes.push('SAL');
  if (/\bDIR\b/.test(upper)) statusCodes.push('DIR');
  if (/\bDEP\b/.test(upper)) statusCodes.push('DEP');
  if (/\bOCC\b/.test(upper)) statusCodes.push('OCC');
  if (/\bPRO\b/.test(upper)) statusCodes.push('PRO');
  if (/\bINS\b/.test(upper)) statusCodes.push('INS');
  if (/\bARR\b/.test(upper)) statusCodes.push('ARR');
  if (/\bNET\b/.test(upper)) statusCodes.push('NET');
  if (/\bLIB\b/.test(upper)) statusCodes.push('LIB');
  if (/\bBLQ\b/.test(upper)) statusCodes.push('BLQ');
  
  const hasArrivalDate = dateMatches.length >= 1;
  const hasDepartureDate = dateMatches.length >= 2;
  const hasArrivalTime = timeMatches.length >= 1;
  const hasDepartureTime = timeMatches.length >= 2;
  
  const patternKey = [
    statusCodes.sort().join('+') || 'NO_STATUS',
    hasArrivalDate ? 'ARR_DATE' : '',
    hasDepartureDate ? 'DEP_DATE' : '',
    hasArrivalTime ? 'ARR_TIME' : '',
    hasDepartureTime ? 'DEP_TIME' : '',
    hasNightPattern ? 'NIGHT' : '',
  ].filter(Boolean).join('|');
  
  return {
    hasArrivalDate,
    hasDepartureDate,
    hasArrivalTime,
    hasDepartureTime,
    hasNightInfo: hasNightPattern,
    statusCodes,
    patternKey,
    detectedDates: dateMatches,
    detectedTimes: timeMatches,
  };
}

/**
 * Calcule le type de nettoyage par défaut basé sur le pattern
 * Logique standard: 2 horaires ou DEP = à blanc, sinon recouche
 */
function getDefaultCleaningType(pattern: LinePattern): 'a_blanc' | 'recouche' | 'none' {
  // INS/PRO/NET = propre, aucun nettoyage
  if (pattern.statusCodes.some(c => ['INS', 'PRO', 'NET'].includes(c))) {
    return 'none';
  }
  
  // DEP explicite = à blanc
  if (pattern.statusCodes.includes('DEP')) {
    return 'a_blanc';
  }
  
  // 2 horaires = checkout + checkin = à blanc
  if (pattern.hasDepartureTime) {
    return 'a_blanc';
  }
  
  // 2 dates mais pas d'horaires = séjour en cours = recouche
  if (pattern.hasDepartureDate && !pattern.hasDepartureTime) {
    return 'recouche';
  }
  
  // Info nuit présente = séjour = recouche
  if (pattern.hasNightInfo) {
    return 'recouche';
  }
  
  // SAL/DIR/OCC sans contexte = recouche par défaut (client en place)
  if (pattern.statusCodes.some(c => ['SAL', 'DIR', 'OCC'].includes(c))) {
    return 'recouche';
  }
  
  // Fallback
  return 'a_blanc';
}

function extractRoomNumber(line: string): string | null {
  // Patterns pour chambres: 101, 101 B, 101B, 107+108
  const match = line.match(/^\s*(\d{2,4}(?:\s*[A-Z])?)(?:\s*\+\s*\d{2,4})?/);
  if (match) {
    const num = match[1].replace(/\s+/g, '');
    // Éviter les années comme numéros de chambre
    if (!/^20\d{2}$/.test(num) && !/^19\d{2}$/.test(num)) {
      return num;
    }
  }
  return null;
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /^étage|^floor|^statut|^status|^espaces|^responsable|^room/i.test(lower) ||
    /hôtel|hotel/i.test(lower) && /\d{2}:\d{2}:\d{2}/.test(line) ||
    line.trim().length < 5 ||
    /^\s*\d+\s*\/\s*\d+\s*$/.test(line) // Page numbers like "1 / 2"
  );
}

export const CleaningTypeMapperPage = ({ hotelId, onBack, onContinue }: CleaningTypeMapperPageProps) => {
  const [lines, setLines] = useState<LineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState<LineData | null>(null);
  const [showOnlyRooms, setShowOnlyRooms] = useState(true);
  const [patternRules, setPatternRules] = useState<Map<string, 'a_blanc' | 'recouche' | 'none'>>(new Map());
  const [saving, setSaving] = useState(false);
  
  // Gestion des termes exclus
  const [excludedTerms, setExcludedTerms] = useState<string[]>(DEFAULT_EXCLUDED_TERMS);
  const [newExcludedTerm, setNewExcludedTerm] = useState('');
  const [showExcludedPanel, setShowExcludedPanel] = useState(false);
  const [rawReportText, setRawReportText] = useState<string>('');

  // Parser les lignes avec les termes exclus actuels
  const parseLines = useCallback((rawText: string) => {
    const rawLines = rawText.split('\n').filter((l: string) => l.trim());
    const parsedLines: LineData[] = rawLines.map((raw: string, index: number) => {
      const roomNumber = extractRoomNumber(raw);
      const isHeader = isHeaderLine(raw);
      const pattern = extractPatternFromLine(raw, excludedTerms);
      
      let fields: ExtractedFields | null = null;
      if (roomNumber && !isHeader) {
        const result = fieldExtractor.extractFromLine(raw, roomNumber);
        fields = result.fields;
      }
      
      // Calculer le type de nettoyage par défaut
      const defaultCleaningType = getDefaultCleaningType(pattern);
      
      return {
        index,
        raw,
        roomNumber,
        fields,
        pattern,
        cleaningType: null,
        isHeader,
        defaultCleaningType,
      };
    });
    
    setLines(parsedLines);
    return parsedLines;
  }, [excludedTerms]);

  // Charger les lignes du rapport d'entraînement
  const loadLines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_training_patterns')
        .select('raw_text')
        .eq('hotel_id', hotelId)
        .eq('validated', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.raw_text) {
        setRawReportText(data.raw_text);
        parseLines(data.raw_text);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur lors du chargement du rapport');
    } finally {
      setLoading(false);
    }
  };

  // Réanalyser quand les termes exclus changent
  const reanalyzeWithExclusions = useCallback(() => {
    if (rawReportText) {
      parseLines(rawReportText);
      setSelectedLine(null);
      toast.success('Rapport réanalysé avec les nouveaux termes exclus');
    }
  }, [rawReportText, parseLines]);

  // Ajouter un terme exclu
  const addExcludedTerm = () => {
    const term = newExcludedTerm.trim().toUpperCase();
    if (term && !excludedTerms.includes(term)) {
      setExcludedTerms(prev => [...prev, term]);
      setNewExcludedTerm('');
      toast.success(`"${term}" ajouté aux exclusions`);
    }
  };

  // Supprimer un terme exclu
  const removeExcludedTerm = (term: string) => {
    setExcludedTerms(prev => prev.filter(t => t !== term));
    toast.success(`"${term}" retiré des exclusions`);
  };

  // Réinitialiser les termes exclus
  const resetExcludedTerms = () => {
    setExcludedTerms(DEFAULT_EXCLUDED_TERMS);
    toast.success('Exclusions réinitialisées');
  };

  // Charger les règles existantes
  const loadExistingRules = async () => {
    try {
      const { data, error } = await supabase
        .from('hotel_combination_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true);

      if (error) throw error;
      
      // Convertir les règles en Map de patternKey → cleaningType
      const rulesMap = new Map<string, 'a_blanc' | 'recouche' | 'none'>();
      (data || []).forEach((rule: any) => {
        const patternParts: string[] = [];
        if ((rule.status_keywords || []).length > 0) {
          patternParts.push(rule.status_keywords.sort().join('+'));
        } else {
          patternParts.push('NO_STATUS');
        }
        if (rule.arrival_date === 'present') patternParts.push('ARR_DATE');
        if (rule.departure_date === 'present') patternParts.push('DEP_DATE');
        if (rule.arrival_time === 'present') patternParts.push('ARR_TIME');
        if (rule.departure_time === 'present') patternParts.push('DEP_TIME');
        if (rule.night_info === 'present') patternParts.push('NIGHT');
        
        const key = patternParts.join('|');
        rulesMap.set(key, rule.result_cleaning_type);
      });
      
      setPatternRules(rulesMap);
    } catch (error) {
      console.error('Erreur chargement règles:', error);
    }
  };

  useEffect(() => {
    loadLines();
    loadExistingRules();
  }, [hotelId]);

  // Filtrer les lignes
  const filteredLines = useMemo(() => {
    let result = lines;
    
    if (showOnlyRooms) {
      result = result.filter(l => l.roomNumber && !l.isHeader);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(l => 
        l.raw.toLowerCase().includes(searchLower) ||
        l.roomNumber?.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }, [lines, search, showOnlyRooms]);

  // Lignes similaires à la ligne sélectionnée
  const similarLines = useMemo(() => {
    if (!selectedLine) return new Set<number>();
    
    const similar = new Set<number>();
    const selectedPattern = selectedLine.pattern.patternKey;
    
    lines.forEach(line => {
      if (line.pattern.patternKey === selectedPattern) {
        similar.add(line.index);
      }
    });
    
    return similar;
  }, [selectedLine, lines]);

  // Groupes de patterns uniques
  const patternGroups = useMemo(() => {
    const groups = new Map<string, { lines: LineData[]; count: number; example: string }>();
    
    filteredLines.forEach(line => {
      if (!line.roomNumber || line.isHeader) return;
      
      const key = line.pattern.patternKey;
      if (!groups.has(key)) {
        groups.set(key, { lines: [], count: 0, example: line.raw.substring(0, 80) });
      }
      const group = groups.get(key)!;
      group.lines.push(line);
      group.count++;
    });
    
    return groups;
  }, [filteredLines]);

  // Assigner un type de nettoyage à un pattern
  const assignCleaningType = useCallback((patternKey: string, cleaningType: 'a_blanc' | 'recouche' | 'none') => {
    setPatternRules(prev => {
      const newMap = new Map(prev);
      newMap.set(patternKey, cleaningType);
      return newMap;
    });
    
    // Mettre à jour les lignes
    setLines(prev => prev.map(line => {
      if (line.pattern.patternKey === patternKey) {
        return { ...line, cleaningType };
      }
      return line;
    }));
    
    toast.success(`Pattern assigné: ${cleaningType === 'a_blanc' ? 'À blanc' : cleaningType === 'recouche' ? 'Recouche' : 'Aucun'}`);
  }, []);

  // Sauvegarder les règles
  const saveRules = async () => {
    setSaving(true);
    try {
      // Supprimer les anciennes règles auto-générées
      await supabase
        .from('hotel_combination_rules')
        .delete()
        .eq('hotel_id', hotelId)
        .like('rule_name', 'Auto_%');

      // Créer les nouvelles règles avec logique 'present' vs 'absent'
      const rulesToInsert: any[] = [];
      let priority = 100;
      
      patternRules.forEach((cleaningType, patternKey) => {
        const parts = patternKey.split('|');
        const statusPart = parts[0];
        const statusCodes = statusPart !== 'NO_STATUS' ? statusPart.split('+') : [];
        
        // IMPORTANT: Si un élément est dans le pattern → 'present'
        // Si un élément n'est PAS dans le pattern → 'absent' (pas 'any')
        // Cela permet un matching exact du pattern
        rulesToInsert.push({
          hotel_id: hotelId,
          rule_name: `Auto_${patternKey.replace(/\|/g, '_').substring(0, 30)}`,
          description: `Pattern: ${patternKey}`,
          priority: priority--,
          is_active: true,
          status_keywords: statusCodes,
          arrival_date: parts.includes('ARR_DATE') ? 'present' : 'absent',
          departure_date: parts.includes('DEP_DATE') ? 'present' : 'absent',
          arrival_time: parts.includes('ARR_TIME') ? 'present' : 'absent',
          departure_time: parts.includes('DEP_TIME') ? 'present' : 'absent',
          night_info: parts.includes('NIGHT') ? 'present' : 'absent',
          result_cleaning_type: cleaningType,
        });
      });

      if (rulesToInsert.length > 0) {
        const { error } = await supabase
          .from('hotel_combination_rules')
          .insert(rulesToInsert);
        
        if (error) throw error;
      }

      toast.success(`${rulesToInsert.length} règles enregistrées - Elles seront utilisées au prochain import PDF`);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Obtenir le type de nettoyage d'une ligne
  const getLineCleaningType = (line: LineData) => {
    return patternRules.get(line.pattern.patternKey) || null;
  };

  const renderPatternBadges = (pattern: LinePattern, showDetails: boolean = false) => {
    return (
      <div className="flex flex-wrap gap-1">
        {pattern.statusCodes.map(code => (
          <Badge key={code} variant="outline" className="text-[10px] py-0 px-1 font-bold">
            {code}
          </Badge>
        ))}
        {pattern.detectedDates.length > 0 && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-green-100">
            {pattern.detectedDates.length} date{pattern.detectedDates.length > 1 ? 's' : ''}
            {showDetails && `: ${pattern.detectedDates.join(', ')}`}
          </Badge>
        )}
        {pattern.detectedTimes.length > 0 && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-blue-100">
            {pattern.detectedTimes.length} horaire{pattern.detectedTimes.length > 1 ? 's' : ''}
            {showDetails && `: ${pattern.detectedTimes.join(', ')}`}
          </Badge>
        )}
        {pattern.hasNightInfo && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-indigo-100">Nuit</Badge>
        )}
      </div>
    );
  };

  // Affiche le type par défaut avec possibilité de le remplacer
  const renderDefaultTypeIndicator = (line: LineData) => {
    const assigned = patternRules.get(line.pattern.patternKey);
    const isOverridden = assigned && assigned !== line.defaultCleaningType;
    
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Défaut:</span>
        <Badge 
          variant="outline" 
          className={`${
            line.defaultCleaningType === 'a_blanc' 
              ? 'border-red-300 text-red-600' 
              : line.defaultCleaningType === 'recouche' 
                ? 'border-blue-300 text-blue-600' 
                : 'border-gray-300 text-gray-600'
          } ${isOverridden ? 'line-through opacity-50' : ''}`}
        >
          {line.defaultCleaningType === 'a_blanc' ? 'À blanc' : line.defaultCleaningType === 'recouche' ? 'Recouche' : 'Propre'}
        </Badge>
        {isOverridden && (
          <>
            <span className="text-muted-foreground">→</span>
            <Badge className={
              assigned === 'a_blanc' ? 'bg-red-500' : assigned === 'recouche' ? 'bg-blue-500' : 'bg-gray-500'
            }>
              {assigned === 'a_blanc' ? 'À blanc' : assigned === 'recouche' ? 'Recouche' : 'Propre'}
            </Badge>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Mapping des types de nettoyage</h1>
            <p className="text-sm text-muted-foreground">
              Sélectionnez une ligne pour surligner les patterns similaires
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Layers className="h-3 w-3" />
            {patternGroups.size} patterns
          </Badge>
          <Badge variant="outline" className="gap-1">
            {filteredLines.filter(l => l.roomNumber).length} chambres
          </Badge>
          <Button
            variant={showExcludedPanel ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowExcludedPanel(!showExcludedPanel)}
          >
            <Ban className="h-4 w-4 mr-1" />
            Exclusions ({excludedTerms.length})
          </Button>
          <Button onClick={saveRules} disabled={saving || patternRules.size === 0} variant="outline">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
          {onContinue && (
            <Button onClick={onContinue}>
              Continuer
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Excluded Terms Panel */}
      {showExcludedPanel && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ban className="h-4 w-4 text-orange-600" />
              Termes exclus du pattern matching
            </CardTitle>
            <CardDescription className="text-xs">
              Ces termes (types de chambre, etc.) sont ignorés lors de la détection des combinaisons
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1 mb-3">
              {excludedTerms.map(term => (
                <Badge key={term} variant="secondary" className="bg-orange-100 hover:bg-orange-200 text-xs">
                  {term}
                  <button onClick={() => removeExcludedTerm(term)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ajouter un terme..."
                value={newExcludedTerm}
                onChange={(e) => setNewExcludedTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExcludedTerm()}
                className="max-w-[200px] h-8 text-sm"
              />
              <Button size="sm" onClick={addExcludedTerm} disabled={!newExcludedTerm.trim()}>
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
              <Button size="sm" variant="outline" onClick={resetExcludedTerms}>
                Réinitialiser
              </Button>
              <Button size="sm" variant="secondary" onClick={reanalyzeWithExclusions} disabled={!rawReportText}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Réanalyser
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une chambre ou un texte..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={showOnlyRooms ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyRooms(!showOnlyRooms)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Chambres uniquement
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSelectedLine(null); }}
          >
            <X className="h-4 w-4 mr-1" />
            Déselectionner
          </Button>
        </div>
      </Card>

      {/* Main content - 2 columns */}
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Left: Lines list */}
        <div className="col-span-2 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Lignes du rapport
                {selectedLine && (
                  <Badge variant="secondary" className="ml-2">
                    {similarLines.size} lignes similaires
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pb-2">
              <ScrollArea className="h-full">
                <div className="space-y-1 pr-4">
                  {filteredLines.map((line) => {
                    const isSelected = selectedLine?.index === line.index;
                    const isSimilar = similarLines.has(line.index);
                    const cleaningType = getLineCleaningType(line);
                    
                    return (
                      <button
                        key={line.index}
                        onClick={() => setSelectedLine(isSelected ? null : line)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-mono transition-all border ${
                          isSelected 
                            ? 'bg-primary/10 border-primary ring-2 ring-primary/20' 
                            : isSimilar && selectedLine
                              ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20'
                              : cleaningType
                                ? PATTERN_COLORS[cleaningType]
                                : 'border-transparent hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Room number badge */}
                          {line.roomNumber && (
                            <Badge 
                              variant="outline" 
                              className="shrink-0 font-bold text-xs min-w-[3rem] justify-center"
                            >
                              {line.roomNumber}
                            </Badge>
                          )}
                          
                          {/* Cleaning type indicator */}
                          {cleaningType && (
                            <Badge 
                              className={`shrink-0 text-[10px] ${
                                cleaningType === 'a_blanc' 
                                  ? 'bg-red-500' 
                                  : cleaningType === 'recouche' 
                                    ? 'bg-blue-500' 
                                    : 'bg-gray-500'
                              } text-white`}
                            >
                              {cleaningType === 'a_blanc' ? 'B' : cleaningType === 'recouche' ? 'R' : '-'}
                            </Badge>
                          )}
                          
                          {/* Line content */}
                          <span className={`flex-1 truncate ${
                            line.isHeader ? 'text-muted-foreground italic' : ''
                          }`}>
                            {line.raw.length > 100 ? line.raw.substring(0, 100) + '...' : line.raw}
                          </span>
                          
                          {/* Similar indicator */}
                          {isSimilar && selectedLine && !isSelected && (
                            <Sparkles className="h-4 w-4 text-yellow-500 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: Pattern details and assignment */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Selected line details */}
          {selectedLine ? (
            <Card className="flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Pattern sélectionné
                </CardTitle>
                <CardDescription>
                  {similarLines.size} lignes avec ce pattern
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Room number */}
                {selectedLine.roomNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Chambre exemple</p>
                    <Badge variant="outline" className="text-lg font-bold">
                      {selectedLine.roomNumber}
                    </Badge>
                  </div>
                )}

                {/* Pattern visualization */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Éléments détectés</p>
                  {renderPatternBadges(selectedLine.pattern, true)}
                </div>

                {/* Default cleaning type */}
                <div className="p-3 bg-muted/50 rounded-lg border">
                  {renderDefaultTypeIndicator(selectedLine)}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Basé sur: {selectedLine.pattern.detectedTimes.length} horaire(s), {selectedLine.pattern.detectedDates.length} date(s)
                    {selectedLine.pattern.statusCodes.length > 0 && `, codes: ${selectedLine.pattern.statusCodes.join(', ')}`}
                  </p>
                </div>

                {/* Full line */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ligne complète</p>
                  <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                    {selectedLine.raw}
                  </p>
                </div>

                <Separator />

                {/* Assignment buttons */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Remplacer le type par défaut ({similarLines.size} chambres avec ce pattern)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => assignCleaningType(selectedLine.pattern.patternKey, 'a_blanc')}
                          >
                            <span className="font-bold mr-1">B</span> À blanc
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Nettoyage complet (départ/arrivée)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-blue-500 hover:bg-blue-600"
                            onClick={() => assignCleaningType(selectedLine.pattern.patternKey, 'recouche')}
                          >
                            <span className="font-bold mr-1">R</span> Recouche
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Nettoyage rapide (client reste)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                            onClick={() => assignCleaningType(selectedLine.pattern.patternKey, 'none')}
                          >
                            <span className="font-bold mr-1">—</span> Propre
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Pas de nettoyage (chambre propre/inspectée)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Current assignment */}
                {patternRules.get(selectedLine.pattern.patternKey) && (
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Assigné:</span>
                    <Badge className={
                      patternRules.get(selectedLine.pattern.patternKey) === 'a_blanc'
                        ? 'bg-red-500'
                        : patternRules.get(selectedLine.pattern.patternKey) === 'recouche'
                          ? 'bg-blue-500'
                          : 'bg-gray-500'
                    }>
                      {patternRules.get(selectedLine.pattern.patternKey) === 'a_blanc' 
                        ? 'À blanc' 
                        : patternRules.get(selectedLine.pattern.patternKey) === 'recouche' 
                          ? 'Recouche' 
                          : 'Propre'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setPatternRules(prev => {
                          const newMap = new Map(prev);
                          newMap.delete(selectedLine.pattern.patternKey);
                          return newMap;
                        });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground p-6">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sélectionnez une ligne pour voir son pattern</p>
                <p className="text-xs mt-1">Les lignes similaires seront surlignées</p>
              </div>
            </Card>
          )}

          {/* Pattern summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Résumé des patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {Array.from(patternGroups.entries()).map(([key, group]) => {
                    const assigned = patternRules.get(key);
                    const firstLine = group.lines[0];
                    const defaultType = firstLine?.defaultCleaningType;
                    const isOverridden = assigned && assigned !== defaultType;
                    
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          if (firstLine) setSelectedLine(firstLine);
                        }}
                        className={`w-full text-left p-2 rounded border transition-all ${
                          selectedLine?.pattern.patternKey === key
                            ? 'border-primary bg-primary/5'
                            : assigned
                              ? PATTERN_COLORS[assigned]
                              : 'border-border hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            {group.count} chambres
                          </Badge>
                          <div className="flex items-center gap-1">
                            {/* Type par défaut (barré si remplacé) */}
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] ${isOverridden ? 'line-through opacity-40' : ''} ${
                                defaultType === 'a_blanc' ? 'border-red-300' : defaultType === 'recouche' ? 'border-blue-300' : 'border-gray-300'
                              }`}
                            >
                              {defaultType === 'a_blanc' ? 'B' : defaultType === 'recouche' ? 'R' : '-'}
                            </Badge>
                            {/* Type assigné (si différent) */}
                            {isOverridden && (
                              <Badge className={
                                assigned === 'a_blanc' ? 'bg-red-500' : assigned === 'recouche' ? 'bg-blue-500' : 'bg-gray-500'
                              }>
                                {assigned === 'a_blanc' ? 'B' : assigned === 'recouche' ? 'R' : '-'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {group.example}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Legend */}
      <Card className="p-2">
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="font-bold">B</span> = À blanc
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="font-bold">R</span> = Recouche
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-500"></div>
            <span className="font-bold">—</span> = Propre
          </span>
          <span className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] py-0 px-1 line-through opacity-50">B</Badge>
            <Badge className="text-[10px] py-0 px-1 bg-blue-500">R</Badge>
            = Remplacé
          </span>
        </div>
      </Card>
    </div>
  );
};
