import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, Zap, CheckCircle2, Info, ArrowLeft, Eye, Settings2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';
import { detectReportFormat, getFormatDescription, CleaningIndicator, ParsedRow } from '@/services/training/ReportFormatDetector';
import { normalizeCleaningType, CleaningType } from '@/constants/cleaningTypes';

// Types de nettoyage disponibles
const CLEANING_OPTIONS = [
  { value: 'full', label: 'À blanc', description: 'Nettoyage complet (départ)', color: 'bg-orange-500', textColor: 'text-orange-700' },
  { value: 'quick', label: 'Recouche', description: 'Nettoyage rapide (client en place)', color: 'bg-blue-500', textColor: 'text-blue-700' },
  { value: 'none', label: 'Aucun', description: 'Pas de nettoyage requis', color: 'bg-gray-400', textColor: 'text-gray-700' },
  { value: 'out_of_service', label: 'Hors service', description: 'Chambre bloquée', color: 'bg-purple-500', textColor: 'text-purple-700' },
  { value: 'exclude', label: 'Exclure', description: 'Ignorer cette ligne', color: 'bg-red-500', textColor: 'text-red-700' },
];

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

  // Détecter le format et parser le rapport
  const analysis = useMemo(() => {
    console.log('Analyzing report...');
    const detection = detectReportFormat(trainingData.rawText);
    console.log('Detection result:', detection);
    return detection;
  }, [trainingData.rawText]);

  const formatInfo = getFormatDescription(analysis.format);

  // Initialiser les mappings avec les suggestions
  useEffect(() => {
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
  }, [analysis.indicators]);

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
        
        return {
          roomNumber: row.roomNumber,
          cleaningType: (finalType === 'out_of_service' ? 'none' : finalType === 'unknown' ? 'quick' : finalType) as CleaningType,
          status: row.statusIndicator || '',
          originalText: row.rawLine,
          validated: true,
        };
      });

    const config: MappingConfig = {
      formatDetected: analysis.format,
      statusMappings,
      exclusionPatterns: [],
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
        <StatCard value={stats.full} label="À blanc" className="bg-orange-50 text-orange-700" />
        <StatCard value={stats.quick} label="Recouche" className="bg-blue-50 text-blue-700" />
        <StatCard value={stats.none} label="Aucun" className="bg-gray-50 text-gray-700" />
        <StatCard value={stats.oos} label="H.S." className="bg-purple-50 text-purple-700" />
        <StatCard value={stats.excluded} label="Exclues" className="bg-red-50 text-red-700" />
        <StatCard 
          value={stats.unmapped} 
          label="À mapper" 
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

      {/* Tabs: Prévisualisation / Mapping / Configuration */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Prévisualisation
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Mapping ({analysis.indicators.length})
          </TabsTrigger>
          <TabsTrigger value="columns" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Colonnes
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
                      <TableHead className="w-20">Chambre</TableHead>
                      <TableHead>Indicateur</TableHead>
                      {analysis.structure.suggestedColumns.slice(0, 6).map((col, idx) => (
                        <TableHead key={idx} className="text-xs">{col.name}</TableHead>
                      ))}
                      <TableHead className="w-32">Type détecté</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.parsedData.rows.slice(0, 50).map((row, idx) => {
                      const finalType = getFinalType(row);
                      return (
                        <TableRow key={idx} className={finalType === 'unknown' ? 'bg-yellow-50' : ''}>
                          <TableCell className="font-mono font-bold">{row.roomNumber}</TableCell>
                          <TableCell>
                            {row.statusIndicator && (
                              <Badge variant="outline" className="font-mono">
                                {row.statusIndicator}
                              </Badge>
                            )}
                          </TableCell>
                          {row.columns.slice(0, 6).map((col, colIdx) => (
                            <TableCell key={colIdx} className="text-xs truncate max-w-[100px]" title={col.value}>
                              {col.value}
                            </TableCell>
                          ))}
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

        {/* Tab Colonnes détectées */}
        <TabsContent value="columns" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Structure des colonnes</CardTitle>
              <CardDescription>
                Colonnes détectées automatiquement dans le rapport
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {analysis.structure.suggestedColumns.map((col, idx) => (
                  <Card key={idx} className={`p-3 ${col.isRelevantForCleaning ? 'ring-2 ring-primary/30' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">Col {idx + 1}</Badge>
                      {col.isRelevantForCleaning && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <p className="font-medium text-sm">{col.name}</p>
                    <p className="text-xs text-muted-foreground">{col.type}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {col.sampleValues.slice(0, 3).map((v, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                          {v.substring(0, 12)}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Button 
          onClick={handleContinue} 
          className="gap-2" 
          disabled={stats.unmapped > stats.total * 0.5}
        >
          Continuer avec {stats.total - stats.excluded} chambres
          <ArrowRight className="h-4 w-4" />
        </Button>
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
