/**
 * Preview/Test d'une règle de nettoyage
 * Montre l'effet de la règle sur les chambres
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  Play,
  AlertCircle
} from 'lucide-react';
import {
  CleaningRule,
  ExtractedRoom,
  CLEANING_TYPE_LABELS,
  CleaningType,
} from '@/services/pms/types';
import { testRuleAgainstRooms } from '@/services/cleaningRulesEngine';
import { unifiedParserService } from '@/services/pms';
import { toast } from 'sonner';

interface RulePreviewProps {
  rule: CleaningRule;
  hotelId: string;
  onClose: () => void;
}

export function RulePreview({ rule, hotelId, onClose }: RulePreviewProps) {
  const [testText, setTestText] = useState('');
  const [testRooms, setTestRooms] = useState<ExtractedRoom[]>([]);
  const [testResult, setTestResult] = useState<{
    matchedCount: number;
    matchedRooms: string[];
    wouldChange: number;
    details: Array<{
      roomNumber: string;
      originalCleaning: string;
      newCleaning: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Charger les chambres actuelles de l'hôtel
  useEffect(() => {
    loadCurrentRooms();
  }, [hotelId]);

  const loadCurrentRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('hotel_id', hotelId)
        .limit(50);

      if (!error && data) {
        const rooms: ExtractedRoom[] = data.map(r => ({
          roomNumber: r.room_number,
          status: r.status || 'unknown',
          cleaningType: (r.cleaning_type as CleaningType) || 'a_blanc',
          guestName: r.notes || undefined,
          arrivalDate: undefined,
          departureDate: undefined,
        }));
        setTestRooms(rooms);
        
        // Auto-tester avec les chambres existantes
        if (rooms.length > 0) {
          const result = testRuleAgainstRooms(rule, rooms);
          setTestResult(result);
        }
      }
    } catch (error) {
      console.error('Erreur chargement chambres:', error);
    }
  };

  const handleTestWithText = async () => {
    if (!testText.trim()) {
      toast.error('Entrez du texte à analyser');
      return;
    }

    setLoading(true);
    try {
      const parsed = await unifiedParserService.parseReport(testText, hotelId);
      if (parsed.rooms.length === 0) {
        toast.error('Aucune chambre détectée dans le texte');
        setLoading(false);
        return;
      }

      setTestRooms(parsed.rooms);
      const result = testRuleAgainstRooms(rule, parsed.rooms, testText);
      setTestResult(result);
      toast.success(`${parsed.rooms.length} chambre(s) analysée(s)`);
    } catch (error) {
      console.error('Erreur parsing:', error);
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const getCleaningBadgeVariant = (type: string) => {
    const normalized = type.toLowerCase();
    if (normalized === 'a_blanc' || normalized === 'à blanc') return 'default';
    if (normalized === 'recouche') return 'secondary';
    return 'outline';
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" />
            Tester la règle : {rule.name}
          </DialogTitle>
          <DialogDescription>
            Vérifiez l'effet de cette règle sur vos chambres
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Résumé de la règle */}
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Si correspondance →</span>
                <Badge variant={getCleaningBadgeVariant(rule.resultCleaningType)}>
                  {CLEANING_TYPE_LABELS[rule.resultCleaningType]}
                </Badge>
                <Badge variant="outline">Priorité {rule.priority}</Badge>
              </div>
              {rule.description && (
                <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
              )}
            </CardContent>
          </Card>

          {/* Test avec texte */}
          <div className="space-y-2">
            <Label>Tester avec un texte de rapport (optionnel)</Label>
            <Textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Collez un extrait de rapport PMS pour tester..."
              rows={3}
            />
            <Button 
              onClick={handleTestWithText} 
              disabled={loading || !testText.trim()}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? 'Analyse en cours...' : 'Analyser le texte'}
            </Button>
          </div>

          <Separator />

          {/* Résultats */}
          {testResult && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="py-3 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {testRooms.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Chambres testées</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResult.matchedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Correspondances</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      {testResult.wouldChange}
                    </div>
                    <div className="text-xs text-muted-foreground">Modifications</div>
                  </CardContent>
                </Card>
              </div>

              {/* Chambres correspondantes */}
              {testResult.matchedCount > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Chambres correspondantes
                  </h4>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {testResult.matchedRooms.map(roomNum => {
                        const room = testRooms.find(r => r.roomNumber === roomNum);
                        const change = testResult.details.find(d => d.roomNumber === roomNum);
                        
                        return (
                          <Card key={roomNum}>
                            <CardContent className="py-2 px-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium">{roomNum}</span>
                                  {room && (
                                    <Badge variant="outline" className="text-xs">
                                      {room.status}
                                    </Badge>
                                  )}
                                </div>
                                {change ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Badge variant="outline">{change.originalCleaning}</Badge>
                                    <ArrowRight className="h-3 w-3" />
                                    <Badge variant={getCleaningBadgeVariant(change.newCleaning)}>
                                      {change.newCleaning}
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Pas de changement
                                  </span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="py-8 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">
                      Aucune chambre ne correspond à cette règle
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Essayez avec un autre texte ou vérifiez les conditions
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {!testResult && testRooms.length === 0 && (
            <Card className="bg-muted/30">
              <CardContent className="py-8 text-center">
                <TestTube className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Aucune chambre disponible pour le test
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Collez un texte de rapport PMS ci-dessus pour tester
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
