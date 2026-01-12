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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowRight, Columns, Eye, Plus, Trash2, Zap, 
  Settings2, Ban, CheckCircle, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';

// Types de nettoyage
const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc (Départ)', color: 'bg-orange-500', emoji: '🔶' },
  { value: 'recouche', label: 'Recouche (Occupé)', color: 'bg-green-500', emoji: '🔄' },
  { value: 'none', label: 'Pas de ménage', color: 'bg-gray-500', emoji: '⏸️' },
  { value: 'exclude', label: 'Exclure', color: 'bg-red-500', emoji: '🚫' },
];

// Patterns connus
const KNOWN_PATTERNS = {
  departure: ['depart', 'départ', 'parti', 'check-out', 'checkout', 'due out', 'dep', 'sal', 'sale', 'dirty', 'a blanc', 'blanc', 'libre', 'vac'],
  stayover: ['recouche', 'stay', 'occ', 'occupé', 'pro', 'ins', 'arrivee', 'arrivée', 'arr', 'check-in', 'draps', 'x'],
  noService: ['dnd', 'do not disturb', 'refus', 'ooo', 'hors service', 'maintenance'],
  exclude: ['fermé à la vente', 'literie', 'lit double', 'lits simple', 'total', 'page', 'imprimé', 'non occ veille']
};

interface ParsedTableRow {
  roomNumber: string;
  columns: string[];
  rawLine: string;
  cleaningType?: string;
}

interface DetectedColumn {
  index: number;
  name: string;
  isIncluded: boolean;
  isStatusColumn: boolean;
  uniqueValues: string[];
}

interface TrainingStep1bColumnMappingProps {
  trainingData: TrainingData;
  onComplete: (updatedData: TrainingData, mappingConfig: MappingConfig) => void;
  onBack: () => void;
  hotelId: string;
}

export interface MappingConfig {
  columns: DetectedColumn[];
  valueMapping: Record<string, string>;
  exclusions: string[];
}

export const TrainingStep1bColumnMapping: React.FC<TrainingStep1bColumnMappingProps> = ({
  trainingData,
  onComplete,
  onBack,
  hotelId,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'table' | 'mapping' | 'exclusions'>('table');
  const [columns, setColumns] = useState<DetectedColumn[]>([]);
  const [valueMapping, setValueMapping] = useState<Record<string, string>>({});
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');

  // Parser le texte brut en tableau
  const parsedTable = useMemo(() => {
    const rows: ParsedTableRow[] = [];
    const lines = trainingData.rawText.split('\n').filter(l => l.trim());
    
    // Regex pour détecter les numéros de chambre (commence par un nombre)
    const roomNumberRegex = /^(\d{1,4}[A-Z]?(?:\s*[-+\/]\s*\d{1,4}[A-Z]?)?)\s+/i;
    
    let currentRoomLine = '';
    let currentRoomNumber = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(roomNumberRegex);
      
      if (match) {
        // Sauvegarder la ligne précédente si existe
        if (currentRoomNumber) {
          // Découper la ligne en colonnes (séparateur: 2+ espaces ou tab)
          const cols = currentRoomLine.split(/\s{2,}|\t/).filter(c => c.trim());
          rows.push({
            roomNumber: currentRoomNumber,
            columns: cols.slice(1), // Exclure le numéro de chambre
            rawLine: currentRoomLine,
          });
        }
        
        currentRoomNumber = match[1].trim();
        currentRoomLine = trimmed;
      } else if (currentRoomNumber) {
        // Continuation de la ligne précédente
        currentRoomLine += ' ' + trimmed;
      }
    }
    
    // Ajouter la dernière ligne
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

  // Détecter les colonnes à partir des données parsées
  const detectedColumns = useMemo(() => {
    if (parsedTable.length === 0) return [];
    
    // Trouver le nombre max de colonnes
    const maxCols = Math.max(...parsedTable.map(r => r.columns.length));
    
    const cols: DetectedColumn[] = [];
    
    for (let i = 0; i < maxCols; i++) {
      const values = parsedTable
        .map(r => r.columns[i] || '')
        .filter(v => v.trim())
        .map(v => v.toUpperCase().trim());
      
      const uniqueValues = [...new Set(values)].slice(0, 20);
      
      // Détecter si c'est une colonne de statut
      const isStatusColumn = uniqueValues.some(v => {
        const lower = v.toLowerCase();
        return [...KNOWN_PATTERNS.departure, ...KNOWN_PATTERNS.stayover, ...KNOWN_PATTERNS.noService]
          .some(p => lower.includes(p));
      });
      
      // Deviner le nom de la colonne
      let name = `Colonne ${i + 1}`;
      if (isStatusColumn) name = 'Statut';
      else if (uniqueValues.some(v => /\d{2}\/\d{2}/.test(v))) name = 'Date';
      else if (uniqueValues.some(v => /^\d{1,2}:\d{2}/.test(v))) name = 'Heure';
      else if (uniqueValues.some(v => /^(DBL|SGL|TWN|TWIN|TRIPLE)/i.test(v))) name = 'Type chambre';
      else if (uniqueValues.some(v => /^(oui|non|yes|no)$/i.test(v))) name = 'Action';
      else if (uniqueValues.every(v => /^\d+$/.test(v) && parseInt(v) <= 10)) name = 'Nb nuits/pers';
      
      cols.push({
        index: i,
        name,
        isIncluded: true,
        isStatusColumn,
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
  }, [detectedColumns]);

  // Détecter les valeurs uniques pour le mapping
  const detectedValues = useMemo(() => {
    const values = new Set<string>();
    
    columns.forEach(col => {
      if (col.isStatusColumn && col.isIncluded) {
        col.uniqueValues.forEach(v => values.add(v));
      }
    });
    
    // Ajouter aussi depuis les données extraites existantes
    trainingData.extractedRooms.forEach(room => {
      if (room.status) values.add(room.status.toUpperCase());
      if (room.originalText) {
        const parts = room.originalText.split(/\s+/);
        parts.forEach(p => {
          const upper = p.toUpperCase();
          if (['INS', 'PRO', 'SAL', 'DEP', 'OCC', 'VAC', 'ARR', 'DEPART', 'RECOUCHE', 'PARTI', 'DRAPS'].includes(upper)) {
            values.add(upper);
          }
        });
      }
      // Ajouter les rawStatuses si disponibles
      if (room.rawStatuses) {
        room.rawStatuses.forEach(s => values.add(s.toUpperCase()));
      }
    });
    
    return Array.from(values).filter(v => v.length > 0 && v.length < 20);
  }, [columns, trainingData.extractedRooms]);

  // Initialiser le mapping automatique
  useEffect(() => {
    if (detectedValues.length > 0 && Object.keys(valueMapping).length === 0) {
      autoMap();
    }
  }, [detectedValues]);

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
  };

  // Toggle colonne de statut
  const toggleStatusColumn = (index: number) => {
    setColumns(prev => prev.map(col => 
      col.index === index ? { ...col, isStatusColumn: !col.isStatusColumn } : col
    ));
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
      } else if (KNOWN_PATTERNS.exclude.some(p => lower.includes(p))) {
        newMapping[value] = 'exclude';
      } else {
        newMapping[value] = 'recouche';
      }
    });
    
    setValueMapping(newMapping);
    toast({
      title: "✨ Mapping automatique",
      description: `${Object.keys(newMapping).length} valeurs mappées.`,
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

  // Appliquer le mapping aux données
  const mappedRooms = useMemo(() => {
    return trainingData.extractedRooms.map(room => {
      const rawLine = (room.originalText || room.status || '').toUpperCase();
      let cleaningType = room.cleaningType;
      
      // Vérifier les exclusions
      const isExcluded = exclusions.some(ex => 
        rawLine.toLowerCase().includes(ex.toLowerCase())
      );
      
      if (isExcluded) {
        return { ...room, cleaningType: 'exclude' as any, excluded: true };
      }
      
      // Appliquer le mapping
      for (const [value, type] of Object.entries(valueMapping)) {
        if (rawLine.includes(value)) {
          cleaningType = type as any;
          break;
        }
      }
      
      return { ...room, cleaningType };
    }).filter(r => r.cleaningType !== 'exclude');
  }, [trainingData.extractedRooms, valueMapping, exclusions]);

  // Stats
  const stats = useMemo(() => ({
    total: mappedRooms.length,
    aBlancCount: mappedRooms.filter(r => r.cleaningType === 'a_blanc').length,
    recoucheCount: mappedRooms.filter(r => r.cleaningType === 'recouche').length,
    noneCount: mappedRooms.filter(r => r.cleaningType === 'none').length,
    excluded: trainingData.extractedRooms.length - mappedRooms.length,
  }), [mappedRooms, trainingData.extractedRooms]);

  // Continuer
  const handleContinue = () => {
    const updatedData: TrainingData = {
      ...trainingData,
      extractedRooms: mappedRooms,
    };
    
    const config: MappingConfig = {
      columns,
      valueMapping,
      exclusions,
    };
    
    // Sauvegarder la config
    localStorage.setItem(`training_mapping_${hotelId}`, JSON.stringify(config));
    
    onComplete(updatedData, config);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
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
          <TabsTrigger value="table" className="flex items-center gap-1">
            <Columns className="h-4 w-4" />
            Colonnes ({columns.filter(c => c.isIncluded).length}/{columns.length})
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-1">
            <Settings2 className="h-4 w-4" />
            Mapping ({detectedValues.length})
          </TabsTrigger>
          <TabsTrigger value="exclusions" className="flex items-center gap-1">
            <Ban className="h-4 w-4" />
            Exclusions ({exclusions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Colonnes */}
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Columns className="h-4 w-4" />
                Structure du tableau détectée
              </CardTitle>
              <CardDescription>
                Cochez les colonnes à inclure et identifiez la colonne de statut
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">N°</TableHead>
                      {columns.map(col => (
                        <TableHead key={col.index} className="min-w-[100px]">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={col.isIncluded}
                                onCheckedChange={() => toggleColumn(col.index)}
                              />
                              <span className={!col.isIncluded ? 'line-through text-muted-foreground' : ''}>
                                {col.name}
                              </span>
                            </div>
                            {col.isIncluded && (
                              <div className="flex items-center gap-1">
                                <Checkbox
                                  checked={col.isStatusColumn}
                                  onCheckedChange={() => toggleStatusColumn(col.index)}
                                  className="h-3 w-3"
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  Statut?
                                </span>
                              </div>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTable.slice(0, 15).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-bold">
                          {row.roomNumber}
                        </TableCell>
                        {columns.map(col => (
                          <TableCell 
                            key={col.index}
                            className={!col.isIncluded ? 'bg-muted/50 text-muted-foreground line-through' : 
                                       col.isStatusColumn ? 'bg-primary/5 font-medium' : ''}
                          >
                            {row.columns[col.index] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedTable.length > 15 && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    ... et {parsedTable.length - 15} autres lignes
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Mapping */}
        <TabsContent value="mapping" className="mt-4">
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
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-2">
                  {detectedValues.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Cochez une colonne comme "Statut" dans l'onglet Colonnes</p>
                    </div>
                  ) : (
                    detectedValues.map(value => (
                      <div 
                        key={value}
                        className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50"
                      >
                        <Badge variant="outline" className="font-mono font-bold">
                          {value}
                        </Badge>
                        <Select
                          value={valueMapping[value] || 'recouche'}
                          onValueChange={(v) => setValueMapping(prev => ({ ...prev, [value]: v }))}
                        >
                          <SelectTrigger className="w-44 h-8">
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
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Exclusions */}
        <TabsContent value="exclusions" className="mt-4">
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
              
              <ScrollArea className="h-[200px]">
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
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Aperçu rapide */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-center gap-4 text-sm">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span>Aperçu:</span>
          <div className="flex gap-2">
            {mappedRooms.slice(0, 5).map((room, i) => (
              <Badge 
                key={i}
                variant="outline"
                className={
                  room.cleaningType === 'a_blanc' ? 'border-orange-500 text-orange-600' :
                  room.cleaningType === 'recouche' ? 'border-green-500 text-green-600' :
                  'border-gray-500 text-gray-600'
                }
              >
                {room.roomNumber}
              </Badge>
            ))}
            {mappedRooms.length > 5 && (
              <span className="text-muted-foreground">+{mappedRooms.length - 5}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Footer */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button onClick={handleContinue}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Continuer avec {stats.total} chambres
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default TrainingStep1bColumnMapping;
