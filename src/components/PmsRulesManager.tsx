import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Trash2, Play, Settings, Cpu, CheckCircle, XCircle, Zap, AlertTriangle, PenLine, Save, Sparkles, ChevronDown, Wand2, FileText, Calendar, Download } from "lucide-react";
import { pmsAdapterFactory, unifiedParserService, mewsDetectionService, ExtractedRoom, CleaningType } from "@/services/pms";
import { localRoomParser, ParsedRoom } from "@/services/pms/LocalRoomParser";
import { TestResultItem } from "@/components/pms/TestResultItem";
import { ManualCorrectionPanel } from "@/components/pms/ManualCorrectionPanel";
import { SimplifiedRulesManager } from "@/components/pms/SimplifiedRulesManager";

interface PmsRule {
  id: string;
  hotel_id: string | null;
  pms_type: string;
  rule_name: string;
  keywords: string[];
  room_number_regex: string | null;
  status_mappings: any;
  combination_rules: any;
  date_formats: string[];
  priority: number;
  is_active: boolean;
  is_default: boolean;
  source: string;
  created_at: string;
}

interface PmsRulesManagerProps {
  hotelId: string;
}

// Résumé des résultats
const TestResultSummary = ({ 
  rooms, 
  reportDate 
}: { 
  rooms: ExtractedRoom[]; 
  reportDate: Date;
}) => {
  const aBlancCount = rooms.filter(r => r.cleaningType === 'a_blanc' || r.cleaningType === 'full').length;
  const recoucheCount = rooms.filter(r => r.cleaningType === 'recouche' || r.cleaningType === 'quick').length;
  const noneCount = rooms.filter(r => r.cleaningType === 'none').length;
  const validatedCount = rooms.filter(r => r.validated).length;
  const total = rooms.length;

  return (
    <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          📊 Résumé
        </h4>
        <Badge variant="outline" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {reportDate.toLocaleDateString('fr-FR')}
        </Badge>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-destructive/10 rounded">
          <div className="text-lg font-bold text-destructive">{aBlancCount}</div>
          <div className="text-xs text-muted-foreground">À Blanc ({total > 0 ? Math.round(aBlancCount/total*100) : 0}%)</div>
        </div>
        <div className="text-center p-2 bg-primary/10 rounded">
          <div className="text-lg font-bold text-primary">{recoucheCount}</div>
          <div className="text-xs text-muted-foreground">Recouche ({total > 0 ? Math.round(recoucheCount/total*100) : 0}%)</div>
        </div>
        <div className="text-center p-2 bg-muted rounded">
          <div className="text-lg font-bold">{noneCount}</div>
          <div className="text-xs text-muted-foreground">Aucun ({total > 0 ? Math.round(noneCount/total*100) : 0}%)</div>
        </div>
      </div>
      
      {validatedCount > 0 && (
        <div className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {validatedCount} chambre(s) validée(s)
        </div>
      )}
    </div>
  );
};

export const PmsRulesManager = ({ hotelId }: PmsRulesManagerProps) => {
  const [rules, setRules] = useState<PmsRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<ExtractedRoom[]>([]);
  const [detectedPms, setDetectedPms] = useState<string>('');
  const [detectedConfidence, setDetectedConfidence] = useState<number>(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showManualCorrection, setShowManualCorrection] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [useLightMode, setUseLightMode] = useState(true); // Par défaut activé
  const [forceAi, setForceAi] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newRule, setNewRule] = useState({
    pms_type: '',
    rule_name: '',
    keywords: '',
    room_number_regex: '\\b([1-9]\\d{2,3}[A-Z]?)\\b',
    priority: 50
  });

  const availableAdapters = pmsAdapterFactory.getAvailablePmsTypes();

  useEffect(() => {
    loadRules();
  }, [hotelId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pms_rules')
        .select('*')
        .or(`hotel_id.eq.${hotelId},hotel_id.is.null`)
        .order('priority', { ascending: false });

      if (!error && data) {
        setRules(data as PmsRule[]);
      }
    } catch (error) {
      console.error('Erreur chargement règles PMS:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestParsing = async () => {
    if (!testText.trim()) {
      toast.error('Entrez du texte à analyser');
      return;
    }

    setIsTestLoading(true);
    setDebugLogs([]);
    
    try {
      // Détecter le PMS
      const detection = unifiedParserService.detectPmsType(testText);
      setDetectedPms(detection.pmsType);
      setDetectedConfidence(detection.confidence);

      if (useLightMode) {
        // Mode extraction légère - utilise LocalRoomParser v2
        const dateObj = new Date(reportDate);
        const result = localRoomParser.parseReport(testText, dateObj);
        
        // Convertir ParsedRoom en ExtractedRoom avec données étendues
        const rooms = result.rooms.map(room => ({
          roomNumber: room.roomNumber,
          status: room.status,
          cleaningType: room.cleaningType as CleaningType,
          confidence: room.confidence,
          originalText: room.originalLine,
          validated: false,
          reason: room.reason,
          nightInfo: room.nightInfo,
          departureDate: room.departureDate,
          debugInfo: {
            rawLine: room.originalLine,
            cleanedLine: room.originalLine.trim(),
            detectedKeywords: [],
            source: 'regex' as const,
            confidence: room.confidence
          }
        })) as ExtractedRoom[];
        
        setTestResults(rooms);
        setDebugLogs([
          `[Mode léger] Date du rapport: ${dateObj.toLocaleDateString('fr-FR')}`,
          `[Mode léger] ${rooms.length} chambres extraites`,
          `[Mode léger] PMS détecté: ${result.detectedPms}`,
          ...localRoomParser.getDebugLogs()
        ]);
        toast.success(`${rooms.length} chambre(s) détectée(s) (mode léger)`);
      } else {
        // Parser avec le service unifié (mode strict)
        const result = await unifiedParserService.parseReport(testText, hotelId, forceAi);
        setTestResults(result.rooms);
        setDebugLogs(result.debugLogs || []);
        
        const aiInfo = result.usedAi ? ' (avec IA)' : '';
        toast.success(`${result.rooms.length} chambre(s) détectée(s) - PMS: ${result.pmsType}${aiInfo}`);
      }
    } catch (error: any) {
      console.error('Erreur parsing:', error);
      setDebugLogs(prev => [...prev, `❌ Erreur: ${error.message || error}`]);
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setIsTestLoading(false);
    }
  };

  // Sauvegarder les patterns validés
  const handleSavePatterns = async () => {
    const validatedRooms = testResults.filter(r => r.validated);
    
    if (validatedRooms.length === 0) {
      toast.error('Aucune chambre validée à sauvegarder');
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Utilisateur non connecté');
        return;
      }

      // Sauvegarder dans hotel_detection_rules comme patterns appris
      for (const room of validatedRooms) {
        await supabase.from('hotel_detection_rules').upsert({
          hotel_id: hotelId,
          created_by: user.user.id,
          rule_name: `Pattern chambre ${room.roomNumber}`,
          rule_type: 'learned_pattern',
          condition: { room_number: room.roomNumber },
          result: { 
            cleaning_type: room.cleaningType, 
            status: room.status 
          },
          is_active: true,
          priority: 100
        }, { onConflict: 'hotel_id,rule_name' });
      }

      toast.success(`${validatedRooms.length} pattern(s) sauvegardé(s)`);
    } catch (error) {
      console.error('Erreur sauvegarde patterns:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleAddRule = async () => {
    if (!newRule.rule_name.trim() || !newRule.pms_type) {
      toast.error('Nom et type PMS requis');
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Utilisateur non connecté');
        return;
      }

      const keywords = newRule.keywords.split(',').map(k => k.trim()).filter(k => k);

      const { error } = await supabase
        .from('pms_rules')
        .insert({
          hotel_id: hotelId,
          pms_type: newRule.pms_type,
          rule_name: newRule.rule_name,
          keywords,
          room_number_regex: newRule.room_number_regex,
          priority: newRule.priority,
          is_active: true,
          is_default: false,
          source: 'manual',
          created_by: user.user.id
        });

      if (error) throw error;

      toast.success('Règle PMS ajoutée');
      setIsAddDialogOpen(false);
      setNewRule({
        pms_type: '',
        rule_name: '',
        keywords: '',
        room_number_regex: '\\b([1-9]\\d{2,3}[A-Z]?)\\b',
        priority: 50
      });
      loadRules();
    } catch (error) {
      console.error('Erreur ajout règle:', error);
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('pms_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;
      loadRules();
    } catch (error) {
      console.error('Erreur toggle:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error('Impossible de supprimer une règle par défaut');
      return;
    }

    try {
      const { error } = await supabase
        .from('pms_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      toast.success('Règle supprimée');
      loadRules();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getCleaningLabel = (cleaning: CleaningType) => {
    switch (cleaning) {
      case 'full': return 'À blanc';
      case 'quick': return 'Recouche';
      case 'none': return 'Aucun';
      default: return cleaning;
    }
  };

  const hotelRules = rules.filter(r => r.hotel_id === hotelId);
  const defaultRules = rules.filter(r => r.hotel_id === null || r.is_default);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="simple" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Règles
          </TabsTrigger>
          <TabsTrigger value="test">
            <Play className="h-3 w-3 mr-1" />
            Tester
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Settings className="h-3 w-3 mr-1" />
            Avancé
          </TabsTrigger>
        </TabsList>

        {/* Interface simplifiée */}
        <TabsContent value="simple" className="space-y-4">
          <SimplifiedRulesManager hotelId={hotelId} />
        </TabsContent>

        {/* Onglet Test */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Tester le parsing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Texte à analyser (collez un extrait de rapport PMS)</Label>
                <Textarea
                  value={testText}
                  onChange={e => setTestText(e.target.value)}
                  placeholder="Collez ici un extrait de votre rapport PMS..."
                  rows={6}
                />
              </div>

              {/* Options de parsing */}
              <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg items-center">
                <div className="flex items-center gap-2">
                  <Switch
                    id="light-mode"
                    checked={useLightMode}
                    onCheckedChange={setUseLightMode}
                  />
                  <Label htmlFor="light-mode" className="text-sm flex items-center gap-1 cursor-pointer">
                    <FileText className="h-3 w-3" />
                    Mode léger
                  </Label>
                </div>
                
                {useLightMode && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="report-date" className="text-sm flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Date rapport:
                    </Label>
                    <Input
                      id="report-date"
                      type="date"
                      value={reportDate}
                      onChange={e => setReportDate(e.target.value)}
                      className="h-8 w-36"
                    />
                  </div>
                )}
                
                {!useLightMode && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="force-ai"
                      checked={forceAi}
                      onCheckedChange={setForceAi}
                    />
                    <Label htmlFor="force-ai" className="text-sm flex items-center gap-1 cursor-pointer">
                      <Wand2 className="h-3 w-3" />
                      Forcer IA
                    </Label>
                  </div>
                )}
              </div>

              <Button onClick={handleTestParsing} className="w-full" disabled={isTestLoading}>
                <Play className="h-4 w-4 mr-2" />
                {isTestLoading ? 'Analyse en cours...' : 'Analyser'}
              </Button>

              {detectedPms && (
                <div className="flex flex-wrap items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">PMS détecté:</span>
                    <Badge>{detectedPms.toUpperCase()}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Confiance:</span>
                    <Badge variant={detectedConfidence > 70 ? "default" : "secondary"}>
                      {detectedConfidence.toFixed(0)}%
                    </Badge>
                  </div>
                  {useLightMode && (
                    <Badge variant="outline" className="text-xs">Mode léger</Badge>
                  )}
                </div>
              )}

              {/* Résumé des résultats */}
              {testResults.length > 0 && (
                <TestResultSummary 
                  rooms={testResults} 
                  reportDate={new Date(reportDate)} 
                />
              )}

              {/* Debug logs */}
              {debugLogs.length > 0 && (
                <Collapsible open={showDebugLogs} onOpenChange={setShowDebugLogs}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="text-xs text-muted-foreground">
                        Logs de debug ({debugLogs.length})
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showDebugLogs ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 bg-muted/30 rounded-lg max-h-48 overflow-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {debugLogs.join('\n')}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {testResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Résultats ({testResults.length} chambres)</h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = testResults.map(r => ({ ...r, validated: true }));
                          setTestResults(updated);
                          toast.success('Toutes les chambres validées');
                        }}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Tout valider
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSavePatterns}
                        disabled={testResults.filter(r => r.validated).length === 0}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Sauvegarder ({testResults.filter(r => r.validated).length})
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[350px] overflow-auto space-y-2">
                    {testResults.map((room, idx) => (
                      <TestResultItem 
                        key={idx} 
                        room={room}
                        index={idx}
                        onValidate={(i) => {
                          const updated = [...testResults];
                          updated[i] = { ...updated[i], validated: true };
                          setTestResults(updated);
                        }}
                        onRemove={(i) => {
                          setTestResults(prev => prev.filter((_, index) => index !== i));
                        }}
                        onModify={(i, updates) => {
                          const updated = [...testResults];
                          updated[i] = { ...updated[i], ...updates, validated: true };
                          setTestResults(updated);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {testResults.length === 0 && detectedPms && !isTestLoading && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Aucune chambre détectée. Essayez le "Mode léger" ou "Forcer IA".
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet avancé - Simplifié avec suggestions */}
        <TabsContent value="advanced" className="space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <p className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Gérez les PMS supportés et ajoutez des mots-clés personnalisés
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* PMS Supportés - Affichage simplifié */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                PMS reconnus automatiquement
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableAdapters.map(pmsType => (
                  <Badge key={pmsType} variant="secondary" className="text-sm py-1 px-3">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                    {pmsType.charAt(0).toUpperCase() + pmsType.slice(1)}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Ces systèmes sont détectés automatiquement lors de l'import de rapports
              </p>
            </div>

            {/* Suggestions de règles - Plus simple */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Ajouter des mots-clés</h3>
              <p className="text-sm text-muted-foreground">
                Ajoutez des mots-clés spécifiques à votre hôtel pour améliorer la détection
              </p>
              
              <Card className="border-dashed">
                <CardContent className="py-4">
                  <div className="grid gap-4">
                    <div>
                      <Label>Mots-clés pour départs</Label>
                      <Input
                        value={newRule.keywords}
                        onChange={e => setNewRule({ ...newRule, keywords: e.target.value, pms_type: 'custom', rule_name: 'Mots-clés personnalisés' })}
                        placeholder="Ex: PARTI, DEP, LIBRE, VD..."
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Séparez les mots par des virgules
                      </p>
                    </div>
                    <Button 
                      onClick={handleAddRule} 
                      disabled={!newRule.keywords.trim()}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Sauvegarder les mots-clés
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Règles existantes - Simplifié */}
            {hotelRules.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Vos mots-clés personnalisés</h4>
                <div className="space-y-2">
                  {hotelRules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        {rule.keywords.map((kw, i) => (
                          <Badge key={i} variant="outline">{kw}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={v => handleToggleRule(rule.id, v)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id, rule.is_default)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
