import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Zap, CheckCircle2, Info, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TrainingData } from './TrainingWizard';
import { detectReportFormat, getFormatDescription, CleaningIndicator } from '@/services/training/ReportFormatDetector';
import { parseReport, ParsedRoomLine } from '@/services/training/SmartReportParser';
import { normalizeCleaningType, CleaningType } from '@/constants/cleaningTypes';

// Types de nettoyage disponibles
const CLEANING_OPTIONS = [
  { value: 'full', label: 'À blanc', description: 'Nettoyage complet (départ)', color: 'bg-orange-500' },
  { value: 'quick', label: 'Recouche', description: 'Nettoyage rapide (client en place)', color: 'bg-blue-500' },
  { value: 'none', label: 'Aucun', description: 'Pas de nettoyage requis', color: 'bg-gray-400' },
  { value: 'out_of_service', label: 'Hors service', description: 'Chambre bloquée', color: 'bg-purple-500' },
  { value: 'exclude', label: 'Exclure', description: 'Ignorer cette ligne', color: 'bg-red-500' },
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

  // Détecter le format et parser le rapport
  const analysis = useMemo(() => {
    const detection = detectReportFormat(trainingData.rawText);
    const parseResult = parseReport(trainingData.rawText, detection);
    return { detection, parseResult };
  }, [trainingData.rawText]);

  const { detection, parseResult } = analysis;
  const formatInfo = getFormatDescription(detection.format);

  // Initialiser les mappings avec les suggestions
  useEffect(() => {
    const initialMappings: StatusMapping = {};
    for (const indicator of detection.indicators) {
      if (indicator.suggestedType !== 'unknown') {
        initialMappings[indicator.value] = indicator.suggestedType === 'out_of_service' 
          ? 'out_of_service' 
          : indicator.suggestedType === 'exclude'
          ? 'exclude'
          : normalizeCleaningType(indicator.suggestedType);
      }
    }
    setStatusMappings(initialMappings);
  }, [detection.indicators]);

  // Stats en temps réel
  const stats = useMemo(() => {
    let full = 0, quick = 0, none = 0, oos = 0, excluded = 0, unmapped = 0;
    
    for (const room of parseResult.rooms) {
      const indicator = room.statusIndicators[0];
      const mapping = indicator ? statusMappings[indicator] : '';
      
      if (mapping === 'full') full++;
      else if (mapping === 'quick') quick++;
      else if (mapping === 'none') none++;
      else if (mapping === 'out_of_service') oos++;
      else if (mapping === 'exclude') excluded++;
      else unmapped++;
    }
    
    return { total: parseResult.rooms.length, full, quick, none, oos, excluded, unmapped };
  }, [parseResult.rooms, statusMappings]);

  // Auto-map tous les indicateurs non mappés
  const autoMapAll = () => {
    const newMappings = { ...statusMappings };
    for (const indicator of detection.indicators) {
      if (!newMappings[indicator.value] && indicator.suggestedType !== 'unknown') {
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

  // Continuer vers l'étape suivante
  const handleContinue = () => {
    // Convertir les rooms parsées en format ExtractedRoom
    const mappedRooms = parseResult.rooms
      .filter(room => {
        const indicator = room.statusIndicators[0];
        return !indicator || statusMappings[indicator] !== 'exclude';
      })
      .map(room => {
        const indicator = room.statusIndicators[0];
        const mapping = indicator ? statusMappings[indicator] : 'quick';
        
        return {
          roomNumber: room.roomNumber,
          cleaningType: (mapping === 'out_of_service' ? 'none' : mapping || 'quick') as CleaningType,
          status: indicator || '',
          originalText: room.rawLine,
          validated: true,
        };
      });

    const config: MappingConfig = {
      formatDetected: detection.format,
      statusMappings,
      exclusionPatterns: parseResult.excludedLines.slice(0, 10),
    };

    onComplete({
      ...trainingData,
      extractedRooms: mappedRooms,
      detectedPmsType: detection.format,
    }, config);
  };

  return (
    <div className="space-y-4">
      {/* Format détecté */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Format détecté:</strong> {formatInfo.name} ({detection.confidence}% confiance)
          <br />
          <span className="text-muted-foreground text-sm">{formatInfo.description}</span>
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        <StatCard value={stats.total} label="Total" className="bg-slate-50" />
        <StatCard value={stats.full} label="À blanc" className="bg-orange-50 text-orange-700" />
        <StatCard value={stats.quick} label="Recouche" className="bg-blue-50 text-blue-700" />
        <StatCard value={stats.none} label="Aucun" className="bg-gray-50 text-gray-700" />
        <StatCard value={stats.oos} label="H.S." className="bg-purple-50 text-purple-700" />
        <StatCard value={stats.excluded} label="Exclues" className="bg-red-50 text-red-700" />
        <StatCard value={stats.unmapped} label="À mapper" className="bg-yellow-50 text-yellow-700" />
      </div>

      {/* Mapping des indicateurs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Mapper les indicateurs de statut</CardTitle>
              <CardDescription className="text-xs">
                Associez chaque code trouvé dans le rapport au type de nettoyage correspondant
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={autoMapAll} className="gap-1">
              <Zap className="h-3 w-3" />
              Auto-mapper
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {detection.indicators.map((indicator) => (
                <IndicatorRow
                  key={indicator.value}
                  indicator={indicator}
                  mapping={statusMappings[indicator.value] || ''}
                  onMappingChange={(value) => setStatusMappings(prev => ({ ...prev, [indicator.value]: value } as StatusMapping))}
                />
              ))}
              {detection.indicators.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun indicateur de statut détecté automatiquement.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Button onClick={handleContinue} className="gap-2" disabled={stats.unmapped > stats.total * 0.5}>
          Continuer
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
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50">
      <Badge variant="secondary" className="font-mono min-w-[80px] justify-center">
        {indicator.value}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">
          {indicator.context[0]?.substring(0, 60)}...
        </p>
      </div>
      <Badge variant="outline" className="text-xs">
        ×{indicator.occurrences}
      </Badge>
      <Select value={mapping} onValueChange={(val) => onMappingChange(val as StatusMapping[string])}>
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
