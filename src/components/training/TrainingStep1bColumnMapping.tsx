import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Zap, CheckCircle2, Info, ArrowLeft, Eye, Settings2, AlertTriangle, RefreshCw, Columns, GripVertical, X, Plus, Edit2, Save, Download, Upload, Combine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';
import { detectReportFormat, getFormatDescription, CleaningIndicator, ParsedRow, ColumnType } from '@/services/training/ReportFormatDetector';
import { normalizeCleaningType, CleaningType } from '@/constants/cleaningTypes';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loadHotelReportConfig, saveHotelReportConfig, ColumnMapping, StatusMapping as ServiceStatusMapping } from '@/services/reportConfigService';
import { CleaningCombinationMapper } from '@/components/pms/CleaningCombinationMapper';

// Types de nettoyage disponibles
const CLEANING_OPTIONS = [
  { value: 'full', label: 'À blanc', description: 'Nettoyage complet (départ)', color: 'bg-orange-500', textColor: 'text-orange-700' },
  { value: 'quick', label: 'Recouche', description: 'Nettoyage rapide (client en place)', color: 'bg-blue-500', textColor: 'text-blue-700' },
  { value: 'none', label: 'Aucun', description: 'Pas de nettoyage requis', color: 'bg-gray-400', textColor: 'text-gray-700' },
  { value: 'out_of_service', label: 'Hors service', description: 'Chambre bloquée', color: 'bg-purple-500', textColor: 'text-purple-700' },
  { value: 'exclude', label: 'Exclure', description: 'Ignorer cette ligne', color: 'bg-red-500', textColor: 'text-red-700' },
];

// Types de colonnes disponibles
const COLUMN_TYPES: { value: ColumnType; label: string; icon: string }[] = [
  { value: 'room_number', label: 'N° Chambre', icon: '🚪' },
  { value: 'room_type', label: 'Type chambre', icon: '🏠' },
  { value: 'status', label: 'Statut', icon: '📊' },
  { value: 'guest_name', label: 'Nom client', icon: '👤' },
  { value: 'arrival_date', label: 'Date arrivée', icon: '📅' },
  { value: 'departure_date', label: 'Date départ', icon: '📅' },
  { value: 'arrival_time', label: 'Heure arrivée', icon: '⏰' },
  { value: 'departure_time', label: 'Heure départ', icon: '⏰' },
  { value: 'night_info', label: 'Info nuit', icon: '🌙' },
  { value: 'assignee', label: 'Assigné', icon: '👷' },
  { value: 'notes', label: 'Notes', icon: '📝' },
  { value: 'other', label: 'Autre', icon: '❓' },
];

interface ColumnConfig {
  id: string;
  name: string;
  type: ColumnType;
  enabled: boolean;
  order: number;
}

interface StatusMapping {
  [key: string]: CleaningType | 'out_of_service' | 'exclude' | '';
}

interface TrainingStep1bColumnMappingProps {
  trainingData: TrainingData;
  onComplete: (updatedData: TrainingData, mappingConfig: MappingConfig) => void;
  onBack: () => void;
  hotelId: string;
}

export interface MappingConfig {
  formatDetected: string;
  statusMappings: StatusMapping;
  exclusionPatterns: string[];
  columnConfig?: ColumnConfig[];
}

export const TrainingStep1bColumnMapping: React.FC<TrainingStep1bColumnMappingProps> = ({
  trainingData,
  onComplete,
  onBack,
  hotelId,
}) => {
  const { toast } = useToast();
  const [statusMappings, setStatusMappings] = useState<StatusMapping>({});
  const [activeTab, setActiveTab] = useState('preview');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState<boolean>(false);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);

  // Détecter le format et parser le rapport
  const analysis = useMemo(() => {
    console.log('Analyzing report...');
    const detection = detectReportFormat(trainingData.rawText);
    console.log('Detection result:', detection);
    return detection;
  }, [trainingData.rawText]);

  const formatInfo = getFormatDescription(analysis.format);

  // Fonction d'initialisation des colonnes
  const initializeColumnsFromAnalysis = () => {
    const initialColumns: ColumnConfig[] = analysis.structure.suggestedColumns.map((col, idx) => ({
      id: `col-${idx}`,
      name: col.name,
      type: col.type as ColumnType,
      enabled: col.isRelevantForCleaning,
      order: idx,
    }));
    setColumnConfigs(initialColumns);
  };

  // Fonction d'initialisation des mappings
  const initializeFromAnalysis = () => {
    const initialMappings: StatusMapping = {};
    for (const indicator of analysis.indicators) {
      if (indicator.suggestedType !== 'unknown') {
        initialMappings[indicator.value] = indicator.suggestedType === 'out_of_service' 
          ? 'out_of_service' 
          : indicator.suggestedType === 'exclude'
          ? 'exclude'
          : normalizeCleaningType(indicator.suggestedType);
      }
    }
    setStatusMappings(initialMappings);
    initializeColumnsFromAnalysis();
  };

  // Charger la config existante de l'hôtel
  useEffect(() => {
    const loadExistingConfig = async () => {
      if (!hotelId) {
        initializeFromAnalysis();
        setLoadingConfig(false);
        return;
      }

      try {
        const config = await loadHotelReportConfig(hotelId);
        
        if (config) {
          // Appliquer les status mappings sauvegardés
          if (config.status_mappings && Object.keys(config.status_mappings).length > 0) {
            setStatusMappings(config.status_mappings as unknown as StatusMapping);
            toast({
              title: "📦 Configuration chargée",
              description: `Configuration précédente appliquée (${Object.keys(config.status_mappings).length} mappings)`,
            });
          } else {
            // Initialiser avec les suggestions
            const initialMappings: StatusMapping = {};
            for (const indicator of analysis.indicators) {
              if (indicator.suggestedType !== 'unknown') {
                initialMappings[indicator.value] = indicator.suggestedType === 'out_of_service' 
                  ? 'out_of_service' 
                  : indicator.suggestedType === 'exclude'
                  ? 'exclude'
                  : normalizeCleaningType(indicator.suggestedType);
              }
            }
            setStatusMappings(initialMappings);
          }
          
          // Appliquer les colonnes sauvegardées si le format est le même
          if (config.column_mappings && config.column_mappings.length > 0 && 
              config.detected_format === analysis.format) {
            const savedColumns: ColumnConfig[] = config.column_mappings.map((col, idx) => ({
              id: `col-${idx}`,
              name: col.columnName,
              type: col.type,
              enabled: col.enabled,
              order: col.order,
            }));
            setColumnConfigs(savedColumns);
          } else {
            initializeColumnsFromAnalysis();
          }
        } else {
          initializeFromAnalysis();
        }
      } catch (error) {
        console.error('Erreur chargement config:', error);
        initializeFromAnalysis();
      } finally {
        setLoadingConfig(false);
      }
    };

    loadExistingConfig();
  }, [hotelId, analysis.format, analysis.indicators]);

  // Sauvegarder la configuration
  const handleSaveConfig = async () => {
    if (!hotelId) return;

    try {
      const columnMappings: ColumnMapping[] = columnConfigs.map((col, idx) => ({
        columnIndex: idx,
        columnName: col.name,
        type: col.type,
        enabled: col.enabled,
        order: col.order,
      }));

      await saveHotelReportConfig(hotelId, {
        column_mappings: columnMappings,
        status_mappings: statusMappings as unknown as ServiceStatusMapping,
        detected_format: analysis.format,
      });

      setSavedConfig(true);
      toast({
        title: "✅ Configuration sauvegardée",
        description: "Vos paramètres seront réutilisés pour les prochains imports.",
      });
    } catch (error) {
      console.error('Erreur sauvegarde config:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration.",
        variant: "destructive",
      });
    }
  };

  // Colonnes activées et triées
  const activeColumns = useMemo(() => {
    return [...columnConfigs]
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);
  }, [columnConfigs]);

  // Handlers pour la gestion des colonnes
  const toggleColumn = (id: string) => {
    setColumnConfigs(prev => prev.map(c => 
      c.id === id ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const updateColumnType = (id: string, type: ColumnType) => {
    setColumnConfigs(prev => prev.map(c => 
      c.id === id ? { ...c, type } : c
    ));
  };

  const updateColumnName = (id: string, name: string) => {
    setColumnConfigs(prev => prev.map(c => 
      c.id === id ? { ...c, name } : c
    ));
    setEditingColumn(null);
  };

  const moveColumn = (id: string, direction: 'up' | 'down') => {
    setColumnConfigs(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx === -1) return prev;
      
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      
      const newConfigs = [...prev];
      [newConfigs[idx].order, newConfigs[newIdx].order] = [newConfigs[newIdx].order, newConfigs[idx].order];
      return newConfigs.sort((a, b) => a.order - b.order);
    });
  };

  // Recalculer les stats en fonction des mappings manuels
  const stats = useMemo(() => {
    let full = 0, quick = 0, none = 0, oos = 0, excluded = 0, unmapped = 0;
    
    for (const row of analysis.parsedData.rows) {
      // Vérifier si l'utilisateur a mappé manuellement cet indicateur
      const userMapping = row.statusIndicator ? statusMappings[row.statusIndicator.toUpperCase()] : null;
      const finalType = userMapping || row.detectedCleaningType;
      
      switch (finalType) {
        case 'full': full++; break;
        case 'quick': quick++; break;
        case 'none': none++; break;
        case 'out_of_service': oos++; break;
        case 'exclude': excluded++; break;
        case 'unknown': unmapped++; break;
      }
    }
    
    return { total: analysis.parsedData.rows.length, full, quick, none, oos, excluded, unmapped };
  }, [analysis.parsedData.rows, statusMappings]);

  // Auto-map tous les indicateurs
  const autoMapAll = () => {
    const newMappings = { ...statusMappings };
    for (const indicator of analysis.indicators) {
      if (indicator.suggestedType !== 'unknown') {
        newMappings[indicator.value] = indicator.suggestedType === 'out_of_service' 
          ? 'out_of_service' 
          : indicator.suggestedType === 'exclude'
          ? 'exclude'
          : normalizeCleaningType(indicator.suggestedType);
      }
    }
    setStatusMappings(newMappings);
    toast({ title: "✨ Auto-mapping appliqué", description: `${Object.keys(newMappings).length} indicateurs mappés` });
  };

  // Obtenir le type final pour une row
  const getFinalType = (row: ParsedRow): string => {
    const userMapping = row.statusIndicator ? statusMappings[row.statusIndicator.toUpperCase()] : null;
    return userMapping || row.detectedCleaningType;
  };

  // Couleur du type de nettoyage
  const getCleaningColor = (type: string): string => {
    const option = CLEANING_OPTIONS.find(o => o.value === type);
    return option?.textColor || 'text-muted-foreground';
  };

  const getCleaningBadgeColor = (type: string): string => {
    switch (type) {
      case 'full': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'quick': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'none': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'out_of_service': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'exclude': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getCleaningLabel = (type: string): string => {
    const option = CLEANING_OPTIONS.find(o => o.value === type);
    return option?.label || 'Inconnu';
  };

  // Continuer vers l'étape suivante
  const handleContinue = () => {
    const mappedRooms = analysis.parsedData.rows
      .filter(row => getFinalType(row) !== 'exclude')
      .map(row => {
        const finalType = getFinalType(row);
        
        // Extraire currentNight et totalNights du nightInfo
        let currentNight: number | undefined;
        let totalNights: number | undefined;
        if (row.nightInfo) {
          const nightMatch = row.nightInfo.match(/(\d+)\/(\d+)/);
          if (nightMatch) {
            currentNight = parseInt(nightMatch[1]);
            totalNights = parseInt(nightMatch[2]);
          }
        }
        
        return {
          roomNumber: row.roomNumber,
          cleaningType: (finalType === 'out_of_service' ? 'none' : finalType === 'unknown' ? 'quick' : finalType) as CleaningType,
          status: row.statusIndicator || row.cleaningStatus || '',
          originalText: row.rawLine,
          validated: true,
          // Passer toutes les données extraites
          guestName: row.guestName || undefined,
          arrivalDate: row.arrivalDate || undefined,
          departureDate: row.departureDate || undefined,
          arrivalTime: row.arrivalTime || undefined,
          departureTime: row.departureTime || undefined,
          nightInfo: row.nightInfo || undefined,
          currentNight,
          totalNights,
          roomType: row.roomType || undefined,
          confidence: row.confidence,
        };
      });

    const config: MappingConfig = {
      formatDetected: analysis.format,
      statusMappings,
      exclusionPatterns: [],
      columnConfig: columnConfigs,
    };

    onComplete({
      ...trainingData,
      extractedRooms: mappedRooms,
      detectedPmsType: analysis.format,
    }, config);
  };

  return (
    <div className="space-y-4">
      {/* Format détecté et stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Format détecté:</strong> {formatInfo.name}
            <br />
            <span className="text-muted-foreground text-sm">
              {formatInfo.description} • Confiance: {analysis.confidence}%
            </span>
          </AlertDescription>
        </Alert>

        <Card className="p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Résumé détection:</span>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{analysis.parsedData.summary.totalRooms} chambres</Badge>
              <Badge className="bg-orange-100 text-orange-800">🚪 {analysis.parsedData.summary.departures} départs</Badge>
              <Badge className="bg-blue-100 text-blue-800">🔄 {analysis.parsedData.summary.stayovers} recouches</Badge>
              {analysis.parsedData.summary.unknown > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800">❓ {analysis.parsedData.summary.unknown} inconnus</Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Stats temps réel */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        <StatCard value={stats.total} label="Total" className="bg-slate-50" />
        <StatCard value={stats.full} label="Check-out" className="bg-orange-50 text-orange-700" />
        <StatCard value={stats.quick} label="Stayover" className="bg-blue-50 text-blue-700" />
        <StatCard value={stats.none} label="None" className="bg-gray-50 text-gray-700" />
        <StatCard value={stats.oos} label="OOS" className="bg-purple-50 text-purple-700" />
        <StatCard value={stats.excluded} label="Excluded" className="bg-red-50 text-red-700" />
        <StatCard 
          value={stats.unmapped} 
          label="To map" 
          className={stats.unmapped > 0 ? "bg-yellow-50 text-yellow-700 ring-2 ring-yellow-400" : "bg-green-50 text-green-700"}
        />
      </div>

      {/* Warning si beaucoup d'inconnus */}
      {stats.unmapped > stats.total * 0.2 && (
        <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats.unmapped} chambres n'ont pas pu être catégorisées automatiquement.
            Mappez les indicateurs ci-dessous pour les corriger.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs: Prévisualisation / Mapping / Colonnes / Combinaisons */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Prévisualisation</span>
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Mapping</span> ({analysis.indicators.length})
          </TabsTrigger>
          <TabsTrigger value="columns" className="gap-2">
            <Columns className="h-4 w-4" />
            <span className="hidden sm:inline">Colonnes</span>
          </TabsTrigger>
          <TabsTrigger value="combinations" className="gap-2">
            <Combine className="h-4 w-4" />
            <span className="hidden sm:inline">Combinaisons</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Prévisualisation */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Données extraites</CardTitle>
              <CardDescription>
                Vérifiez que le type de nettoyage détecté est correct pour chaque chambre
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Chambre</TableHead>
                      <TableHead className="w-16">Type</TableHead>
                      <TableHead className="w-24">Statut</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="w-24">Arrivée</TableHead>
                      <TableHead className="w-24">Départ</TableHead>
                      <TableHead className="w-16">Nuit</TableHead>
                      <TableHead className="w-28">Type nettoyage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.parsedData.rows.slice(0, 50).map((row, idx) => {
                      const finalType = getFinalType(row);
                      return (
                        <TableRow key={idx} className={finalType === 'unknown' ? 'bg-yellow-50' : ''}>
                          <TableCell className="font-mono font-bold">{row.roomNumber}</TableCell>
                          <TableCell className="text-xs">{row.roomType}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {row.cleaningStatus || row.statusIndicator || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[120px]" title={row.guestName}>
                            {row.guestName || '-'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{row.arrivalDate || '-'}</TableCell>
                          <TableCell className="text-xs font-mono">{row.departureDate || '-'}</TableCell>
                          <TableCell className="text-xs">{row.nightInfo || '-'}</TableCell>
                          <TableCell>
                            <Badge className={getCleaningBadgeColor(finalType)}>
                              {getCleaningLabel(finalType)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {analysis.parsedData.rows.length > 50 && (
                  <p className="text-center text-muted-foreground py-2 text-sm">
                    ... et {analysis.parsedData.rows.length - 50} autres chambres
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Mapping des indicateurs */}
        <TabsContent value="mapping" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Mapper les indicateurs</CardTitle>
                  <CardDescription className="text-xs">
                    Associez chaque code trouvé au type de nettoyage correspondant
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={autoMapAll} className="gap-1">
                  <Zap className="h-3 w-3" />
                  Auto-mapper
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {analysis.indicators.map((indicator) => (
                    <IndicatorRow
                      key={indicator.value}
                      indicator={indicator}
                      mapping={statusMappings[indicator.value] || ''}
                      onMappingChange={(value) => setStatusMappings(prev => ({ ...prev, [indicator.value]: value } as StatusMapping))}
                    />
                  ))}
                  {analysis.indicators.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun indicateur de statut détecté. Le rapport sera analysé avec des règles génériques.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Colonnes - Configuration interactive */}
        <TabsContent value="columns" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Columns className="h-4 w-4" />
                    Configuration des colonnes
                  </CardTitle>
                  <CardDescription>
                    Activez, renommez et réordonnez les colonnes selon vos besoins
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {activeColumns.length} / {columnConfigs.length} actives
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {columnConfigs.map((col, idx) => (
                    <div
                      key={col.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        col.enabled 
                          ? 'bg-card border-primary/30 shadow-sm' 
                          : 'bg-muted/30 border-muted opacity-60'
                      }`}
                    >
                      {/* Switch activer/désactiver */}
                      <Switch
                        checked={col.enabled}
                        onCheckedChange={() => toggleColumn(col.id)}
                      />
                      
                      {/* Numéro d'ordre */}
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveColumn(col.id, 'up')}
                          disabled={idx === 0}
                        >
                          <span className="text-xs">▲</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveColumn(col.id, 'down')}
                          disabled={idx === columnConfigs.length - 1}
                        >
                          <span className="text-xs">▼</span>
                        </Button>
                      </div>
                      
                      {/* Nom de la colonne */}
                      <div className="flex-1 min-w-0">
                        {editingColumn === col.id ? (
                          <Input
                            autoFocus
                            defaultValue={col.name}
                            className="h-8 text-sm"
                            onBlur={(e) => updateColumnName(col.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateColumnName(col.id, e.currentTarget.value);
                              }
                              if (e.key === 'Escape') {
                                setEditingColumn(null);
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{col.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-50 hover:opacity-100"
                              onClick={() => setEditingColumn(col.id)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        
                        {/* Aperçu des valeurs */}
                        <div className="flex gap-1 mt-1">
                          {analysis.structure.suggestedColumns[idx]?.sampleValues.slice(0, 2).map((v, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] font-mono truncate max-w-[80px]">
                              {v.substring(0, 15)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* Type de colonne */}
                      <Select
                        value={col.type}
                        onValueChange={(value) => updateColumnType(col.id, value as ColumnType)}
                      >
                        <SelectTrigger className="w-[150px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {COLUMN_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <span className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Indicateur important */}
                      {col.type === 'guest_name' && col.enabled && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          👤 Client
                        </Badge>
                      )}
                    </div>
                  ))}
                  
                  {columnConfigs.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune colonne détectée dans le rapport.
                    </p>
                  )}
                </div>
              </ScrollArea>
              
              {/* Résumé des colonnes actives */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Colonnes actives :</p>
                <div className="flex flex-wrap gap-2">
                  {activeColumns.map(col => {
                    const typeInfo = COLUMN_TYPES.find(t => t.value === col.type);
                    return (
                      <Badge 
                        key={col.id} 
                        variant="outline" 
                        className="gap-1"
                      >
                        <span>{typeInfo?.icon}</span>
                        <span>{col.name}</span>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Combinaisons - Règles de détermination du type de nettoyage */}
        <TabsContent value="combinations" className="mt-4">
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Règles de combinaison :</strong> Définissez le type de nettoyage selon la combinaison 
                de critères présents dans le rapport (dates, horaires, statut PMS, info nuit).
              </AlertDescription>
            </Alert>
            
            <CleaningCombinationMapper hotelId={hotelId} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleSaveConfig}
            className="gap-2"
            disabled={loadingConfig}
          >
            <Save className="h-4 w-4" />
            {savedConfig ? 'Sauvegardé ✓' : 'Sauvegarder config'}
          </Button>
          
          <Button 
            onClick={handleContinue} 
            className="gap-2" 
            disabled={stats.unmapped > stats.total * 0.5 || loadingConfig}
          >
            Continuer avec {stats.total - stats.excluded} chambres
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Composants auxiliaires
function StatCard({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <Card className={`p-2 ${className}`}>
      <div className="text-center">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-[10px]">{label}</p>
      </div>
    </Card>
  );
}

function IndicatorRow({ 
  indicator, 
  mapping, 
  onMappingChange 
}: { 
  indicator: CleaningIndicator; 
  mapping: string;
  onMappingChange: (value: string) => void;
}) {
  const getSuggestedBadge = () => {
    if (indicator.suggestedType === 'unknown') return null;
    const option = CLEANING_OPTIONS.find(o => o.value === indicator.suggestedType);
    return option ? (
      <Badge variant="outline" className="text-[10px] ml-2">
        Suggestion: {option.label}
      </Badge>
    ) : null;
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50">
      <Badge variant="secondary" className="font-mono min-w-[100px] justify-center text-sm">
        {indicator.value}
      </Badge>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">
          {indicator.context[0]?.substring(0, 70)}...
        </p>
        {getSuggestedBadge()}
      </div>
      
      <Badge variant="outline" className="text-xs shrink-0">
        ×{indicator.occurrences}
      </Badge>
      
      <Select value={mapping} onValueChange={onMappingChange}>
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Choisir..." />
        </SelectTrigger>
        <SelectContent>
          {CLEANING_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                {opt.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {mapping && (
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
      )}
    </div>
  );
}
