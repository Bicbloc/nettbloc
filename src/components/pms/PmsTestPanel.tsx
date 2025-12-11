/**
 * Panel de test PMS - Permet de tester le parsing de rapports
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FlaskConical, 
  Play, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Loader2
} from 'lucide-react';
import { unifiedParserService } from '@/services/pms/UnifiedParserService';
import { ExtractedRoom, CLEANING_TYPE_LABELS } from '@/services/pms/types';
import { toast } from 'sonner';

const SAMPLE_REPORTS = {
  generic: `Rapport Housekeeping 11/12/2024
Chambre 101 - DEPART - Sale
Chambre 102 - RECOUCHE - Occupée  
Chambre 103 - ARRIVÉE - Propre
Chambre 104 - PARTI + ARRIVÉE
Chambre 05 - STAYOVER
Room 201 - CHECKOUT
Room 202 - DIRTY
Room 203 - CLEAN`,
  
  mews: `MEWS COMMANDER - Rapport Housekeeping
Space Status Report 11/12/2024
101 - DIR - Nuit 3/5
102 - INS - Arrival
103 - SAL - Checkout
104 - DEP + ARR
05 - Occupied Dirty
06 - Vacant Clean`,

  opera: `OPERA PMS - Housekeeping Report
Property: Hotel Example
Date: 11/12/2024
Room 101 - CO - Due Out
Room 102 - OC - Stayover  
Room 103 - VC - Arrival Due In
Room 104 - VD - Dirty
Room 09 - Occupied Clean`,
};

interface ParseResult {
  rooms: ExtractedRoom[];
  pmsType: string;
  confidence: number;
  processingTime: number;
}

export function PmsTestPanel() {
  const [reportText, setReportText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);

  const handleTest = async () => {
    if (!reportText.trim()) {
      toast.error('Veuillez entrer un rapport à tester');
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Utiliser le mode test (sans hotelId réel)
      const parseResult = await unifiedParserService.parseReportHybrid(
        reportText,
        'test-mode', // Mode test
        false // Pas d'IA pour le test local
      );

      const processingTime = Date.now() - startTime;

      setResult({
        rooms: parseResult.rooms,
        pmsType: parseResult.pmsType,
        confidence: parseResult.confidence,
        processingTime
      });

      toast.success(`${parseResult.rooms.length} chambres détectées en ${processingTime}ms`);
    } catch (error) {
      console.error('Erreur de parsing:', error);
      toast.error('Erreur lors du parsing du rapport');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSample = (type: keyof typeof SAMPLE_REPORTS) => {
    setReportText(SAMPLE_REPORTS[type]);
    setResult(null);
  };

  const getCleaningBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' => {
    if (type === 'a_blanc' || type === 'full') return 'default';
    if (type === 'recouche' || type === 'quick') return 'secondary';
    return 'outline';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Test du Parser PMS
        </CardTitle>
        <CardDescription>
          Testez le parsing de rapports PMS pour vérifier la détection des chambres
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Boutons de samples */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Exemples:</span>
          <Button variant="outline" size="sm" onClick={() => loadSample('generic')}>
            <FileText className="h-4 w-4 mr-1" />
            Générique
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadSample('mews')}>
            <FileText className="h-4 w-4 mr-1" />
            Mews
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadSample('opera')}>
            <FileText className="h-4 w-4 mr-1" />
            Opera
          </Button>
        </div>

        {/* Zone de texte */}
        <Textarea
          placeholder="Collez votre rapport PMS ici pour tester le parsing..."
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />

        {/* Boutons d'action */}
        <div className="flex gap-2">
          <Button onClick={handleTest} disabled={isLoading || !reportText.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Tester le parsing
          </Button>
          <Button 
            variant="outline" 
            onClick={() => { setReportText(''); setResult(null); }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Effacer
          </Button>
        </div>

        {/* Résultats */}
        {result && (
          <>
            <Separator />
            
            <div className="space-y-3">
              {/* Métriques */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">PMS détecté:</span>
                  <Badge variant="outline">{result.pmsType}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Confiance:</span>
                  <Badge variant={result.confidence >= 70 ? 'default' : 'secondary'}>
                    {result.confidence}%
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Temps:</span>
                  <span>{result.processingTime}ms</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Chambres:</span>
                  <Badge>{result.rooms.length}</Badge>
                </div>
              </div>

              {/* Liste des chambres */}
              <ScrollArea className="h-[300px] border rounded-md">
                <div className="p-3 space-y-2">
                  {result.rooms.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      Aucune chambre détectée
                    </div>
                  ) : (
                    result.rooms.map((room, index) => (
                      <div 
                        key={`${room.roomNumber}-${index}`}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="font-mono font-medium">
                            {room.roomNumber}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {room.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getCleaningBadgeVariant(room.cleaningType)}>
                            {CLEANING_TYPE_LABELS[room.cleaningType] || room.cleaningType}
                          </Badge>
                          {room.confidence && (
                            <span className="text-xs text-muted-foreground">
                              {room.confidence}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Debug info */}
              {result.rooms.length > 0 && result.rooms[0].debugInfo && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Détails de debug
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(result.rooms.map(r => ({
                      room: r.roomNumber,
                      status: r.status,
                      cleaning: r.cleaningType,
                      keywords: r.debugInfo?.detectedKeywords,
                      rule: r.debugInfo?.appliedRule,
                      confidence: r.confidence
                    })), null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
