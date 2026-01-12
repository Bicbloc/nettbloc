import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, ArrowRight, Columns, Eye, Plus, Trash2, Zap, 
  Settings2, Ban, CheckCircle, Filter, AlertTriangle, Combine,
  GripVertical
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types de nettoyage disponibles
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc (Départ)', color: 'bg-orange-500', emoji: '🔶' },
  { value: 'recouche', label: 'Recouche (Occupé)', color: 'bg-green-500', emoji: '🔄' },
  { value: 'none', label: 'Pas de ménage', color: 'bg-gray-500', emoji: '⏸️' },
];

// Patterns connus pour différents PMS
const KNOWN_PATTERNS = {
  departure: ['depart', 'départ', 'parti', 'check-out', 'checkout', 'due out', 'dep', 'sal', 'sale', 'dirty', 'a blanc', 'blanc', 'libre'],
  stayover: ['recouche', 'stay', 'occ', 'occupé', 'pro', 'ins', 'arrivee', 'arrivée', 'arr', 'check-in', 'draps', 'x'],
  noService: ['dnd', 'do not disturb', 'refus', 'ooo', 'hors service', 'maintenance', 'fermé'],
  exclude: ['fermé à la vente', 'literie', 'lit double', 'lits simple', 'total', 'page', 'imprimé']
};

interface DetectedColumn {
  id: string;
  name: string;
  values: string[];
  uniqueValues: string[];
  isIncluded: boolean;
  isMappingColumn: boolean; // Colonne utilisée pour déterminer le type de nettoyage
  position: number;
}

interface CombinationRule {
  id: string;
  conditions: { columnId: string; value: string }[];
  result: 'a_blanc' | 'recouche' | 'none';
  priority: number;
}

interface ColumnBasedMappingStepProps {
  parsedLines: any[];
  pdfData: any[];
  fullText?: string;
  onComplete: (mappedData: any[], config: MappingConfig) => void;
  onBack: () => void;
  hotelId?: string;
}

interface MappingConfig {
  columns: DetectedColumn[];
  rules: CombinationRule[];
  exclusions: string[];
  simpleMapping: Record<string, string>;
}

export const ColumnBasedMappingStep: React.FC<ColumnBasedMappingStepProps> = ({
  parsedLines,
  pdfData,
  fullText = '',
  onComplete,
  onBack,
  hotelId,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'columns' | 'rules' | 'preview'>('columns');
  const [columns, setColumns] = useState<DetectedColumn[]>([]);
  const [rules, setRules] = useState<CombinationRule[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [simpleMapping, setSimpleMapping] = useState<Record<string, string>>({});

  // Détecter les colonnes depuis le texte brut et les données parsées
  const detectedColumns = useMemo(() => {
    const columnsMap = new Map<string, { values: string[]; position: number }>();
    
    // Analyser les données parsées
    if (pdfData && pdfData.length > 0) {
      const firstRoom = pdfData[0];
      const possibleColumns = [
        { key: 'status', name: 'Statut/État' },
        { key: 'statusCode', name: 'Code Statut' },
        { key: 'roomType', name: 'Type de chambre' },
        { key: 'type', name: 'Type' },
        { key: 'arrivalDate', name: 'Date arrivée' },
        { key: 'departureDate', name: 'Date départ' },
        { key: 'guestName', name: 'Nom client' },
        { key: 'notes', name: 'Notes' },
        { key: 'memo', name: 'Mémo' },
        { key: 'assignedTo', name: 'Assigné à' },
        { key: 'action', name: 'Action' },
        { key: 'state', name: 'État chambre' },
        { key: 'nbPersons', name: 'Nb personnes' },
        { key: 'dayuse', name: 'Day use' },
        { key: 'recoucheBlanc', name: 'Recouche/Blanc' },
      ];

      let position = 0;
      possibleColumns.forEach(({ key, name }) => {
        const values: string[] = [];
        pdfData.forEach((room: any) => {
          const value = room[key] || room[key.toLowerCase()] || '';
          if (value && typeof value === 'string' && value.trim()) {
            values.push(value.trim().toUpperCase());
          }
        });
        
        if (values.length > 0) {
          columnsMap.set(name, { values, position: position++ });
        }
      });
    }

    // Analyser le fullText pour détecter des colonnes additionnelles
    const lines = fullText.split('\n').filter(l => l.trim());
    const headerPatterns = [
      /ETAT|ÉTAT|STATUS/i,
      /MEMO|MÉMO|NOTE/i,
      /ARR|ARRIVÉE|ARRIVAL/i,
      /DEP|DÉPART|DEPARTURE/i,
      /DATE/i,
      /CHAMBRE|ROOM/i,
      /RECOUCHE|BLANC/i,
      /ACTION/i,
      /ASSIGNÉ|ASSIGNED/i,
      /ÉTAT DE LA CHAMBRE/i,
    ];

    // Créer les colonnes détectées
    const detected: DetectedColumn[] = [];
    columnsMap.forEach((data, name) => {
      const uniqueValues = [...new Set(data.values)].slice(0, 20);
      detected.push({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        values: data.values,
        uniqueValues,
        isIncluded: true,
        isMappingColumn: name.toLowerCase().includes('stat') || 
                         name.toLowerCase().includes('état') ||
                         name.toLowerCase().includes('recouche') ||
                         name.toLowerCase().includes('blanc'),
        position: data.position,
      });
    });

    return detected.sort((a, b) => a.position - b.position);
  }, [pdfData, fullText]);

  // Détecter les valeurs uniques pour le mapping simple
  const detectedValues = useMemo(() => {
    const values = new Set<string>();
    
    detectedColumns.forEach(col => {
      if (col.isMappingColumn) {
        col.uniqueValues.forEach(v => values.add(v));
      }
    });

    // Analyser aussi le fullText pour les patterns courts (INS, PRO, SAL, etc.)
    const shortCodes = ['INS', 'PRO', 'SAL', 'DEP', 'DIR', 'OOO', 'VAC', 'OCC', 'ARR', 'DND'];
    const upperText = fullText.toUpperCase();
    shortCodes.forEach(code => {
      if (upperText.includes(code)) {
        values.add(code);
      }
    });

    // Ajouter les valeurs détectées dans parsedLines
    parsedLines.forEach(line => {
      const status = (line.status || line.statusCode || '').toUpperCase();
      if (status) values.add(status);
    });

    return Array.from(values).filter(v => v.length > 0 && v.length < 30);
  }, [detectedColumns, fullText, parsedLines]);

  // Initialiser le mapping
  useEffect(() => {
    if (detectedValues.length > 0 && Object.keys(simpleMapping).length === 0) {
      const initial: Record<string, string> = {};
      
      detectedValues.forEach(value => {
        const lower = value.toLowerCase();
        
        if (KNOWN_PATTERNS.departure.some(p => lower.includes(p))) {
          initial[value] = 'a_blanc';
        } else if (KNOWN_PATTERNS.stayover.some(p => lower.includes(p))) {
          initial[value] = 'recouche';
        } else if (KNOWN_PATTERNS.noService.some(p => lower.includes(p))) {
          initial[value] = 'none';
        } else {
          initial[value] = 'recouche';
        }
      });
      
      setSimpleMapping(initial);
    }
  }, [detectedValues]);

  // Initialiser les colonnes
  useEffect(() => {
    if (detectedColumns.length > 0 && columns.length === 0) {
      setColumns(detectedColumns);
    }
  }, [detectedColumns]);

  // Initialiser les exclusions depuis localStorage
  useEffect(() => {
    if (hotelId) {
      const saved = localStorage.getItem(`pms_column_exclusions_${hotelId}`);
      if (saved) {
        try {
          setExclusions(JSON.parse(saved));
        } catch {
          setExclusions([...KNOWN_PATTERNS.exclude]);
        }
      } else {
        setExclusions([...KNOWN_PATTERNS.exclude]);
      }
    } else {
      setExclusions([...KNOWN_PATTERNS.exclude]);
    }
  }, [hotelId]);

  // Toggle colonne incluse/exclue
  const toggleColumn = (columnId: string) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, isIncluded: !col.isIncluded } : col
    ));
  };

  // Toggle colonne de mapping
  const toggleMappingColumn = (columnId: string) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, isMappingColumn: !col.isMappingColumn } : col
    ));
  };

  // Ajouter une exclusion
  const addExclusion = () => {
    const trimmed = newExclusion.trim().toLowerCase();
    if (trimmed && !exclusions.includes(trimmed)) {
      const updated = [...exclusions, trimmed];
      setExclusions(updated);
      if (hotelId) {
        localStorage.setItem(`pms_column_exclusions_${hotelId}`, JSON.stringify(updated));
      }
      setNewExclusion('');
      toast({ title: "Pattern ajouté", description: `"${trimmed}" sera exclu.` });
    }
  };

  // Supprimer une exclusion
  const removeExclusion = (pattern: string) => {
    const updated = exclusions.filter(e => e !== pattern);
    setExclusions(updated);
    if (hotelId) {
      localStorage.setItem(`pms_column_exclusions_${hotelId}`, JSON.stringify(updated));
    }
  };

  // Ajouter une règle de combinaison
  const addCombinationRule = () => {
    const newRule: CombinationRule = {
      id: `rule_${Date.now()}`,
      conditions: [],
      result: 'a_blanc',
      priority: rules.length + 1,
    };
    setRules(prev => [...prev, newRule]);
  };

  // Supprimer une règle
  const removeRule = (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  // Mettre à jour une règle
  const updateRule = (ruleId: string, updates: Partial<CombinationRule>) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  };

  // Auto-mapping
  const autoMap = () => {
    const newMapping: Record<string, string> = {};
    
    detectedValues.forEach(value => {
      const lower = value.toLowerCase();
      
      if (KNOWN_PATTERNS.departure.some(p => lower.includes(p))) {
        newMapping[value] = 'a_blanc';
      } else if (KNOWN_PATTERNS.stayover.some(p => lower.includes(p))) {
        newMapping[value] = 'recouche';
      } else if (KNOWN_PATTERNS.noService.some(p => lower.includes(p))) {
        newMapping[value] = 'none';
      } else {
        newMapping[value] = 'recouche';
      }
    });
    
    setSimpleMapping(newMapping);
    toast({
      title: "✨ Mapping automatique",
      description: "Les correspondances ont été définies selon les patterns connus.",
    });
  };

  // Appliquer le mapping aux données
  const mappedData = useMemo(() => {
    if (!pdfData) return [];
    
    return pdfData
      .filter((room: any) => {
        // Vérifier les exclusions
        const fullText = (room.fullText || room.status || '').toLowerCase();
        const roomNumber = (room.roomNumber || room.room_number || '').toString();
        
        for (const pattern of exclusions) {
          if (fullText.includes(pattern) || roomNumber.toLowerCase().includes(pattern)) {
            return false;
          }
        }
        
        // Valider le numéro de chambre
        if (!roomNumber || !/^\d+/.test(roomNumber)) {
          return false;
        }
        
        return true;
      })
      .map((room: any) => {
        const roomText = (room.fullText || room.status || room.statusCode || '').toUpperCase();
        let mappedType = room.cleaningType || 'recouche';
        let matchedValue = '';
        
        // Appliquer le mapping simple (par ordre de longueur décroissante)
        const sortedKeys = Object.keys(simpleMapping).sort((a, b) => b.length - a.length);
        
        for (const key of sortedKeys) {
          if (roomText.includes(key)) {
            mappedType = simpleMapping[key];
            matchedValue = key;
            break;
          }
        }
        
        // TODO: Appliquer les règles de combinaison si définies
        
        return {
          ...room,
          cleaningType: mappedType,
          matchedValue,
        };
      });
  }, [pdfData, simpleMapping, exclusions]);

  // Statistiques
  const stats = useMemo(() => {
    const total = mappedData.length;
    const aBlancCount = mappedData.filter((r: any) => r.cleaningType === 'a_blanc').length;
    const recoucheCount = mappedData.filter((r: any) => r.cleaningType === 'recouche').length;
    const noneCount = mappedData.filter((r: any) => r.cleaningType === 'none').length;
    const excluded = (pdfData?.length || 0) - total;
    
    return { total, aBlancCount, recoucheCount, noneCount, excluded };
  }, [mappedData, pdfData]);

  // Continuer
  const handleContinue = () => {
    const config: MappingConfig = {
      columns,
      rules,
      exclusions,
      simpleMapping,
    };
    
    // Sauvegarder la config pour l'hôtel
    if (hotelId) {
      localStorage.setItem(`pms_mapping_config_${hotelId}`, JSON.stringify(config));
    }
    
    onComplete(mappedData, config);
  };

  return (
    <div className="space-y-4">
      {/* Statistiques */}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="columns" className="flex items-center gap-1">
            <Columns className="h-4 w-4" />
            Colonnes & Mapping
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1">
            <Combine className="h-4 w-4" />
            Combinaisons
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            Aperçu
          </TabsTrigger>
        </TabsList>

        {/* Tab Colonnes & Mapping */}
        <TabsContent value="columns" className="mt-4 space-y-4">
          {/* Mapping simple des valeurs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Correspondance des valeurs
                </CardTitle>
                <Button size="sm" variant="outline" onClick={autoMap}>
                  <Zap className="h-4 w-4 mr-1" />
                  Auto
                </Button>
              </div>
              <CardDescription>
                Associez chaque valeur détectée à un type de nettoyage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-2">
                  {detectedValues.map(value => (
                    <div 
                      key={value}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <Badge variant="outline" className="font-mono font-bold">
                        {value}
                      </Badge>
                      <Select
                        value={simpleMapping[value] || 'recouche'}
                        onValueChange={(v) => setSimpleMapping(prev => ({ ...prev, [value]: v }))}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLEANING_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <span>{type.emoji}</span>
                                <span className="text-sm">{type.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {detectedValues.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune valeur de statut détectée</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Exclusions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Patterns à exclure
              </CardTitle>
              <CardDescription>
                Les lignes contenant ces patterns seront ignorées
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  placeholder="Ex: fermé à la vente, literie..."
                  onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
                  className="flex-1"
                />
                <Button size="sm" onClick={addExclusion}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {exclusions.map(pattern => (
                  <Badge 
                    key={pattern} 
                    variant="secondary"
                    className="flex items-center gap-1 cursor-pointer hover:bg-destructive/20"
                    onClick={() => removeExclusion(pattern)}
                  >
                    {pattern}
                    <Trash2 className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Combinaisons */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Combine className="h-4 w-4" />
                  Règles de combinaison
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addCombinationRule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              <CardDescription>
                Créez des règles basées sur plusieurs colonnes (ex: statut + date)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Combine className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune règle de combinaison</p>
                  <p className="text-xs mt-1">
                    Le mapping simple sera utilisé par défaut
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map(rule => (
                    <Card key={rule.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-muted-foreground">Si</span>
                            {rule.conditions.length === 0 ? (
                              <Badge variant="outline">+ Ajouter condition</Badge>
                            ) : (
                              rule.conditions.map((cond, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <span className="text-xs">ET</span>}
                                  <Badge variant="secondary">
                                    {cond.columnId} = "{cond.value}"
                                  </Badge>
                                </React.Fragment>
                              ))
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Alors →</span>
                            <Select
                              value={rule.result}
                              onValueChange={(v: any) => updateRule(rule.id, { result: v })}
                            >
                              <SelectTrigger className="w-40 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CLEANING_TYPES.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <span>{type.emoji} {type.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
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
                Aperçu des données mappées
              </CardTitle>
              <CardDescription>
                {mappedData.length} chambres après exclusions et mapping
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">N°</TableHead>
                      <TableHead>Données brutes</TableHead>
                      <TableHead className="w-32">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedData.slice(0, 50).map((room: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-bold">
                          {room.roomNumber || room.room_number}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {room.fullText || room.status || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={
                              room.cleaningType === 'a_blanc' ? 'bg-orange-100 text-orange-700' :
                              room.cleaningType === 'recouche' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }
                          >
                            {room.cleaningType === 'a_blanc' ? '🔶 À blanc' :
                             room.cleaningType === 'recouche' ? '🔄 Recouche' : '⏸️ Aucun'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {mappedData.length > 50 && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    ... et {mappedData.length - 50} autres chambres
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button onClick={handleContinue}>
          Continuer
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default ColumnBasedMappingStep;
