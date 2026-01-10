import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Save, Check, FileText, Map, Loader2 } from 'lucide-react';
import { ExtractedRoom } from '@/services/pms/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TrainingData {
  reportName: string;
  rawText: string;
  extractedRooms: ExtractedRoom[];
  pmsType: string;
  cleaningTypeMapping: Record<string, string>;
}

interface TrainingStep4SaveProps {
  hotelId: string;
  trainingData: TrainingData;
  onComplete: () => void;
  onBack: () => void;
}

export const TrainingStep4Save: React.FC<TrainingStep4SaveProps> = ({
  hotelId,
  trainingData,
  onComplete,
  onBack,
}) => {
  const { toast } = useToast();
  const [patternName, setPatternName] = useState(trainingData.reportName || 'Pattern PMS');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!patternName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez entrer un nom pour ce pattern.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Generate regex patterns from the extracted rooms
      const roomPatterns = generateRoomPatterns(trainingData.extractedRooms);
      
      // Save to hotel_detection_rules table
      const { error } = await supabase
        .from('hotel_detection_rules')
        .insert({
          hotel_id: hotelId,
          rule_name: patternName,
          rule_type: 'room_pattern',
          description: description || `Pattern auto-généré depuis ${trainingData.reportName}`,
          condition: {
            pms_type: trainingData.pmsType,
            patterns: roomPatterns,
            sample_text: trainingData.rawText.substring(0, 500),
          },
          result: {
            cleaning_type_mapping: trainingData.cleaningTypeMapping,
            rooms_count: trainingData.extractedRooms.length,
          },
          is_active: true,
          priority: 10,
          created_by: (await supabase.auth.getUser()).data.user?.id || 'anonymous',
        });

      if (error) throw error;

      toast({
        title: "Pattern enregistré",
        description: `Le pattern "${patternName}" a été sauvegardé avec succès.`,
      });

      onComplete();
    } catch (error) {
      console.error('Error saving pattern:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le pattern.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Generate regex patterns from rooms for future detection
  const generateRoomPatterns = (rooms: ExtractedRoom[]): string[] => {
    const patterns: string[] = [];
    
    // Analyze room number formats
    const formats = new Set<string>();
    rooms.forEach(room => {
      const num = room.roomNumber;
      if (/^\d{3}$/.test(num)) formats.add('NNN');
      if (/^\d{3}-T$/.test(num)) formats.add('NNN-T');
      if (/^\d{3}[A-Z]$/.test(num)) formats.add('NNNA');
      if (/^\d{3}\+\d{3}$/.test(num)) formats.add('NNN+NNN');
      if (/Balcon/i.test(num)) formats.add('BALCON');
    });
    
    // Create patterns
    if (formats.has('NNN')) {
      patterns.push('\\b(\\d{3})\\s+(?:DBL|SGL|TPL|FAM|DUP|STU|SUI)');
    }
    if (formats.has('NNN-T')) {
      patterns.push('\\b(\\d{3}-T)\\s+(?:DBL|SGL|TPL|FAM|DUP|STU|SUI)');
    }
    if (formats.has('BALCON')) {
      patterns.push('\\b(\\d{3}(?:-T)?(?:-Balcon|/\\s*Balcon)?)\\s+(?:DBL|SGL|TPL|FAM|DUP|STU|SUI)');
    }
    if (formats.has('NNN+NNN')) {
      patterns.push('\\b(\\d{3}\\+\\d{3})\\s+(?:FAM|DUP)');
    }
    
    return patterns;
  };

  const aBlancCount = trainingData.extractedRooms.filter(r => 
    r.cleaningType === 'checkout'
  ).length;
  
  const recoucheCount = trainingData.extractedRooms.filter(r => 
    r.cleaningType === 'occupied'
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <FileText className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{trainingData.extractedRooms.length}</div>
            <p className="text-xs text-muted-foreground">Chambres</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-blue-500" />
            <div className="text-2xl font-bold">{aBlancCount}</div>
            <p className="text-xs text-muted-foreground">À blanc</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-green-500" />
            <div className="text-2xl font-bold">{recoucheCount}</div>
            <p className="text-xs text-muted-foreground">Recouche</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Map className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{Object.keys(trainingData.cleaningTypeMapping).length}</div>
            <p className="text-xs text-muted-foreground">Mappings</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Save form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations du pattern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="patternName">Nom du pattern *</Label>
              <Input
                id="patternName"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                placeholder="Ex: MEWS - Rapport quotidien"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes sur ce pattern..."
                rows={3}
              />
            </div>
            <div>
              <Label>Type PMS détecté</Label>
              <Badge variant="outline" className="mt-1">
                {trainingData.pmsType.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Mapping summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Correspondances configurées</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {Object.entries(trainingData.cleaningTypeMapping).map(([keyword, type]) => (
                  <div key={keyword} className="flex items-center justify-between p-2 bg-muted rounded">
                    <Badge variant="outline" className="font-mono">{keyword}</Badge>
                    <Badge className={
                      type === 'a_blanc' ? 'bg-blue-500' :
                      type === 'recouche' ? 'bg-green-500' : 'bg-gray-500'
                    }>
                      {type === 'a_blanc' ? 'À blanc' : type === 'recouche' ? 'Recouche' : 'Aucun'}
                    </Badge>
                  </div>
                ))}
                {Object.keys(trainingData.cleaningTypeMapping).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune correspondance configurée
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Enregistrer le pattern
        </Button>
      </div>
    </div>
  );
};
