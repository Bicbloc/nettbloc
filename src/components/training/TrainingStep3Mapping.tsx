import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRight, Map, Zap } from 'lucide-react';
import { ExtractedRoom } from '@/services/pms/types';
import { useToast } from '@/hooks/use-toast';

interface TrainingStep3MappingProps {
  extractedRooms: ExtractedRoom[];
  onComplete: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

const CLEANING_TYPES = [
  { value: 'a_blanc', label: 'À blanc (Départ)', color: 'bg-blue-500' },
  { value: 'recouche', label: 'Recouche (Occupé)', color: 'bg-green-500' },
  { value: 'none', label: 'Pas de ménage', color: 'bg-gray-500' },
];

const PMS_STATUS_KEYWORDS = [
  'INS', 'PRO', 'SAL', 'DEP', 'DIR', 'DND', 'OOO', 'VAC', 'OCC', 
  'ARR', 'STAY', 'CHECK-IN', 'CHECK-OUT', 'DIRTY', 'CLEAN'
];

export const TrainingStep3Mapping: React.FC<TrainingStep3MappingProps> = ({
  extractedRooms,
  onComplete,
  onBack,
}) => {
  const { toast } = useToast();
  
  // Extract unique status keywords found in the rooms
  const detectedKeywords = useMemo(() => {
    const keywords = new Set<string>();
    
    extractedRooms.forEach(room => {
      const rawLine = room.originalText?.toUpperCase() || room.status?.toUpperCase() || '';
      PMS_STATUS_KEYWORDS.forEach(keyword => {
        if (rawLine.includes(keyword)) {
          keywords.add(keyword);
        }
      });
    });
    
    return Array.from(keywords);
  }, [extractedRooms]);

  // Initialize mapping with sensible defaults
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    detectedKeywords.forEach(keyword => {
      // Default mappings based on common PMS conventions
      if (['DEP', 'DIR', 'SAL', 'CHECK-OUT', 'VAC'].includes(keyword)) {
        initial[keyword] = 'a_blanc';
      } else if (['PRO', 'INS', 'ARR', 'STAY', 'OCC', 'CHECK-IN'].includes(keyword)) {
        initial[keyword] = 'recouche';
      } else if (['DND', 'OOO'].includes(keyword)) {
        initial[keyword] = 'none';
      } else {
        initial[keyword] = 'recouche'; // Default to recouche
      }
    });
    return initial;
  });

  const updateMapping = (keyword: string, value: string) => {
    setMapping(prev => ({
      ...prev,
      [keyword]: value,
    }));
  };

  // Apply mapping to rooms for preview
  const mappedRooms = useMemo(() => {
    return extractedRooms.map(room => {
      const rawLine = room.originalText?.toUpperCase() || room.status?.toUpperCase() || '';
      let mappedType = 'recouche'; // default
      
      for (const keyword of Object.keys(mapping)) {
        if (rawLine.includes(keyword)) {
          mappedType = mapping[keyword];
          break;
        }
      }
      
      return {
        ...room,
        mappedCleaningType: mappedType,
      };
    });
  }, [extractedRooms, mapping]);

  // Count rooms by mapped type
  const typeCounts = useMemo(() => {
    const counts = { a_blanc: 0, recouche: 0, none: 0 };
    mappedRooms.forEach(room => {
      const type = room.mappedCleaningType as keyof typeof counts;
      if (counts[type] !== undefined) {
        counts[type]++;
      }
    });
    return counts;
  }, [mappedRooms]);

  const handleContinue = () => {
    onComplete(mapping);
  };

  const autoMap = () => {
    const newMapping: Record<string, string> = {};
    detectedKeywords.forEach(keyword => {
      if (['DEP', 'DIR', 'SAL', 'CHECK-OUT', 'VAC', 'DIRTY'].includes(keyword)) {
        newMapping[keyword] = 'a_blanc';
      } else if (['PRO', 'INS', 'ARR', 'STAY', 'OCC', 'CHECK-IN'].includes(keyword)) {
        newMapping[keyword] = 'recouche';
      } else if (['DND', 'OOO'].includes(keyword)) {
        newMapping[keyword] = 'none';
      } else {
        newMapping[keyword] = 'recouche';
      }
    });
    setMapping(newMapping);
    toast({
      title: "Mapping automatique",
      description: "Les correspondances ont été définies automatiquement.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-blue-500">{typeCounts.a_blanc}</div>
            <p className="text-sm text-muted-foreground">À blanc</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-green-500">{typeCounts.recouche}</div>
            <p className="text-sm text-muted-foreground">Recouche</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-gray-500">{typeCounts.none}</div>
            <p className="text-sm text-muted-foreground">Pas de ménage</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Mapping configuration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Map className="w-4 h-4" />
                Correspondances PMS
              </CardTitle>
              <Button size="sm" variant="outline" onClick={autoMap}>
                <Zap className="w-4 h-4 mr-1" />
                Auto
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {detectedKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun mot-clé de statut détecté dans les chambres.
              </p>
            ) : (
              <div className="space-y-3">
                {detectedKeywords.map(keyword => (
                  <div key={keyword} className="flex items-center justify-between gap-4">
                    <Badge variant="outline" className="font-mono">
                      {keyword}
                    </Badge>
                    <Select
                      value={mapping[keyword] || 'recouche'}
                      onValueChange={(v) => updateMapping(keyword, v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLEANING_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${type.color}`} />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aperçu des chambres</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {mappedRooms.map(room => {
                  const type = CLEANING_TYPES.find(t => t.value === room.mappedCleaningType);
                  return (
                    <div
                      key={room.roomNumber}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span className="font-mono font-bold">{room.roomNumber}</span>
                      <Badge className={type?.color || 'bg-gray-500'}>
                        {type?.label.split(' ')[0] || room.mappedCleaningType}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button onClick={handleContinue}>
          Continuer vers l'enregistrement
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
