import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  PlayCircle, 
  Check, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  FileText, 
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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

interface TestResult {
  roomNumber: string;
  rawLine: string;
  originalType: string;
  appliedRule: CombinationRule | null;
  finalType: string;
  matched: boolean;
  context: {
    hasArrivalDate: boolean;
    hasDepartureDate: boolean;
    hasArrivalTime: boolean;
    hasDepartureTime: boolean;
    hasNightInfo: boolean;
    keywords: string[];
    detectedCleaningType: 'full' | 'quick' | 'none';
    apaleoStatus: string;
  };
}

interface RuleTestPanelProps {
  hotelId: string;
  rules: CombinationRule[];
}

// Détecter le type de nettoyage selon les patterns Apaleo/PMS
type ApaleoStatus = 'parti' | 'en_arrivee' | 'arrive' | 'recouche' | 'unknown';

const detectApaleoStatus = (line: string): { status: ApaleoStatus; cleaningType: 'full' | 'quick' | 'none' } => {
  // Pattern Apaleo : "Parti", "En arrivée", "Arrivé", "Recouche"
  if (/\bparti\b/i.test(line)) {
    return { status: 'parti', cleaningType: 'full' };
  }
  if (/\ben\s*arrivée?\b/i.test(line)) {
    return { status: 'en_arrivee', cleaningType: 'full' };
  }
  if (/\barrivé\b/i.test(line) && !/\ben\s*arrivée?\b/i.test(line)) {
    return { status: 'arrive', cleaningType: 'quick' };
  }
  if (/\brecouche\b/i.test(line)) {
    return { status: 'recouche', cleaningType: 'quick' };
  }
  return { status: 'unknown', cleaningType: 'full' };
};

// Simuler le contexte d'une ligne de rapport
const extractContext = (line: string) => {
  const upper = line.toUpperCase();
  
  // Détecter les dates (format DD/MM/YYYY)
  const dateMatches = line.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g) || [];
  const hasArrivalDate = dateMatches.length >= 1;
  const hasDepartureDate = dateMatches.length >= 2;
  
  // Détecter les heures (format HH:MM)
  const timeMatches = line.match(/\d{1,2}:\d{2}/g) || [];
  const hasArrivalTime = timeMatches.length >= 1;
  const hasDepartureTime = timeMatches.length >= 2;
  
  // Détecter "Nuit X/Y"
  const hasNightInfo = /(?:nuit|night)\s*\d+\s*[\/\\]\s*\d+/i.test(line);
  
  // Extraire les keywords avec patterns plus flexibles
  const keywords: string[] = [];
  
  // Patterns spécifiques Apaleo
  if (/\bparti\b/i.test(line)) keywords.push('PARTI');
  if (/\ben\s*arrivée?\b/i.test(line)) keywords.push('EN_ARRIVÉE');
  if (/\barrivé\b/i.test(line) && !/\ben\s*arrivée?\b/i.test(line)) keywords.push('ARRIVÉ');
  if (/\brecouche\b/i.test(line)) keywords.push('RECOUCHE');
  
  // Autres keywords PMS
  const simpleKeywords = ['SAL', 'DIR', 'INS', 'PRO', 'DEP', 'OCC', 'CHECKOUT', 'DÉPART'];
  for (const kw of simpleKeywords) {
    if (upper.includes(kw)) keywords.push(kw);
  }
  
  // Détection du type selon logique Apaleo
  const apaleoResult = detectApaleoStatus(line);
  
  return {
    hasArrivalDate,
    hasDepartureDate,
    hasArrivalTime,
    hasDepartureTime,
    hasNightInfo,
    keywords,
    detectedCleaningType: apaleoResult.cleaningType,
    apaleoStatus: apaleoResult.status
  };
};

// Vérifier si une règle correspond au contexte
const matchesRule = (rule: CombinationRule, context: TestResult['context']): boolean => {
  // Vérifier les keywords
  if (rule.status_keywords.length > 0) {
    const hasKeyword = rule.status_keywords.some(kw => 
      context.keywords.includes(kw.toUpperCase())
    );
    if (!hasKeyword) return false;
  }
  
  // Vérifier les conditions de date/heure
  const checkCondition = (value: 'present' | 'absent' | 'any', actual: boolean) => {
    if (value === 'any') return true;
    if (value === 'present') return actual;
    if (value === 'absent') return !actual;
    return true;
  };
  
  if (!checkCondition(rule.arrival_date, context.hasArrivalDate)) return false;
  if (!checkCondition(rule.departure_date, context.hasDepartureDate)) return false;
  if (!checkCondition(rule.arrival_time, context.hasArrivalTime)) return false;
  if (!checkCondition(rule.departure_time, context.hasDepartureTime)) return false;
  if (!checkCondition(rule.night_info, context.hasNightInfo)) return false;
  
  return true;
};

export const RuleTestPanel = ({ hotelId, rules }: RuleTestPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [reportText, setReportText] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  
  // Charger le dernier rapport d'entraînement
  const loadTestData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_training_patterns')
        .select('raw_text, extracted_data')
        .eq('hotel_id', hotelId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (!data?.raw_text) {
        toast.error('Aucun rapport d\'entraînement trouvé. Importez d\'abord un rapport.');
        return;
      }
      
      setReportText(data.raw_text);
      
      // Parser les lignes du rapport
      const lines = data.raw_text.split('\n').filter((l: string) => l.trim());
      const activeRules = rules.filter(r => r.is_active).sort((a, b) => b.priority - a.priority);
      
      // Détecter les chambres dans les lignes
      const results: TestResult[] = [];
      const roomPattern = /^\s*(\d{1,4})\s+/;
      
      for (const line of lines) {
        const roomMatch = line.match(roomPattern);
        if (!roomMatch) continue;
        
        const roomNumber = roomMatch[1].padStart(2, '0');
        const context = extractContext(line);
        
        // Trouver la première règle qui matche
        let appliedRule: CombinationRule | null = null;
        for (const rule of activeRules) {
          if (matchesRule(rule, context)) {
            appliedRule = rule;
            break;
          }
        }
        
        // Déterminer le type original selon la logique Apaleo/PMS détectée
        const originalType = context.detectedCleaningType === 'quick' ? 'recouche' : 
                             context.detectedCleaningType === 'none' ? 'none' : 'a_blanc';
        
        const finalType = appliedRule ? appliedRule.result_cleaning_type : originalType;
        
        results.push({
          roomNumber,
          rawLine: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
          originalType,
          appliedRule,
          finalType,
          matched: appliedRule !== null,
          context
        });
      }
      
      setTestResults(results);
      toast.success(`Test effectué sur ${results.length} chambres`);
      
    } catch (error) {
      console.error('Erreur test règles:', error);
      toast.error('Erreur lors du test');
    } finally {
      setLoading(false);
    }
  };
  
  // Statistiques des résultats
  const stats = useMemo(() => {
    const total = testResults.length;
    const matched = testResults.filter(r => r.matched).length;
    const aBlanc = testResults.filter(r => r.finalType === 'full' || r.finalType === 'a_blanc').length;
    const recouche = testResults.filter(r => r.finalType === 'quick' || r.finalType === 'recouche').length;
    const propre = testResults.filter(r => r.finalType === 'none').length;
    
    return { total, matched, aBlanc, recouche, propre };
  }, [testResults]);
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'full':
      case 'a_blanc':
        return 'bg-orange-500';
      case 'quick':
      case 'recouche':
        return 'bg-blue-500';
      case 'none':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'full':
      case 'a_blanc':
        return 'À blanc';
      case 'quick':
      case 'recouche':
        return 'Recouche';
      case 'none':
        return 'Propre';
      default:
        return type;
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
                <CardTitle className="text-base">Tester les règles en direct</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {testResults.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {stats.matched}/{stats.total} règles appliquées
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <CardDescription>
              Testez vos règles sur le dernier rapport d'entraînement pour voir comment elles seront appliquées.
            </CardDescription>
            
            <Button 
              onClick={loadTestData} 
              disabled={loading || rules.length === 0}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Test en cours...' : 'Lancer le test'}
            </Button>
            
            {rules.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                <p>Aucune règle définie. Créez des règles pour les tester.</p>
              </div>
            )}
            
            {testResults.length > 0 && (
              <>
                {/* Statistiques */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-muted rounded-md">
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Chambres</p>
                  </div>
                  <div className="text-center p-2 bg-orange-100 dark:bg-orange-950 rounded-md">
                    <p className="text-lg font-bold text-orange-600">{stats.aBlanc}</p>
                    <p className="text-xs text-muted-foreground">À blanc</p>
                  </div>
                  <div className="text-center p-2 bg-blue-100 dark:bg-blue-950 rounded-md">
                    <p className="text-lg font-bold text-blue-600">{stats.recouche}</p>
                    <p className="text-xs text-muted-foreground">Recouche</p>
                  </div>
                  <div className="text-center p-2 bg-green-100 dark:bg-green-950 rounded-md">
                    <p className="text-lg font-bold text-green-600">{stats.propre}</p>
                    <p className="text-xs text-muted-foreground">Propre</p>
                  </div>
                </div>
                
                <Separator />
                
                {/* Résultats détaillés */}
                <ScrollArea className="h-64 border rounded-md">
                  <div className="p-2 space-y-2">
                    {testResults.map((result, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-md border ${
                          result.matched 
                            ? 'bg-primary/5 border-primary/20' 
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              Ch. {result.roomNumber}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge className={`${getTypeColor(result.finalType)} text-white`}>
                              {getTypeLabel(result.finalType)}
                            </Badge>
                          </div>
                          {result.matched ? (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              {result.appliedRule?.rule_name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Défaut
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-xs font-mono text-muted-foreground truncate">
                          {result.rawLine}
                        </p>
                        
                        {/* Contexte détecté */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {/* Statut Apaleo détecté */}
                          {result.context.apaleoStatus !== 'unknown' && (
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] py-0 ${
                                result.context.apaleoStatus === 'recouche' || result.context.apaleoStatus === 'arrive'
                                  ? 'border-blue-500 text-blue-600'
                                  : 'border-orange-500 text-orange-600'
                              }`}
                            >
                              🏷️ {result.context.apaleoStatus === 'parti' ? 'Parti' :
                                  result.context.apaleoStatus === 'en_arrivee' ? 'En arrivée' :
                                  result.context.apaleoStatus === 'arrive' ? 'Arrivé' :
                                  result.context.apaleoStatus === 'recouche' ? 'Recouche' : ''}
                            </Badge>
                          )}
                          {result.context.hasArrivalDate && (
                            <Badge variant="outline" className="text-[10px] py-0">📅 Arrivée</Badge>
                          )}
                          {result.context.hasDepartureDate && (
                            <Badge variant="outline" className="text-[10px] py-0">📅 Départ</Badge>
                          )}
                          {result.context.hasArrivalTime && (
                            <Badge variant="outline" className="text-[10px] py-0">⏰ H.Arr</Badge>
                          )}
                          {result.context.hasDepartureTime && (
                            <Badge variant="outline" className="text-[10px] py-0">⏰ H.Dép</Badge>
                          )}
                          {result.context.hasNightInfo && (
                            <Badge variant="outline" className="text-[10px] py-0">🌙 Nuit</Badge>
                          )}
                          {result.context.keywords.map(kw => (
                            <Badge key={kw} variant="secondary" className="text-[10px] py-0">
                              {kw}
                            </Badge>
                          ))}
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
