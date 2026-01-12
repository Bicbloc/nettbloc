import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, ArrowRight, Map, Zap, Filter, X, Plus, 
  Info, Eye, AlertTriangle, Settings2, Columns, Ban
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

// Types de nettoyage disponibles
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc (Départ)', color: 'bg-orange-500', emoji: '🔶' },
  { value: 'recouche', label: 'Recouche (Occupé)', color: 'bg-green-500', emoji: '🔄' },
  { value: 'none', label: 'Pas de ménage', color: 'bg-gray-500', emoji: '⏸️' },
  { value: 'exclude', label: 'Exclure du rapport', color: 'bg-red-500', emoji: '🚫' },
];

// Patterns d'exclusion par défaut (lignes à ignorer)
const DEFAULT_EXCLUSION_PATTERNS = [
  'fermé à la vente',
  'hors service',
  'out of order',
  'ooo',
  'maintenance',
  'literie',
  'lit double',
  'lits simple',
  'non occ veille',
  'total',
  'page',
  'imprimé le',
  'date :',
  'http',
  'www.',
];

// Patterns de statut connus et leurs mappings par défaut
const KNOWN_STATUS_PATTERNS = {
  // Départs / À blanc
  departure: ['depart', 'départ', 'check-out', 'checkout', 'dep', 'parti', 'due out', 'libre', 'a blanc', 'à blanc', 'blanc', 'dirty', 'sal', 'sale'],
  // Recouches / Occupés
  stayover: ['recouche', 'stay', 'occ', 'occupé', 'occupe', 'pro', 'ins', 'arrivee', 'arrivée', 'arr', 'check-in', 'checkin', 'draps'],
  // Pas de ménage
  noService: ['dnd', 'do not disturb', 'no service', 'refus', 'decline', 'pas de ménage'],
};

interface ExtractedColumn {
  name: string;
  values: string[];
  uniqueValues: string[];
  position: number;
}

interface MappingRule {
  id: string;
  sourcePattern: string;
  sourceColumn?: string;
  targetCleaningType: string;
  priority: number;
  isActive: boolean;
}

interface AdvancedMappingStepProps {
  parsedLines: any[];
  pdfData: any[];
  fullText?: string;
  onComplete: (mappedData: any[], mapping: Record<string, string>, exclusions: string[]) => void;
  onBack: () => void;
  hotelId?: string;
}

export const AdvancedMappingStep: React.FC<AdvancedMappingStepProps> = ({
  parsedLines,
  pdfData,
  fullText = '',
  onComplete,
  onBack,
  hotelId,
}) => {
  const { toast } = useToast();
  
  // État du mapping
  const [keywordMapping, setKeywordMapping] = useState<Record<string, string>>({});
  const [exclusionPatterns, setExclusionPatterns] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [activeTab, setActiveTab] = useState<'keywords' | 'exclusions' | 'preview'>('keywords');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Détecter les colonnes et patterns dans le rapport
  const detectedPatterns = useMemo(() => {
    const patterns: Record<string, { count: number; examples: string[] }> = {};
    const allText = fullText + ' ' + parsedLines.map(l => l.fullText || l.statusCode || '').join(' ');
    const upperText = allText.toUpperCase();
    
    // Détecter les patterns de statut connus
    const allKnownPatterns = [
      ...KNOWN_STATUS_PATTERNS.departure,
      ...KNOWN_STATUS_PATTERNS.stayover,
      ...KNOWN_STATUS_PATTERNS.noService,
    ];
    
    allKnownPatterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'gi');
      const matches = upperText.match(regex);
      if (matches && matches.length > 0) {
        const normalizedPattern = pattern.toUpperCase();
        const existing = patterns[normalizedPattern];
        patterns[normalizedPattern] = {
          count: (existing?.count || 0) + matches.length,
          examples: existing?.examples || matches.slice(0, 3).map(m => m.toLowerCase()),
        };
      }
    });
    
    return patterns;
  }, [parsedLines, fullText]);

  // Mots-clés détectés triés par fréquence
  const detectedKeywords = useMemo(() => {
    return Object.entries(detectedPatterns)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        examples: data.examples,
      }));
  }, [detectedPatterns]);

  // Initialiser le mapping automatiquement
  useEffect(() => {
    if (detectedKeywords.length > 0 && Object.keys(keywordMapping).length === 0) {
      const initial: Record<string, string> = {};
      
      detectedKeywords.forEach(({ keyword }) => {
        const lowerKeyword = keyword.toLowerCase();
        
        if (KNOWN_STATUS_PATTERNS.departure.some(p => lowerKeyword.includes(p))) {
          initial[keyword] = 'a_blanc';
        } else if (KNOWN_STATUS_PATTERNS.stayover.some(p => lowerKeyword.includes(p))) {
          initial[keyword] = 'recouche';
        } else if (KNOWN_STATUS_PATTERNS.noService.some(p => lowerKeyword.includes(p))) {
          initial[keyword] = 'none';
        } else {
          initial[keyword] = 'recouche'; // Default
        }
      });
      
      setKeywordMapping(initial);
    }
  }, [detectedKeywords, keywordMapping]);

  // Initialiser les exclusions depuis localStorage
  useEffect(() => {
    if (hotelId) {
      const saved = localStorage.getItem(`pms_exclusions_${hotelId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setExclusionPatterns(parsed);
        } catch {
          setExclusionPatterns([...DEFAULT_EXCLUSION_PATTERNS]);
        }
      } else {
        setExclusionPatterns([...DEFAULT_EXCLUSION_PATTERNS]);
      }
    } else {
      setExclusionPatterns([...DEFAULT_EXCLUSION_PATTERNS]);
    }
  }, [hotelId]);

  // Sauvegarder les exclusions
  const saveExclusions = (patterns: string[]) => {
    setExclusionPatterns(patterns);
    if (hotelId) {
      localStorage.setItem(`pms_exclusions_${hotelId}`, JSON.stringify(patterns));
    }
  };

  // Ajouter une exclusion
  const addExclusion = () => {
    const trimmed = newExclusion.trim().toLowerCase();
    if (trimmed && !exclusionPatterns.includes(trimmed)) {
      saveExclusions([...exclusionPatterns, trimmed]);
      setNewExclusion('');
      toast({
        title: "Pattern ajouté",
        description: `"${trimmed}" sera ignoré lors de l'import.`,
      });
    }
  };

  // Supprimer une exclusion
  const removeExclusion = (pattern: string) => {
    saveExclusions(exclusionPatterns.filter(p => p !== pattern));
  };

  // Appliquer le mapping et les exclusions aux données
  const mappedData = useMemo(() => {
    if (!pdfData) return [];
    
    return pdfData
      .filter((room: any) => {
        // Vérifier si la ligne doit être exclue
        const fullText = (room.fullText || room.status || '').toLowerCase();
        const roomNumber = (room.roomNumber || room.room_number || '').toString();
        
        // Exclure si le roomNumber ressemble à un pattern d'exclusion
        for (const pattern of exclusionPatterns) {
          if (
            fullText.includes(pattern) || 
            roomNumber.toLowerCase().includes(pattern) ||
            (room.status && room.status.toLowerCase().includes(pattern))
          ) {
            return false;
          }
        }
        
        // Exclure les lignes sans numéro de chambre valide
        if (!roomNumber || !/^\d+/.test(roomNumber)) {
          return false;
        }
        
        return true;
      })
      .map((room: any) => {
        const fullText = (room.fullText || room.status || '').toUpperCase();
        let mappedType = room.cleaningType || 'recouche';
        let matchedKeyword = '';
        
        // Appliquer le mapping par ordre de priorité (keywords les plus longs d'abord)
        const sortedKeywords = Object.keys(keywordMapping)
          .sort((a, b) => b.length - a.length);
        
        for (const keyword of sortedKeywords) {
          if (fullText.includes(keyword)) {
            mappedType = keywordMapping[keyword];
            matchedKeyword = keyword;
            break;
          }
        }
        
        return {
          ...room,
          cleaningType: mappedType === 'exclude' ? null : mappedType,
          mappedKeyword: matchedKeyword,
          excluded: mappedType === 'exclude',
        };
      })
      .filter((room: any) => !room.excluded && room.cleaningType !== null);
  }, [pdfData, keywordMapping, exclusionPatterns]);

  // Statistiques
  const stats = useMemo(() => {
    const total = mappedData.length;
    const aBlancCount = mappedData.filter((r: any) => r.cleaningType === 'a_blanc').length;
    const recoucheCount = mappedData.filter((r: any) => r.cleaningType === 'recouche').length;
    const noneCount = mappedData.filter((r: any) => r.cleaningType === 'none').length;
    const excluded = (pdfData?.length || 0) - total;
    
    return { total, aBlancCount, recoucheCount, noneCount, excluded };
  }, [mappedData, pdfData]);

  // Auto-mapping
  const autoMap = () => {
    const newMapping: Record<string, string> = {};
    
    detectedKeywords.forEach(({ keyword }) => {
      const lowerKeyword = keyword.toLowerCase();
      
      if (KNOWN_STATUS_PATTERNS.departure.some(p => lowerKeyword.includes(p))) {
        newMapping[keyword] = 'a_blanc';
      } else if (KNOWN_STATUS_PATTERNS.stayover.some(p => lowerKeyword.includes(p))) {
        newMapping[keyword] = 'recouche';
      } else if (KNOWN_STATUS_PATTERNS.noService.some(p => lowerKeyword.includes(p))) {
        newMapping[keyword] = 'none';
      } else {
        newMapping[keyword] = 'recouche';
      }
    });
    
    setKeywordMapping(newMapping);
    toast({
      title: "✨ Mapping automatique",
      description: "Les correspondances ont été définies selon les patterns connus.",
    });
  };

  // Continuer
  const handleContinue = () => {
    onComplete(mappedData, keywordMapping, exclusionPatterns);
  };

  // Patterns suggérés à exclure depuis le rapport
  const suggestedExclusions = useMemo(() => {
    const suggestions: string[] = [];
    const allText = (fullText + ' ' + parsedLines.map(l => l.fullText || '').join(' ')).toLowerCase();
    
    DEFAULT_EXCLUSION_PATTERNS.forEach(pattern => {
      if (allText.includes(pattern) && !exclusionPatterns.includes(pattern)) {
        suggestions.push(pattern);
      }
    });
    
    return suggestions;
  }, [fullText, parsedLines, exclusionPatterns]);

  return (
    <div className="space-y-4">
      {/* Statistiques en haut */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="p-3 bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
            <p className="text-xs text-slate-600">Chambres</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-700">{stats.aBlancCount}</p>
            <p className="text-xs text-orange-600">À blanc</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-700">{stats.recoucheCount}</p>
            <p className="text-xs text-green-600">Recouche</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{stats.noneCount}</p>
            <p className="text-xs text-gray-600">Aucun</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-700">{stats.excluded}</p>
            <p className="text-xs text-red-600">Exclues</p>
          </div>
        </Card>
      </div>

      {/* Tabs pour les différentes sections */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="keywords" className="flex items-center gap-1">
            <Map className="h-4 w-4" />
            Mapping
          </TabsTrigger>
          <TabsTrigger value="exclusions" className="flex items-center gap-1">
            <Ban className="h-4 w-4" />
            Exclusions
            {exclusionPatterns.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{exclusionPatterns.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            Aperçu
          </TabsTrigger>
        </TabsList>

        {/* Tab Mapping */}
        <TabsContent value="keywords" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Correspondances des statuts
                </CardTitle>
                <Button size="sm" variant="outline" onClick={autoMap}>
                  <Zap className="h-4 w-4 mr-1" />
                  Auto
                </Button>
              </div>
              <CardDescription>
                Associez chaque mot-clé détecté à un type de nettoyage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detectedKeywords.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun mot-clé de statut détecté dans le rapport.</p>
                  <p className="text-xs mt-1">Le mapping par défaut sera utilisé.</p>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3 pr-2">
                    {detectedKeywords.map(({ keyword, count }) => (
                      <div 
                        key={keyword} 
                        className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-bold">
                            {keyword}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ({count}×)
                          </span>
                        </div>
                        <Select
                          value={keywordMapping[keyword] || 'recouche'}
                          onValueChange={(v) => setKeywordMapping(prev => ({ ...prev, [keyword]: v }))}
                        >
                          <SelectTrigger className="w-44 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CLEANING_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <span>{type.emoji}</span>
                                  <span>{type.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Exclusions */}
        <TabsContent value="exclusions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Patterns à exclure
              </CardTitle>
              <CardDescription>
                Les lignes contenant ces patterns seront ignorées lors de l'import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input pour ajouter */}
              <div className="flex gap-2">
                <Input
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  placeholder="Ex: fermé à la vente, hors service..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExclusion();
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={addExclusion}
                  disabled={!newExclusion.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Liste des exclusions */}
              <ScrollArea className="h-[180px]">
                <div className="flex flex-wrap gap-2">
                  {exclusionPatterns.map((pattern) => (
                    <Badge
                      key={pattern}
                      variant="secondary"
                      className="pl-3 pr-1 py-1.5 flex items-center gap-1 bg-red-50 text-red-700 border-red-200"
                    >
                      <span>{pattern}</span>
                      <button
                        onClick={() => removeExclusion(pattern)}
                        className="ml-1 hover:bg-red-200 rounded p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>

              {/* Suggestions */}
              {suggestedExclusions.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Patterns détectés dans le rapport (cliquez pour ajouter)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedExclusions.slice(0, 10).map((pattern) => (
                      <Badge
                        key={pattern}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted transition-colors text-xs"
                        onClick={() => {
                          saveExclusions([...exclusionPatterns, pattern]);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Aperçu */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Aperçu des chambres ({mappedData.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {mappedData.slice(0, 50).map((room: any, idx: number) => {
                    const typeConfig = CLEANING_TYPES.find(t => t.value === room.cleaningType);
                    
                    return (
                      <div
                        key={`${room.roomNumber || room.room_number}-${idx}`}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          room.cleaningType === 'a_blanc' 
                            ? 'bg-orange-50/50 border-orange-200' 
                            : room.cleaningType === 'recouche'
                              ? 'bg-green-50/50 border-green-200'
                              : 'bg-gray-50/50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg">
                            {room.roomNumber || room.room_number}
                          </span>
                          {room.mappedKeyword && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {room.mappedKeyword}
                            </Badge>
                          )}
                        </div>
                        <Badge className={`${typeConfig?.color || 'bg-gray-500'} text-white`}>
                          {typeConfig?.emoji} {typeConfig?.label.split(' ')[0] || room.cleaningType}
                        </Badge>
                      </div>
                    );
                  })}
                  
                  {mappedData.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ... et {mappedData.length - 50} autres chambres
                    </p>
                  )}
                  
                  {mappedData.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Aucune chambre après filtrage</p>
                      <p className="text-xs mt-1">Vérifiez vos exclusions</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info */}
      {stats.excluded > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {stats.excluded} ligne(s) exclue(s) grâce aux patterns d'exclusion.
            Ces lignes ne seront pas importées.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={mappedData.length === 0}
        >
          Appliquer et continuer
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default AdvancedMappingStep;
