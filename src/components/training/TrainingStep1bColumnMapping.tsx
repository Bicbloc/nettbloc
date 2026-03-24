import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, ArrowLeft, Zap, AlertTriangle, Save, Info, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';
import { detectReportFormat, getFormatDescription, CleaningIndicator, ParsedRow, ColumnType } from '@/services/training/ReportFormatDetector';
import { normalizeCleaningType, CleaningType } from '@/constants/cleaningTypes';
import { loadHotelReportConfig, saveHotelReportConfig, ColumnMapping, StatusMapping as ServiceStatusMapping } from '@/services/reportConfigService';

const CLEANING_OPTIONS = [
  { value: 'full', label: 'À blanc', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'quick', label: 'Recouche', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'none', label: 'Aucun', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { value: 'out_of_service', label: 'Hors service', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'exclude', label: 'Exclure', color: 'bg-red-100 text-red-800 border-red-200' },
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
  columnConfig?: any[];
}

export const TrainingStep1bColumnMapping: React.FC<TrainingStep1bColumnMappingProps> = ({
  trainingData,
  onComplete,
  onBack,
  hotelId,
}) => {
  const { toast } = useToast();
  const [statusMappings, setStatusMappings] = useState<StatusMapping>({});
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savedConfig, setSavedConfig] = useState(false);

  // Detect format and parse
  const analysis = useMemo(() => {
    const detection = detectReportFormat(trainingData.rawText);
    
    if (detection.parsedData.rows.length === 0 && trainingData.rawText.trim().length > 0) {
      const rawLines = trainingData.rawText.split('\n').filter(l => l.trim().length > 3);
      const fallbackRows = rawLines.map((line, idx) => {
        const numMatch = line.match(/\b(\d{2,4}[A-Z]?)\b/);
        return {
          rawLine: line,
          roomNumber: numMatch ? numMatch[1] : `L${idx + 1}`,
          roomType: '',
          cleaningStatus: '',
          columns: [{ value: numMatch ? numMatch[1] : line.substring(0, 20), type: 'room_number' as const, confidence: 0.2 }],
          detectedCleaningType: 'unknown' as const,
          confidence: 0.2,
          statusIndicator: '',
          guestName: '',
          arrivalDate: '',
          departureDate: '',
          arrivalTime: '',
          departureTime: '',
          nightInfo: '',
          hasCurrentGuest: false,
          hasDepartingGuest: false,
          hasArrivingGuest: false,
          isOutOfOrder: false,
          assignee: '',
        };
      });
      
      return {
        ...detection,
        parsedData: {
          ...detection.parsedData,
          rows: fallbackRows,
          summary: { totalRooms: fallbackRows.length, departures: 0, stayovers: 0, arrivals: 0, vacant: 0, outOfService: 0, unknown: fallbackRows.length },
        },
      };
    }
    
    return detection;
  }, [trainingData.rawText]);

  const formatInfo = getFormatDescription(analysis.format);

  // Load existing config
  useEffect(() => {
    const loadConfig = async () => {
      if (!hotelId) {
        initFromAnalysis();
        setLoadingConfig(false);
        return;
      }
      try {
        const config = await loadHotelReportConfig(hotelId);
        if (config?.status_mappings && Object.keys(config.status_mappings).length > 0) {
          setStatusMappings(config.status_mappings as unknown as StatusMapping);
        } else {
          initFromAnalysis();
        }
      } catch {
        initFromAnalysis();
      } finally {
        setLoadingConfig(false);
      }
    };
    loadConfig();
  }, [hotelId]);

  const initFromAnalysis = () => {
    const initial: StatusMapping = {};
    for (const indicator of analysis.indicators) {
      if (indicator.suggestedType !== 'unknown') {
        initial[indicator.value] = indicator.suggestedType === 'out_of_service'
          ? 'out_of_service'
          : indicator.suggestedType === 'exclude'
          ? 'exclude'
          : normalizeCleaningType(indicator.suggestedType);
      }
    }
    setStatusMappings(initial);
  };

  // Stats
  const stats = useMemo(() => {
    let full = 0, quick = 0, none = 0, oos = 0, excluded = 0, unmapped = 0;
    for (const row of analysis.parsedData.rows) {
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

  const getFinalType = (row: ParsedRow): string => {
    const userMapping = row.statusIndicator ? statusMappings[row.statusIndicator.toUpperCase()] : null;
    return userMapping || row.detectedCleaningType;
  };

  const getCleaningBadge = (type: string) => {
    const opt = CLEANING_OPTIONS.find(o => o.value === type);
    return opt || { label: 'Inconnu', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  };

  // Unique unknown indicators that need mapping
  const unknownIndicators = useMemo(() => {
    const unknown = new Map<string, string[]>();
    for (const row of analysis.parsedData.rows) {
      const indicator = (row.statusIndicator || row.cleaningStatus || '').toUpperCase();
      if (!indicator) continue;
      const finalType = getFinalType(row);
      if (finalType === 'unknown') {
        if (!unknown.has(indicator)) {
          unknown.set(indicator, []);
        }
        const contexts = unknown.get(indicator)!;
        if (contexts.length < 2) {
          contexts.push(row.rawLine.substring(0, 80));
        }
      }
    }
    return Array.from(unknown.entries()).map(([value, contexts]) => ({ value, contexts }));
  }, [analysis.parsedData.rows, statusMappings]);

  const handleSaveConfig = async () => {
    if (!hotelId) return;
    try {
      await saveHotelReportConfig(hotelId, {
        column_mappings: [],
        status_mappings: statusMappings as unknown as ServiceStatusMapping,
        detected_format: analysis.format,
      });
      setSavedConfig(true);
      toast({ title: "✅ Configuration sauvegardée" });
    } catch {
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    }
  };

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
    toast({ title: "✨ Auto-mapping appliqué" });
  };

  const handleContinue = () => {
    // Auto-save mappings
    if (hotelId && Object.keys(statusMappings).length > 0) {
      handleSaveConfig();
    }

    const mappedRooms = analysis.parsedData.rows
      .filter(row => getFinalType(row) !== 'exclude')
      .map(row => {
        const finalType = getFinalType(row);
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
    };

    onComplete({ ...trainingData, extractedRooms: mappedRooms, detectedPmsType: analysis.format }, config);
  };

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Format & Stats summary */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Info className="h-3 w-3" />
          {formatInfo.name} ({analysis.confidence}%)
        </Badge>
        <Badge variant="secondary">{stats.total} chambres</Badge>
        <Badge className="bg-orange-100 text-orange-800 border-orange-200">{stats.full} départs</Badge>
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">{stats.quick} recouches</Badge>
        {stats.unmapped > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 ring-2 ring-yellow-400">
            ❓ {stats.unmapped} à mapper
          </Badge>
        )}
      </div>

      {/* Unknown indicators to map */}
      {unknownIndicators.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-sm">Statuts non reconnus — mappez-les :</span>
              </div>
              <Button size="sm" variant="outline" onClick={autoMapAll} className="gap-1 h-7">
                <Zap className="h-3 w-3" />
                Auto
              </Button>
            </div>
            <div className="space-y-2">
              {unknownIndicators.map(({ value, contexts }) => (
                <div key={value} className="flex items-center gap-3 p-2 rounded bg-background border">
                  <Badge variant="secondary" className="font-mono min-w-[80px] justify-center">
                    {value}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {contexts[0]}
                  </span>
                  <Select
                    value={statusMappings[value] || ''}
                    onValueChange={(v) => setStatusMappings(prev => ({ ...prev, [value]: v } as StatusMapping))}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {CLEANING_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.unmapped === 0 && stats.total > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Tous les statuts sont reconnus ! Vous pouvez continuer directement.
          </AlertDescription>
        </Alert>
      )}

      {/* Preview table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Chambre</TableHead>
                  <TableHead className="w-24">Statut</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="w-28">Nettoyage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.parsedData.rows.slice(0, 60).map((row, idx) => {
                  const finalType = getFinalType(row);
                  const badge = getCleaningBadge(finalType);
                  return (
                    <TableRow key={idx} className={finalType === 'unknown' ? 'bg-yellow-50' : ''}>
                      <TableCell className="font-mono font-bold">{row.roomNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {row.cleaningStatus || row.statusIndicator || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">
                        {row.guestName || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={badge.color}>{badge.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {analysis.parsedData.rows.length > 60 && (
              <p className="text-center text-muted-foreground py-2 text-sm">
                ... et {analysis.parsedData.rows.length - 60} autres chambres
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveConfig} className="gap-2" size="sm">
            <Save className="h-4 w-4" />
            {savedConfig ? 'Sauvé ✓' : 'Sauver config'}
          </Button>
          
          <Button onClick={handleContinue} className="gap-2" disabled={stats.unmapped > stats.total * 0.5}>
            Continuer ({stats.total - stats.excluded} chambres)
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
