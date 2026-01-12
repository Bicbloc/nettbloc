import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowRight, Columns, Eye, Plus, Trash2, Zap, 
  Settings2, Ban, Edit2, Save, X, Layers
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';

// Types de nettoyage
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-100' },
  { value: 'recouche', label: 'Recouche', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-100' },
  { value: 'none', label: 'Aucun', color: 'bg-gray-500', textColor: 'text-gray-700', bgLight: 'bg-gray-100' },
  { value: 'hors_service', label: 'Hors service', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-100' },
  { value: 'exclude', label: 'Exclure', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-100' },
];

// Patterns connus pour l'auto-mapping
const KNOWN_PATTERNS = {
  a_blanc: ['depart', 'départ', 'parti', 'check-out', 'checkout', 'due out', 'dep', 'sal', 'sale', 'dirty', 'a blanc', 'blanc', 'libre', 'vac', 'vacant'],
  recouche: ['recouche', 'stay', 'occ', 'occupé', 'pro', 'ins', 'arrivee', 'arrivée', 'arr', 'check-in', 'draps', 'stayover'],
  none: ['no service', 'pas de ménage', 'refus'],
  hors_service: ['dnd', 'do not disturb', 'ooo', 'hors service', 'maintenance', 'out of order', 'fermé'],
  exclude: ['fermé à la vente', 'literie', 'lit double', 'lits simple', 'total', 'page', 'imprimé', 'non occ veille']
};

interface ParsedTableRow {
  roomNumber: string;
  columns: string[];
  rawLine: string;
  combinationKey?: string;
  cleaningType?: string;
}

interface DetectedColumn {
  index: number;
  name: string;
  isIncluded: boolean;
  uniqueValues: string[];
}

interface CombinationRule {
  key: string;
  values: string[];
  cleaningType: string;
  count: number;
}

interface TrainingStep1bColumnMappingProps {
  trainingData: TrainingData;
  onComplete: (updatedData: TrainingData, mappingConfig: MappingConfig) => void;
  onBack: () => void;
  hotelId: string;
}

export interface MappingConfig {
  columns: DetectedColumn[];
  combinationRules: Record<string, string>;
  exclusions: string[];
}

export const TrainingStep1bColumnMapping: React.FC<TrainingStep1bColumnMappingProps> = ({
  trainingData,
  onComplete,
  onBack,
  hotelId,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'columns' | 'combinations' | 'exclusions'>('columns');
  const [columns, setColumns] = useState<DetectedColumn[]>([]);
  const [combinationRules, setCombinationRules] = useState<Record<string, string>>({});
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');

  // Parser le texte brut en tableau
  const parsedTable = useMemo(() => {
    const rows: ParsedTableRow[] = [];
    const lines = trainingData.rawText.split('\n').filter(l => l.trim());
    
    // Regex pour détecter les numéros de chambre
    const roomNumberRegex = /^(\d{1,4}[A-Z]?(?:\s*[-+\/]\s*\d{1,4}[A-Z]?)?)\s+/i;
    
    let currentRoomLine = '';
    let currentRoomNumber = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(roomNumberRegex);
      
      if (match) {
        if (currentRoomNumber) {
          const cols = currentRoomLine.split(/\s{2,}|\t/).filter(c => c.trim());
          rows.push({
            roomNumber: currentRoomNumber,
            columns: cols.slice(1),
            rawLine: currentRoomLine,
          });
        }
        currentRoomNumber = match[1].trim();
        currentRoomLine = trimmed;
      } else if (currentRoomNumber) {
        currentRoomLine += ' ' + trimmed;
      }
    }
    
    if (currentRoomNumber) {
      const cols = currentRoomLine.split(/\s{2,}|\t/).filter(c => c.trim());
      rows.push({
        roomNumber: currentRoomNumber,
        columns: cols.slice(1),
        rawLine: currentRoomLine,
      });
    }
    
    return rows;
  }, [trainingData.rawText]);

  // Détecter intelligemment le type de colonne
  const detectColumnType = (values: string[]): string => {
    const samples = values.slice(0, 20);
    
    // Statuts PMS
    const statusKeywords = ['ins', 'pro', 'sal', 'dir', 'occ', 'vac', 'dep', 'arr', 'dirty', 'clean', 'depart', 'recouche', 'parti', 'occupé', 'libre', 'sale', 'propre', 'stayover', 'checkout', 'checkin'];
    const statusMatches = samples.filter(v => statusKeywords.some(k => v.toLowerCase().includes(k)));
    if (statusMatches.length >= samples.length * 0.2) return 'Statut';
    
    // Dates
    const dateMatches = samples.filter(v => /\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?/.test(v));
    if (dateMatches.length >= samples.length * 0.4) return 'Date';
    
    // Horaires
    const timeMatches = samples.filter(v => /^\d{1,2}[hH:]\d{2}/.test(v.trim()));
    if (timeMatches.length >= samples.length * 0.3) return 'Horaire';
    
    // Types de chambre
    const roomTypes = ['sup', 'fam', 'deluxe', 'standard', 'suite', 'dbl', 'sgl', 'twn', 'twin', 'triple', 'quad', 'king', 'queen', 'single', 'double', 'junior', 'executive', 'prestige', 'comfort', 'classic', 'premium'];
    const typeMatches = samples.filter(v => roomTypes.some(t => v.toLowerCase().includes(t)));
    if (typeMatches.length >= samples.length * 0.3) return 'Type chambre';
    
    // Noms (prénom + nom)
    const nameMatches = samples.filter(v => /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][a-zàâäéèêëïîôùûü]+/.test(v) && v.length > 3);
    if (nameMatches.length >= samples.length * 0.4) return 'Client';
    
    // Nombres petits (personnes)
    const smallNumbers = samples.filter(v => /^[1-9]$/.test(v.trim()));
    if (smallNumbers.length >= samples.length * 0.5) return 'Nb pers.';
    
    return 'Donnée';
  };

  // Détecter les colonnes
  const detectedColumns = useMemo(() => {
    if (parsedTable.length === 0) return [];
    
    const maxCols = Math.max(...parsedTable.map(r => r.columns.length));
    const cols: DetectedColumn[] = [];
    
    for (let i = 0; i < maxCols; i++) {
      const values = parsedTable.map(r => r.columns[i] || '').filter(v => v.trim());
      const uniqueValues = [...new Set(values.map(v => v.trim()))].slice(0, 30);
      const name = detectColumnType(values);
      
      cols.push({
        index: i,
        name: name === 'Donnée' ? `Col. ${i + 1}` : name,
        isIncluded: name !== 'Donnée', // Inclure par défaut les colonnes reconnues
        uniqueValues,
      });
    }
    
    return cols;
  }, [parsedTable]);

  // Initialiser les colonnes
  useEffect(() => {
    if (detectedColumns.length > 0 && columns.length === 0) {
      setColumns(detectedColumns);
    }
  }, [detectedColumns, columns.length]);

  // Calculer les combinaisons uniques basées sur les colonnes cochées
  const uniqueCombinations = useMemo(() => {
    const includedIndexes = columns.filter(c => c.isIncluded).map(c => c.index);
    if (includedIndexes.length === 0) return [];
    
    const combMap = new Map<string, CombinationRule>();
    
    parsedTable.forEach(row => {
      const values = includedIndexes.map(i => (row.columns[i] || '-').trim().toUpperCase());
      const key = values.join(' | ');
      
      if (combMap.has(key)) {
        combMap.get(key)!.count++;
      } else {
        combMap.set(key, {
          key,
          values,
          cleaningType: combinationRules[key] || '',
          count: 1,
        });
      }
    });
    
    return Array.from(combMap.values()).sort((a, b) => b.count - a.count);
  }, [parsedTable, columns, combinationRules]);

  // Appliquer les règles aux lignes
  const mappedRows = useMemo(() => {
    const includedIndexes = columns.filter(c => c.isIncluded).map(c => c.index);
    
    return parsedTable.map(row => {
      const rawLine = row.rawLine.toLowerCase();
      
      // Vérifier exclusions
      const isExcluded = exclusions.some(ex => rawLine.includes(ex.toLowerCase()));
      if (isExcluded) {
        return { ...row, cleaningType: 'exclude', combinationKey: '' };
      }
      
      // Calculer la clé de combinaison
      const values = includedIndexes.map(i => (row.columns[i] || '-').trim().toUpperCase());
      const combinationKey = values.join(' | ');
      const cleaningType = combinationRules[combinationKey] || '';
      
      return { ...row, combinationKey, cleaningType };
    });
  }, [parsedTable, columns, combinationRules, exclusions]);

  // Stats
  const stats = useMemo(() => {
    const mapped = mappedRows.filter(r => r.cleaningType && r.cleaningType !== 'exclude');
    return {
      total: parsedTable.length,
      mapped: mapped.length,
      aBlancCount: mappedRows.filter(r => r.cleaningType === 'a_blanc').length,
      recoucheCount: mappedRows.filter(r => r.cleaningType === 'recouche').length,
      noneCount: mappedRows.filter(r => r.cleaningType === 'none').length,
      horsServiceCount: mappedRows.filter(r => r.cleaningType === 'hors_service').length,
      excluded: mappedRows.filter(r => r.cleaningType === 'exclude').length,
      unmapped: mappedRows.filter(r => !r.cleaningType).length,
    };
  }, [mappedRows, parsedTable.length]);

  // Initialiser les exclusions
  useEffect(() => {
    const saved = localStorage.getItem(`training_exclusions_${hotelId}`);
    if (saved) {
      try {
        setExclusions(JSON.parse(saved));
      } catch {
        setExclusions([...KNOWN_PATTERNS.exclude]);
      }
    } else {
      setExclusions([...KNOWN_PATTERNS.exclude]);
    }
  }, [hotelId]);

  // Toggle colonne
  const toggleColumn = (index: number) => {
    setColumns(prev => prev.map(col => 
      col.index === index ? { ...col, isIncluded: !col.isIncluded } : col
    ));
    // Reset les règles quand on change les colonnes
    setCombinationRules({});
  };

  // Renommer colonne
  const startEditColumn = (index: number, currentName: string) => {
    setEditingColumnIndex(index);
    setEditingColumnName(currentName);
  };

  const saveColumnName = () => {
    if (editingColumnIndex !== null && editingColumnName.trim()) {
      setColumns(prev => prev.map(col => 
        col.index === editingColumnIndex ? { ...col, name: editingColumnName.trim() } : col
      ));
    }
    setEditingColumnIndex(null);
    setEditingColumnName('');
  };

  // Définir le type de nettoyage pour une combinaison
  const setCombinationType = (key: string, type: string) => {
    setCombinationRules(prev => ({ ...prev, [key]: type }));
  };

  // Auto-mapping basé sur les patterns connus
  const autoMapCombinations = () => {
    const newRules: Record<string, string> = {};
    
    uniqueCombinations.forEach(comb => {
      const combinedText = comb.values.join(' ').toLowerCase();
      
      // Chercher dans les patterns connus
      for (const [type, patterns] of Object.entries(KNOWN_PATTERNS)) {
        if (patterns.some(p => combinedText.includes(p))) {
          newRules[comb.key] = type;
          break;
        }
      }
    });
    
    setCombinationRules(prev => ({ ...prev, ...newRules }));
    toast({
      title: "✨ Auto-mapping appliqué",
      description: `${Object.keys(newRules).length} combinaisons mappées automatiquement.`,
    });
  };

  // Ajouter exclusion
  const addExclusion = () => {
    const trimmed = newExclusion.trim().toLowerCase();
    if (trimmed && !exclusions.includes(trimmed)) {
      const updated = [...exclusions, trimmed];
      setExclusions(updated);
      localStorage.setItem(`training_exclusions_${hotelId}`, JSON.stringify(updated));
      setNewExclusion('');
    }
  };

  // Supprimer exclusion
  const removeExclusion = (pattern: string) => {
    const updated = exclusions.filter(e => e !== pattern);
    setExclusions(updated);
    localStorage.setItem(`training_exclusions_${hotelId}`, JSON.stringify(updated));
  };

  // Continuer
  const handleContinue = () => {
    // Filtrer les chambres exclues et mapper les types
    const finalRooms = mappedRows
      .filter(r => r.cleaningType !== 'exclude')
      .map(r => ({
        roomNumber: r.roomNumber,
        cleaningType: (r.cleaningType || 'recouche') as any,
        originalText: r.rawLine,
        status: r.combinationKey || '',
      }));
    
    const updatedData: TrainingData = {
      ...trainingData,
      extractedRooms: finalRooms,
    };
    
    const config: MappingConfig = {
      columns,
      combinationRules,
      exclusions,
    };
    
    localStorage.setItem(`training_mapping_${hotelId}`, JSON.stringify(config));
    onComplete(updatedData, config);
  };

  const getCleaningTypeBadge = (type: string) => {
    const ct = CLEANING_TYPES.find(t => t.value === type);
    if (!ct) return null;
    return (
      <Badge className={`${ct.bgLight} ${ct.textColor} border-0`}>
        {ct.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        <Card className="p-2 bg-slate-50 border-slate-200">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-700">{stats.total}</p>
            <p className="text-[10px] text-slate-600">Total</p>
          </div>
        </Card>
        <Card className="p-2 bg-orange-50 border-orange-200">
          <div className="text-center">
            <p className="text-xl font-bold text-orange-700">{stats.aBlancCount}</p>
            <p className="text-[10px] text-orange-600">À blanc</p>
          </div>
        </Card>
        <Card className="p-2 bg-green-50 border-green-200">
          <div className="text-center">
            <p className="text-xl font-bold text-green-700">{stats.recoucheCount}</p>
            <p className="text-[10px] text-green-600">Recouche</p>
          </div>
        </Card>
        <Card className="p-2 bg-gray-50 border-gray-200">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-700">{stats.noneCount}</p>
            <p className="text-[10px] text-gray-600">Aucun</p>
          </div>
        </Card>
        <Card className="p-2 bg-purple-50 border-purple-200">
          <div className="text-center">
            <p className="text-xl font-bold text-purple-700">{stats.horsServiceCount}</p>
            <p className="text-[10px] text-purple-600">H.S.</p>
          </div>
        </Card>
        <Card className="p-2 bg-red-50 border-red-200">
          <div className="text-center">
            <p className="text-xl font-bold text-red-700">{stats.excluded}</p>
            <p className="text-[10px] text-red-600">Exclues</p>
          </div>
        </Card>
        <Card className="p-2 bg-yellow-50 border-yellow-200">
          <div className="text-center">
            <p className="text-xl font-bold text-yellow-700">{stats.unmapped}</p>
            <p className="text-[10px] text-yellow-600">À mapper</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="columns" className="flex items-center gap-1 text-xs">
            <Columns className="h-3 w-3" />
            Colonnes ({columns.filter(c => c.isIncluded).length}/{columns.length})
          </TabsTrigger>
          <TabsTrigger value="combinations" className="flex items-center gap-1 text-xs">
            <Layers className="h-3 w-3" />
            Combinaisons ({uniqueCombinations.length})
          </TabsTrigger>
          <TabsTrigger value="exclusions" className="flex items-center gap-1 text-xs">
            <Ban className="h-3 w-3" />
            Exclusions ({exclusions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Colonnes */}
        <TabsContent value="columns" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Columns className="h-4 w-4" />
                Structure du rapport
              </CardTitle>
              <CardDescription className="text-xs">
                Cochez les colonnes à utiliser pour créer les combinaisons. Cliquez sur le nom pour le modifier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-xs">N° Ch.</TableHead>
                      {columns.map(col => (
                        <TableHead key={col.index} className="min-w-[80px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Checkbox
                                checked={col.isIncluded}
                                onCheckedChange={() => toggleColumn(col.index)}
                                className="h-3 w-3"
                              />
                              {editingColumnIndex === col.index ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editingColumnName}
                                    onChange={(e) => setEditingColumnName(e.target.value)}
                                    className="h-6 text-xs w-20"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && saveColumnName()}
                                  />
                                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={saveColumnName}>
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingColumnIndex(null)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => startEditColumn(col.index, col.name)}
                                  className={`text-xs hover:underline ${!col.isIncluded ? 'line-through text-muted-foreground' : 'font-medium'}`}
                                >
                                  {col.name}
                                </button>
                              )}
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTable.slice(0, 12).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-bold text-xs">
                          {row.roomNumber}
                        </TableCell>
                        {columns.map(col => (
                          <TableCell 
                            key={col.index}
                            className={`text-xs ${!col.isIncluded ? 'bg-muted/50 text-muted-foreground' : col.isIncluded ? 'bg-primary/5' : ''}`}
                          >
                            {row.columns[col.index] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedTable.length > 12 && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    ... et {parsedTable.length - 12} autres chambres
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Combinaisons */}
        <TabsContent value="combinations" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Combinaisons uniques
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Colonnes sélectionnées: {columns.filter(c => c.isIncluded).map(c => c.name).join(', ') || 'Aucune'}
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={autoMapCombinations} className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto-mapper
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {columns.filter(c => c.isIncluded).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Columns className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sélectionnez au moins une colonne dans l'onglet "Colonnes"</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {uniqueCombinations.map((comb) => (
                      <div 
                        key={comb.key} 
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          comb.cleaningType ? 'bg-muted/30' : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {comb.values.map((v, i) => (
                              <Badge key={i} variant="outline" className="text-xs font-mono">
                                {v}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {comb.count} chambre{comb.count > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {comb.cleaningType && getCleaningTypeBadge(comb.cleaningType)}
                          <Select
                            value={combinationRules[comb.key] || ''}
                            onValueChange={(v) => setCombinationType(comb.key, v)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue placeholder="Choisir..." />
                            </SelectTrigger>
                            <SelectContent>
                              {CLEANING_TYPES.map(ct => (
                                <SelectItem key={ct.value} value={ct.value} className="text-xs">
                                  <span className={`${ct.textColor}`}>{ct.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Patterns d'exclusion
              </CardTitle>
              <CardDescription className="text-xs">
                Les lignes contenant ces mots seront ignorées
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Ajouter un pattern..."
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
                  className="h-8 text-xs"
                />
                <Button size="sm" onClick={addExclusion} className="h-8">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="flex flex-wrap gap-1">
                  {exclusions.map(pattern => (
                    <Badge 
                      key={pattern} 
                      variant="secondary"
                      className="text-xs flex items-center gap-1 pr-1"
                    >
                      {pattern}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 hover:bg-destructive/20"
                        onClick={() => removeExclusion(pattern)}
                      >
                        <Trash2 className="h-2 w-2" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview rapide */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Aperçu du résultat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[150px]">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {mappedRows.slice(0, 24).map((row, idx) => (
                <div 
                  key={idx}
                  className={`p-2 rounded border text-center ${
                    row.cleaningType === 'a_blanc' ? 'bg-orange-50 border-orange-200' :
                    row.cleaningType === 'recouche' ? 'bg-green-50 border-green-200' :
                    row.cleaningType === 'none' ? 'bg-gray-50 border-gray-200' :
                    row.cleaningType === 'hors_service' ? 'bg-purple-50 border-purple-200' :
                    row.cleaningType === 'exclude' ? 'bg-red-50 border-red-200 line-through' :
                    'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <p className="font-mono font-bold text-sm">{row.roomNumber}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {row.cleaningType ? CLEANING_TYPES.find(t => t.value === row.cleaningType)?.label : 'Non mappé'}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={stats.unmapped > 0 && stats.mapped === 0}
        >
          Continuer
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
