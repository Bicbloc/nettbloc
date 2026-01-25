import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PlayCircle, 
  Check, 
  RefreshCw, 
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CLEANING_TYPE_LABELS, normalizeCleaningType } from '@/constants/cleaningTypes';

interface CombinationRule {
  id: string;
  rule_name: string;
  description?: string;
  priority: number;
  is_active: boolean;
  status_keywords: string[];
  arrival_date: 'present' | 'absent' | 'any';
  departure_date: 'present' | 'absent' | 'any';
  arrival_time: 'present' | 'absent' | 'any';
  departure_time: 'present' | 'absent' | 'any';
  night_info: 'present' | 'absent' | 'any';
  result_cleaning_type: string;
}

interface ExtractedRoom {
  roomNumber: string;
  status?: string;
  cleaningType?: string;
  guestName?: string;
  arrivalDate?: string;
  departureDate?: string;
  arrivalTime?: string;
  departureTime?: string;
  nightInfo?: string;
  originalText?: string;
  roomType?: string;
}

interface TestResult {
  roomNumber: string;
  originalType: string;
  appliedRule: CombinationRule | null;
  finalType: 'full' | 'quick' | 'none';
  detectedStatus: string;
  guestName?: string;
}

interface RuleTestPanelProps {
  hotelId: string;
  rules: CombinationRule[];
}

// Extraire le contexte depuis les données parsées
const extractContextFromRoom = (room: ExtractedRoom) => {
  // Détecter les mots-clés de statut
  const keywords: string[] = [];
  const status = (room.status || '').toUpperCase();
  
  // Ajouter le statut principal
  if (status.includes('DIR')) keywords.push('DIR');
  if (status.includes('INS')) keywords.push('INS');
  if (status.includes('PRO')) keywords.push('PRO');
  if (status.includes('SAL')) keywords.push('SAL');
  if (status.includes('PARTI')) keywords.push('PARTI');
  if (status.includes('RECOUCHE')) keywords.push('RECOUCHE');
  if (status.includes('ARRIVÉE') || status.includes('ARRIVEE')) keywords.push('ARRIVÉE');
  if (status.includes('DÉPART') || status.includes('DEPART')) keywords.push('DÉPART');
  if (status.includes('VACANT')) keywords.push('VACANT');
  if (status.includes('PROPRE')) keywords.push('PROPRE');
  
  return {
    hasArrivalDate: !!room.arrivalDate,
    hasDepartureDate: !!room.departureDate,
    hasArrivalTime: !!room.arrivalTime,
    hasDepartureTime: !!room.departureTime,
    hasNightInfo: !!room.nightInfo || (room.originalText?.toLowerCase().includes('night') ?? false),
    statusKeywords: keywords
  };
};

// Vérifier si une règle correspond
const matchesRule = (rule: CombinationRule, context: ReturnType<typeof extractContextFromRoom>): boolean => {
  // Vérifier les mots-clés
  if (rule.status_keywords && rule.status_keywords.length > 0) {
    const hasMatch = rule.status_keywords.some(kw => 
      context.statusKeywords.some(ctxKw => 
        ctxKw.toUpperCase().includes(kw.toUpperCase()) ||
        kw.toUpperCase().includes(ctxKw.toUpperCase())
      )
    );
    if (!hasMatch) return false;
  }
  
  // Vérifier chaque condition
  const check = (val: 'present' | 'absent' | 'any', actual: boolean) => {
    if (val === 'any') return true;
    return val === 'present' ? actual : !actual;
  };
  
  if (!check(rule.arrival_date, context.hasArrivalDate)) return false;
  if (!check(rule.departure_date, context.hasDepartureDate)) return false;
  if (!check(rule.arrival_time, context.hasArrivalTime)) return false;
  if (!check(rule.departure_time, context.hasDepartureTime)) return false;
  if (!check(rule.night_info, context.hasNightInfo)) return false;
  
  return true;
};

export const RuleTestPanel = ({ hotelId, rules }: RuleTestPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [reportName, setReportName] = useState<string>('');
  
  // Charger et tester le dernier rapport
  const runTest = async () => {
    setLoading(true);
    try {
      // Charger le dernier rapport d'entraînement avec les données extraites
      const { data, error } = await supabase
        .from('report_training_patterns')
        .select('report_name, extracted_data, created_at')
        .eq('hotel_id', hotelId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (!data?.extracted_data) {
        toast.error('Aucun rapport trouvé. Importez d\'abord un rapport dans l\'onglet Entraînement.');
        return;
      }
      
      setReportName(data.report_name || `Rapport du ${new Date(data.created_at).toLocaleDateString('fr-FR')}`);
      
      const activeRules = rules.filter(r => r.is_active).sort((a, b) => b.priority - a.priority);
      const extractedRooms = (data.extracted_data as unknown) as ExtractedRoom[];
      
      // Traiter chaque chambre extraite
      const results: TestResult[] = [];
      
      for (const room of extractedRooms) {
        if (!room.roomNumber) continue;
        
        const context = extractContextFromRoom(room);
        
        // Trouver la règle qui matche (par priorité)
        let appliedRule: CombinationRule | null = null;
        for (const rule of activeRules) {
          if (matchesRule(rule, context)) {
            appliedRule = rule;
            break;
          }
        }
        
        // Type original détecté par le parser
        const originalType = normalizeCleaningType(room.cleaningType);
        
        // Type final (règle appliquée ou original)
        const finalType = appliedRule 
          ? normalizeCleaningType(appliedRule.result_cleaning_type)
          : originalType;
        
        results.push({
          roomNumber: room.roomNumber,
          originalType: room.cleaningType || 'unknown',
          appliedRule,
          finalType,
          detectedStatus: room.status || context.statusKeywords.join(', ') || '-',
          guestName: room.guestName
        });
      }
      
      setTestResults(results);
      toast.success(`${results.length} chambres analysées`);
      
    } catch (err) {
      console.error('Erreur test:', err);
      toast.error('Erreur lors du test');
    } finally {
      setLoading(false);
    }
  };
  
  // Statistiques
  const stats = useMemo(() => ({
    total: testResults.length,
    full: testResults.filter(r => r.finalType === 'full').length,
    quick: testResults.filter(r => r.finalType === 'quick').length,
    none: testResults.filter(r => r.finalType === 'none').length,
    withRule: testResults.filter(r => r.appliedRule).length
  }), [testResults]);
  
  const getTypeColor = (type: 'full' | 'quick' | 'none') => {
    switch (type) {
      case 'full': return 'bg-orange-500';
      case 'quick': return 'bg-blue-500';
      case 'none': return 'bg-green-500';
    }
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Tester les règles</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {testResults.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {stats.withRule}/{stats.total} avec règle
                  </Badge>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <CardDescription>
              Teste vos règles sur le dernier rapport importé pour vérifier les résultats.
            </CardDescription>
            
            <Button 
              onClick={runTest} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Analyse...' : 'Lancer le test'}
            </Button>
            
            {rules.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                <p>Aucune règle définie.</p>
              </div>
            )}
            
            {testResults.length > 0 && (
              <>
                {/* Source */}
                {reportName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{reportName}</span>
                  </div>
                )}
                
                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-muted rounded-md">
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-md">
                    <p className="text-lg font-bold text-orange-600">{stats.full}</p>
                    <p className="text-xs text-muted-foreground">{CLEANING_TYPE_LABELS.full.fr}</p>
                  </div>
                  <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-md">
                    <p className="text-lg font-bold text-blue-600">{stats.quick}</p>
                    <p className="text-xs text-muted-foreground">{CLEANING_TYPE_LABELS.quick.fr}</p>
                  </div>
                  <div className="p-2 bg-green-100 dark:bg-green-950 rounded-md">
                    <p className="text-lg font-bold text-green-600">{stats.none}</p>
                    <p className="text-xs text-muted-foreground">Propre</p>
                  </div>
                </div>
                
                {/* Résultats */}
                <ScrollArea className="h-56 border rounded-md">
                  <div className="p-2 space-y-1">
                    {testResults.map((r, i) => (
                      <div 
                        key={i} 
                        className={`p-2 rounded border ${
                          r.appliedRule ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {r.roomNumber}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge className={`${getTypeColor(r.finalType)} text-white text-xs`}>
                              {CLEANING_TYPE_LABELS[r.finalType].fr}
                            </Badge>
                          </div>
                          {r.appliedRule ? (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              {r.appliedRule.rule_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Auto</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-primary font-medium">[{r.detectedStatus}]</span>
                          {r.guestName && (
                            <span className="text-xs text-muted-foreground truncate">{r.guestName}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
