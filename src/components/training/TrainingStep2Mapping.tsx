import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, ArrowRight, Map, Zap, Filter, X, Plus, 
  Info, Eye, AlertTriangle, Settings2, Ban, Sparkles
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';
import { ExtractedRoom, normalizeCleaningType } from '@/services/pms/types';

// Types de nettoyage disponibles
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc (Départ)', color: 'bg-orange-500', textColor: 'text-orange-700', emoji: '🔶' },
  { value: 'recouche', label: 'Recouche (Occupé)', color: 'bg-green-500', textColor: 'text-green-700', emoji: '🔄' },
  { value: 'none', label: 'Pas de ménage', color: 'bg-gray-500', textColor: 'text-gray-700', emoji: '⏸️' },
  { value: 'exclude', label: 'Exclure', color: 'bg-red-500', textColor: 'text-red-700', emoji: '🚫' },
];

// Patterns d'exclusion par défaut
const DEFAULT_EXCLUSION_PATTERNS = [
  'fermé à la vente', 'hors service', 'out of order', 'ooo',
  'maintenance', 'total', 'page', 'imprimé le', 'date :',
  'http', 'www.', 'literie', 'non occ veille'
];

// Patterns de statut connus et leurs mappings par défaut
const KNOWN_STATUS_PATTERNS: Record<string, { keywords: string[], defaultType: string }> = {
  departure: {
    keywords: ['depart', 'départ', 'checkout', 'check-out', 'dep', 'parti', 'due out', 'libre', 'a blanc', 'à blanc', 'blanc', 'dirty', 'sal', 'sale'],
    defaultType: 'a_blanc'
  },
  stayover: {
    keywords: ['recouche', 'stay', 'occ', 'occupé', 'occupe', 'pro', 'ins', 'arrivee', 'arrivée', 'arr', 'check-in', 'checkin', 'draps', 'en séjour', 'en sejour'],
    defaultType: 'recouche'
  },
  noService: {
    keywords: ['dnd', 'do not disturb', 'no service', 'refus', 'decline', 'pas de ménage', 'propre', 'clean', 'fait'],
    defaultType: 'none'
  },
};

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
  
  // État du mapping
  const [keywordMapping, setKeywordMapping] = useState<Record<string, string>>({});
  const [exclusionPatterns, setExclusionPatterns] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [activeTab, setActiveTab] = useState<'keywords' | 'exclusions' | 'preview'>('keywords');

  // Analyser le texte brut pour détecter les patterns
  const detectedPatterns = useMemo(() => {
    const patterns: Record<string, { count: number; contexts: string[] }> = {};
    const text = trainingData.rawText.toUpperCase();
    
    // Collecter tous les patterns connus
    const allPatterns: string[] = [];
    Object.values(KNOWN_STATUS_PATTERNS).forEach(({ keywords }) => {
      allPatterns.push(...keywords.map(k => k.toUpperCase()));
    });
    
    // Compter les occurrences et collecter des exemples de contexte
    allPatterns.forEach(pattern => {
      const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        // Trouver des exemples de contexte
        const contexts: string[] = [];
        const lines = trainingData.rawText.split('\n');
        for (const line of lines) {
          if (line.toUpperCase().includes(pattern) && contexts.length < 2) {
            contexts.push(line.trim().substring(0, 80));
          }
        }
        
        patterns[pattern] = {
          count: matches.length,
          contexts
        };
      }
    });
    
    return patterns;
  }, [trainingData.rawText]);

  // Mots-clés détectés triés par fréquence
  const detectedKeywords = useMemo(() => {
    return Object.entries(detectedPatterns)
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([_, data]) => data.count > 0)
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        contexts: data.contexts,
      }));
  }, [detectedPatterns]);

  // Initialiser le mapping automatiquement
  useEffect(() => {
    if (detectedKeywords.length > 0 && Object.keys(keywordMapping).length === 0) {
      autoMapKeywords();
    }
  }, [detectedKeywords]);

  // Initialiser les exclusions depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`training_exclusions_${hotelId}`);
    if (saved) {
      try {
        setExclusionPatterns(JSON.parse(saved));
      } catch {
        setExclusionPatterns([...DEFAULT_EXCLUSION_PATTERNS]);
      }
    } else {
      setExclusionPatterns([...DEFAULT_EXCLUSION_PATTERNS]);
    }
  }, [hotelId]);

  // Auto-mapping intelligent
  const autoMapKeywords = () => {
    const newMapping: Record<string, string> = {};
    
    detectedKeywords.forEach(({ keyword }) => {
      const lowerKeyword = keyword.toLowerCase();
      let found = false;
      
      for (const [, config] of Object.entries(KNOWN_STATUS_PATTERNS)) {
        if (config.keywords.some(p => lowerKeyword.includes(p.toLowerCase()))) {
          newMapping[keyword] = config.defaultType;
          found = true;
          break;
        }
      }
      
      if (!found) {
        newMapping[keyword] = 'recouche'; // Default
      }
    });
    
    setKeywordMapping(newMapping);
  };

  // Sauvegarder les exclusions
  const saveExclusions = (patterns: string[]) => {
    setExclusionPatterns(patterns);
    localStorage.setItem(`training_exclusions_${hotelId}`, JSON.stringify(patterns));
  };

  const addExclusion = () => {
    const trimmed = newExclusion.trim().toLowerCase();
    if (trimmed && !exclusionPatterns.includes(trimmed)) {
      saveExclusions([...exclusionPatterns, trimmed]);
      setNewExclusion('');
      toast({ title: "Pattern ajouté", description: `"${trimmed}" sera ignoré.` });
    }
  };

  const removeExclusion = (pattern: string) => {
    saveExclusions(exclusionPatterns.filter(p => p !== pattern));
  };

  // Appliquer le mapping aux chambres
  const mappedRooms = useMemo(() => {
    return trainingData.extractedRooms
      .filter((room) => {
        // Exclure selon les patterns
        const fullText = (room.originalText || '').toLowerCase();
        const roomNumber = room.roomNumber.toLowerCase();
        
        for (const pattern of exclusionPatterns) {
          if (fullText.includes(pattern) || roomNumber.includes(pattern)) {
            return false;
          }
        }
        
        // Exclure les lignes sans numéro valide
        if (!room.roomNumber || !/^\d+/.test(room.roomNumber)) {
          return false;
        }
        
        return true;
      })
      .map((room) => {
        const fullText = (room.originalText || '').toUpperCase();
        let mappedType = room.cleaningType || 'recouche';
        let matchedKeyword = '';
        
        // Appliquer le mapping (keywords les plus longs d'abord)
        const sortedKeywords = Object.keys(keywordMapping)
          .sort((a, b) => b.length - a.length);
        
        for (const keyword of sortedKeywords) {
          if (fullText.includes(keyword)) {
            const mappedValue = keywordMapping[keyword];
            if (mappedValue !== 'exclude') {
              mappedType = mappedValue as 'a_blanc' | 'recouche' | 'none';
              matchedKeyword = keyword;
            }
            break;
          }
        }
        
        return {
          ...room,
          cleaningType: normalizeCleaningType(mappedType as any) as any,
          _matchedKeyword: matchedKeyword,
        } as ExtractedRoom;
      });
  }, [trainingData.extractedRooms, keywordMapping, exclusionPatterns]);

  // Statistiques
  const stats = useMemo(() => {
    const total = mappedRooms.length;
    const aBlancCount = mappedRooms.filter(r => r.cleaningType === 'a_blanc').length;
    const recoucheCount = mappedRooms.filter(r => r.cleaningType === 'recouche').length;
    const noneCount = mappedRooms.filter(r => r.cleaningType === 'none').length;
    const excluded = trainingData.extractedRooms.length - total;
    
    return { total, aBlancCount, recoucheCount, noneCount, excluded };
  }, [mappedRooms, trainingData.extractedRooms]);

  // Continuer
  const handleContinue = () => {
    onComplete(mappedRooms, keywordMapping, exclusionPatterns);
  };

  return (
    <div className="space-y-4">
      {/* Header avec info PMS */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            PMS détecté: <Badge variant="secondary">{trainingData.detectedPmsType.toUpperCase()}</Badge>
            {' '}• {trainingData.extractedRooms.length} lignes extraites
          </span>
          <Button size="sm" variant="outline" onClick={autoMapKeywords}>
            <Zap className="h-4 w-4 mr-1" />
            Auto-mapper
          </Button>
        </AlertDescription>
      </Alert>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="p-3 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.total}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Chambres</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/30 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.aBlancCount}</p>
            <p className="text-xs text-orange-600 dark:text-orange-500">À blanc</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.recoucheCount}</p>
            <p className="text-xs text-green-600 dark:text-green-500">Recouche</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.noneCount}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Aucun</p>
          </div>
        </Card>
        <Card className="p-3 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20 border-red-200 dark:border-red-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.excluded}</p>
            <p className="text-xs text-red-600 dark:text-red-500">Exclues</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="keywords" className="flex items-center gap-1">
            <Map className="h-4 w-4" />
            Mapping ({detectedKeywords.length})
          </TabsTrigger>
          <TabsTrigger value="exclusions" className="flex items-center gap-1">
            <Ban className="h-4 w-4" />
            Exclusions ({exclusionPatterns.length})
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
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Correspondances des statuts PMS
              </CardTitle>
              <CardDescription>
                Associez chaque mot-clé détecté dans votre rapport à un type de nettoyage.
                Cela permettra de reconnaître automatiquement les combinaisons similaires.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detectedKeywords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Aucun mot-clé de statut détecté</p>
                  <p className="text-sm mt-1">Le mapping par défaut sera utilisé.</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-2">
                    {detectedKeywords.map(({ keyword, count, contexts }) => (
                      <div 
                        key={keyword} 
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono font-bold shrink-0">
                              {keyword}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({count} occurrences)
                            </span>
                          </div>
                          {contexts.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              Ex: {contexts[0]}
                            </p>
                          )}
                        </div>
                        <Select
                          value={keywordMapping[keyword] || 'recouche'}
                          onValueChange={(v) => setKeywordMapping(prev => ({ ...prev, [keyword]: v }))}
                        >
                          <SelectTrigger className="w-40 h-9">
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
                Les lignes contenant ces patterns seront ignorées (en-têtes, totaux, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input pour ajouter */}
              <div className="flex gap-2">
                <Input
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  placeholder="Ex: fermé à la vente, total..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExclusion())}
                />
                <Button onClick={addExclusion} size="icon" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Liste des exclusions */}
              <ScrollArea className="h-[250px]">
                <div className="flex flex-wrap gap-2">
                  {exclusionPatterns.map((pattern) => (
                    <Badge
                      key={pattern}
                      variant="secondary"
                      className="pl-2 pr-1 py-1 flex items-center gap-1 hover:bg-destructive/10"
                    >
                      <span className="text-xs">{pattern}</span>
                      <button
                        onClick={() => removeExclusion(pattern)}
                        className="ml-1 hover:text-destructive rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Preview */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Aperçu des chambres mappées
              </CardTitle>
              <CardDescription>
                Vérifiez que les types de nettoyage sont correctement assignés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-1">
                  {mappedRooms.slice(0, 50).map((room, idx) => {
                    const typeConfig = CLEANING_TYPES.find(t => t.value === room.cleaningType) || CLEANING_TYPES[1];
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between gap-2 p-2 rounded border bg-background hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="font-mono font-bold shrink-0">
                            {room.roomNumber}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">
                            {room.originalText?.substring(0, 40)}...
                          </span>
                        </div>
                        <Badge className={`${typeConfig.color} text-white shrink-0`}>
                          {typeConfig.emoji} {typeConfig.label.split(' ')[0]}
                        </Badge>
                      </div>
                    );
                  })}
                  {mappedRooms.length > 50 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      ... et {mappedRooms.length - 50} autres chambres
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button onClick={handleContinue} className="gap-2">
          Continuer vers la vérification
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
