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
import { toast } from "sonner";
import { Plus, Trash2, Play, Settings, Cpu, CheckCircle, XCircle, Zap } from "lucide-react";
import { pmsAdapterFactory, unifiedParserService, ExtractedRoom, CleaningType } from "@/services/pms";

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

export const PmsRulesManager = ({ hotelId }: PmsRulesManagerProps) => {
  const [rules, setRules] = useState<PmsRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<ExtractedRoom[]>([]);
  const [detectedPms, setDetectedPms] = useState<string>('');
  const [detectedConfidence, setDetectedConfidence] = useState<number>(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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

    try {
      // Détecter le PMS
      const detection = unifiedParserService.detectPmsType(testText);
      setDetectedPms(detection.pmsType);
      setDetectedConfidence(detection.confidence);

      // Parser avec le service unifié
      const result = await unifiedParserService.parseReport(testText, hotelId);
      setTestResults(result.rooms);

      toast.success(`${result.rooms.length} chambre(s) détectée(s) - PMS: ${result.pmsType}`);
    } catch (error) {
      console.error('Erreur parsing:', error);
      toast.error('Erreur lors de l\'analyse');
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
      <Tabs defaultValue="adapters" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="adapters">Adaptateurs PMS</TabsTrigger>
          <TabsTrigger value="custom">Mes Règles</TabsTrigger>
          <TabsTrigger value="defaults">Règles Défaut</TabsTrigger>
          <TabsTrigger value="test">Tester</TabsTrigger>
        </TabsList>

        <TabsContent value="adapters" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Adaptateurs PMS Disponibles</h3>
              <p className="text-sm text-muted-foreground">
                Formats de rapports PMS reconnus automatiquement
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {availableAdapters.map(pmsType => (
              <Card key={pmsType} className="relative overflow-hidden">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Cpu className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold uppercase">{pmsType}</h4>
                      <p className="text-xs text-muted-foreground">Adaptateur intégré</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-3">
                    <Zap className="h-3 w-3 mr-1" />
                    Parsing local
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Règles Personnalisées</h3>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Règle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter une Règle PMS</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Type de PMS</Label>
                    <Select value={newRule.pms_type} onValueChange={v => setNewRule({ ...newRule, pms_type: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAdapters.map(type => (
                          <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
                        ))}
                        <SelectItem value="custom">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Nom de la règle</Label>
                    <Input
                      value={newRule.rule_name}
                      onChange={e => setNewRule({ ...newRule, rule_name: e.target.value })}
                      placeholder="Ex: Règle spécifique hôtel"
                    />
                  </div>

                  <div>
                    <Label>Mots-clés de détection (séparés par virgule)</Label>
                    <Input
                      value={newRule.keywords}
                      onChange={e => setNewRule({ ...newRule, keywords: e.target.value })}
                      placeholder="Ex: SAL, RECOUCHE, DEPART"
                    />
                  </div>

                  <div>
                    <Label>Regex numéro de chambre</Label>
                    <Input
                      value={newRule.room_number_regex}
                      onChange={e => setNewRule({ ...newRule, room_number_regex: e.target.value })}
                      placeholder="\\b([1-9]\\d{2,3}[A-Z]?)\\b"
                    />
                  </div>

                  <div>
                    <Label>Priorité (1-100)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={newRule.priority}
                      onChange={e => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 50 })}
                    />
                  </div>

                  <Button onClick={handleAddRule} className="w-full">
                    Ajouter
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : hotelRules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune règle personnalisée</p>
                <p className="text-sm text-muted-foreground">Les adaptateurs par défaut seront utilisés</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {hotelRules.map(rule => (
                <Card key={rule.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rule.rule_name}</span>
                          <Badge variant="outline">{rule.pms_type}</Badge>
                          <Badge variant="secondary">P{rule.priority}</Badge>
                        </div>
                        {rule.keywords && rule.keywords.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Mots-clés: {rule.keywords.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="defaults" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              Règles intégrées aux adaptateurs PMS
            </span>
          </div>

          <div className="space-y-3">
            {defaultRules.map(rule => (
              <Card key={rule.id} className="bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.rule_name}</span>
                        <Badge variant="outline">{rule.pms_type}</Badge>
                        <Badge variant="secondary">Défaut</Badge>
                      </div>
                      {rule.status_mappings && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(rule.status_mappings).slice(0, 5).map(([key, val]: [string, any]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key} → {getCleaningLabel(val.cleaning)}
                            </Badge>
                          ))}
                          {Object.keys(rule.status_mappings).length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{Object.keys(rule.status_mappings).length - 5} autres
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary">Intégré</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}

            {defaultRules.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Les règles par défaut sont intégrées aux adaptateurs PMS
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Tester le Parsing
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

              <Button onClick={handleTestParsing} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Analyser
              </Button>

              {detectedPms && (
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
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
                </div>
              )}

              {testResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Résultats ({testResults.length} chambres)</h4>
                  <div className="max-h-[300px] overflow-auto space-y-2">
                    {testResults.map((room, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold">{room.roomNumber}</span>
                            <Badge variant={
                              room.cleaningType === 'full' ? 'destructive' :
                              room.cleaningType === 'quick' ? 'default' : 'secondary'
                            }>
                              {getCleaningLabel(room.cleaningType)}
                            </Badge>
                            {room.status && (
                              <span className="text-sm text-muted-foreground">{room.status}</span>
                            )}
                          </div>
                          {room.validated ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
