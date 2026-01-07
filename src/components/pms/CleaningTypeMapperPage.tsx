import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Search, Check, X, ArrowLeft, Save, Trash2, RefreshCw, 
  Eye, EyeOff, Filter, Layers, Sparkles, AlertCircle, Info
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
}

interface LinePattern {
  hasArrivalDate: boolean;
  hasDepartureDate: boolean;
  hasArrivalTime: boolean;
  hasDepartureTime: boolean;
  hasNightInfo: boolean;
  statusCodes: string[];
  patternKey: string;
}

interface CleaningTypeMapperPageProps {
  hotelId: string;
  onBack: () => void;
}

const PATTERN_COLORS: Record<string, string> = {
  'a_blanc': 'bg-red-100 border-red-300 text-red-800',
  'recouche': 'bg-blue-100 border-blue-300 text-blue-800',
  'none': 'bg-gray-100 border-gray-300 text-gray-600',
};

function extractPatternFromLine(line: string): LinePattern {
  const dateMatches = line.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g) || [];
  const timeMatches = line.match(/\d{1,2}:\d{2}/g) || [];
  const hasNightPattern = /(?:nuit|night)\s*\d+\s*[\/\\]\s*\d+/i.test(line);
  
  const upper = line.toUpperCase();
  const statusCodes: string[] = [];
  
  if (/\bSAL\b/.test(upper)) statusCodes.push('SAL');
  if (/\bDIR\b/.test(upper)) statusCodes.push('DIR');
  if (/\bDEP\b/.test(upper)) statusCodes.push('DEP');
  if (/\bOCC\b/.test(upper)) statusCodes.push('OCC');
  if (/\bPRO\b/.test(upper)) statusCodes.push('PRO');
  if (/\bINS\b/.test(upper)) statusCodes.push('INS');
  if (/\bARR\b/.test(upper)) statusCodes.push('ARR');
  
  const hasArrivalDate = dateMatches.length >= 1;
  const hasDepartureDate = dateMatches.length >= 2;
  const hasArrivalTime = timeMatches.length >= 1;
  const hasDepartureTime = timeMatches.length >= 2;
  
  // Créer une clé unique pour ce pattern
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
  };
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

export const CleaningTypeMapperPage = ({ hotelId, onBack }: CleaningTypeMapperPageProps) => {
  const [lines, setLines] = useState<LineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState<LineData | null>(null);
  const [showOnlyRooms, setShowOnlyRooms] = useState(true);
  const [patternRules, setPatternRules] = useState<Map<string, 'a_blanc' | 'recouche' | 'none'>>(new Map());
  const [saving, setSaving] = useState(false);

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
        const rawLines = data.raw_text.split('\n').filter((l: string) => l.trim());
        const parsedLines: LineData[] = rawLines.map((raw: string, index: number) => {
          const roomNumber = extractRoomNumber(raw);
          const isHeader = isHeaderLine(raw);
          const pattern = extractPatternFromLine(raw);
          
          let fields: ExtractedFields | null = null;
          if (roomNumber && !isHeader) {
            const result = fieldExtractor.extractFromLine(raw, roomNumber);
            fields = result.fields;
          }
          
          return {
            index,
            raw,
            roomNumber,
            fields,
            pattern,
            cleaningType: null,
            isHeader,
          };
        });
        
        setLines(parsedLines);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur lors du chargement du rapport');
    } finally {
      setLoading(false);
    }
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

      // Créer les nouvelles règles
      const rulesToInsert: any[] = [];
      let priority = 100;
      
      patternRules.forEach((cleaningType, patternKey) => {
        const parts = patternKey.split('|');
        const statusPart = parts[0];
        const statusCodes = statusPart !== 'NO_STATUS' ? statusPart.split('+') : [];
        
        rulesToInsert.push({
          hotel_id: hotelId,
          rule_name: `Auto_${patternKey.replace(/\|/g, '_').substring(0, 30)}`,
          description: `Règle générée automatiquement`,
          priority: priority--,
          is_active: true,
          status_keywords: statusCodes,
          arrival_date: parts.includes('ARR_DATE') ? 'present' : 'any',
          departure_date: parts.includes('DEP_DATE') ? 'present' : 'any',
          arrival_time: parts.includes('ARR_TIME') ? 'present' : 'any',
          departure_time: parts.includes('DEP_TIME') ? 'present' : 'any',
          night_info: parts.includes('NIGHT') ? 'present' : 'any',
          result_cleaning_type: cleaningType,
        });
      });

      if (rulesToInsert.length > 0) {
        const { error } = await supabase
          .from('hotel_combination_rules')
          .insert(rulesToInsert);
        
        if (error) throw error;
      }

      toast.success(`${rulesToInsert.length} règles enregistrées`);
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

  const renderPatternBadges = (pattern: LinePattern) => {
    return (
      <div className="flex flex-wrap gap-1">
        {pattern.statusCodes.map(code => (
          <Badge key={code} variant="outline" className="text-[10px] py-0 px-1">
            {code}
          </Badge>
        ))}
        {pattern.hasArrivalDate && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-green-100">Date↓</Badge>
        )}
        {pattern.hasDepartureDate && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-orange-100">Date↑</Badge>
        )}
        {pattern.hasArrivalTime && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-blue-100">H↓</Badge>
        )}
        {pattern.hasDepartureTime && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-purple-100">H↑</Badge>
        )}
        {pattern.hasNightInfo && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-indigo-100">Nuit</Badge>
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
          <Button onClick={saveRules} disabled={saving || patternRules.size === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder les règles'}
          </Button>
        </div>
      </div>

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
                  {renderPatternBadges(selectedLine.pattern)}
                </div>

                {/* Full line */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ligne complète</p>
                  <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                    {selectedLine.raw}
                  </p>
                </div>

                {/* Fields extracted */}
                {selectedLine.fields && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Champs extraits</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedLine.fields.arrivalDate && (
                        <div className="bg-green-50 p-2 rounded">
                          <span className="text-muted-foreground">Arrivée:</span> {selectedLine.fields.arrivalDate}
                        </div>
                      )}
                      {selectedLine.fields.departureDate && (
                        <div className="bg-orange-50 p-2 rounded">
                          <span className="text-muted-foreground">Départ:</span> {selectedLine.fields.departureDate}
                        </div>
                      )}
                      {selectedLine.fields.arrivalTime && (
                        <div className="bg-blue-50 p-2 rounded">
                          <span className="text-muted-foreground">H. Arrivée:</span> {selectedLine.fields.arrivalTime}
                        </div>
                      )}
                      {selectedLine.fields.departureTime && (
                        <div className="bg-purple-50 p-2 rounded">
                          <span className="text-muted-foreground">H. Départ:</span> {selectedLine.fields.departureTime}
                        </div>
                      )}
                      {selectedLine.fields.nightInfo && (
                        <div className="bg-indigo-50 p-2 rounded col-span-2">
                          <span className="text-muted-foreground">Nuit:</span> {selectedLine.fields.nightInfo}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Assignment buttons */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Assigner ce pattern ({similarLines.size} chambres)
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
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          const firstLine = group.lines[0];
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
                          {assigned && (
                            <Badge className={
                              assigned === 'a_blanc' ? 'bg-red-500' : 'bg-blue-500'
                            }>
                              {assigned === 'a_blanc' ? 'B' : 'R'}
                            </Badge>
                          )}
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
            <span className="font-bold">B</span> = À blanc (complet)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="font-bold">R</span> = Recouche (rapide)
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-500"></div>
            <span className="font-bold">—</span> = Propre (aucun)
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-yellow-500" />
            = Lignes similaires
          </span>
        </div>
      </Card>
    </div>
  );
};
