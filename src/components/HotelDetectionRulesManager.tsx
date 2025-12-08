import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Play, Settings, Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { mewsDetectionService, DetectionRule } from '@/services/mewsDetectionService';
import { getCleaningTypeLabel } from '@/utils/cleaningTypeUtils';

interface HotelDetectionRulesManagerProps {
  hotelId: string;
  userId: string;
}

export const HotelDetectionRulesManager: React.FC<HotelDetectionRulesManagerProps> = ({
  hotelId,
  userId
}) => {
  const [customRules, setCustomRules] = useState<DetectionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<Array<{
    line: string;
    cleaningType: string;
    confidence: number;
    matchedRule: string | null;
  }>>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_name: '',
    rule_type: 'status_keyword' as DetectionRule['rule_type'],
    pattern: '',
    operator: 'regex_match',
    value: '',
    status: '', // Statut de la chambre (ex: OCC, VAC, DEP)
    cleaning_type: 'a_blanc',
    priority: 5,
    description: ''
  });

  useEffect(() => {
    loadRules();
  }, [hotelId]);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const rules = await mewsDetectionService.loadCustomRules(hotelId);
      setCustomRules(rules);
    } catch (error) {
      console.error('Erreur chargement règles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRules = () => {
    if (!testText.trim()) {
      toast.error('Veuillez entrer du texte à tester');
      return;
    }

    const lines = testText.split('\n').filter(l => l.trim());
    const results = lines.map(line => {
      const analysis = mewsDetectionService.analyzeLine(line);
      return {
        line: line.substring(0, 80) + (line.length > 80 ? '...' : ''),
        cleaningType: getCleaningTypeLabel(analysis.cleaningType),
        confidence: analysis.confidence,
        matchedRule: analysis.matchedRule
      };
    });

    setTestResults(results);
    toast.success(`${results.length} ligne(s) analysée(s)`);
  };

  const handleAddRule = async () => {
    if (!newRule.rule_name.trim()) {
      toast.error('Nom de la règle requis');
      return;
    }

    const condition: DetectionRule['condition'] = {};
    if (newRule.pattern) condition.pattern = newRule.pattern;
    if (newRule.operator) condition.operator = newRule.operator as any;
    if (newRule.value) {
      condition.value = isNaN(Number(newRule.value)) ? newRule.value : Number(newRule.value);
    }
    if (newRule.status) {
      condition.statusPattern = `\\b${newRule.status}\\b`;
    }
    if (newRule.rule_type === 'night_info') {
      condition.field = 'nightInfo.current';
    }

    const result = await mewsDetectionService.saveRule(hotelId, {
      rule_name: newRule.rule_name,
      rule_type: newRule.rule_type,
      condition,
      result: { cleaning_type: newRule.cleaning_type as any },
      priority: newRule.priority,
      is_active: true,
      description: newRule.description
    });

    if (result.error) {
      toast.error(`Erreur: ${result.error}`);
      return;
    }

    if (result.rule) {
      toast.success('Règle ajoutée avec succès');
      setIsAddDialogOpen(false);
      setNewRule({
        rule_name: '',
        rule_type: 'status_keyword',
        pattern: '',
        operator: 'regex_match',
        value: '',
        status: '',
        cleaning_type: 'a_blanc',
        priority: 5,
        description: ''
      });
      loadRules();
    } else {
      toast.error('Erreur lors de l\'ajout de la règle');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (await mewsDetectionService.deleteRule(ruleId)) {
      toast.success('Règle supprimée');
      loadRules();
    } else {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    if (await mewsDetectionService.toggleRule(ruleId, isActive)) {
      loadRules();
    }
  };

  const defaultRules = mewsDetectionService.getDefaultRules();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="custom" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="custom">Mes Règles</TabsTrigger>
          <TabsTrigger value="default">Règles par Défaut</TabsTrigger>
          <TabsTrigger value="test">Tester</TabsTrigger>
        </TabsList>

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
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Ajouter une Règle</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nom de la règle</Label>
                    <Input
                      value={newRule.rule_name}
                      onChange={e => setNewRule({ ...newRule, rule_name: e.target.value })}
                      placeholder="Ex: Statut OCC = Recouche"
                    />
                  </div>
                  
                  <div>
                    <Label>Type de règle</Label>
                    <Select
                      value={newRule.rule_type}
                      onValueChange={v => setNewRule({ ...newRule, rule_type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status_keyword">Mot-clé de statut</SelectItem>
                        <SelectItem value="night_info">Info Nuit (Nuit X/Y)</SelectItem>
                        <SelectItem value="reservation_block">Bloc de réservation</SelectItem>
                        <SelectItem value="time_pattern">Pattern d'heure</SelectItem>
                        <SelectItem value="date_pattern">Pattern de date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newRule.rule_type === 'status_keyword' && (
                    <div>
                      <Label>Pattern Regex</Label>
                      <Input
                        value={newRule.pattern}
                        onChange={e => setNewRule({ ...newRule, pattern: e.target.value })}
                        placeholder="Ex: \bOCC\b"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Utilisez \b pour les limites de mot
                      </p>
                    </div>
                  )}

                  {newRule.rule_type === 'night_info' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Opérateur</Label>
                        <Select
                          value={newRule.operator}
                          onValueChange={v => setNewRule({ ...newRule, operator: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Égal à</SelectItem>
                            <SelectItem value="greater_than">Supérieur à</SelectItem>
                            <SelectItem value="less_than">Inférieur à</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Valeur</Label>
                        <Input
                          type="number"
                          value={newRule.value}
                          onChange={e => setNewRule({ ...newRule, value: e.target.value })}
                          placeholder="Ex: 1"
                        />
                      </div>
                    </div>
                  )}

                  {newRule.rule_type === 'reservation_block' && (
                    <div>
                      <Label>Condition de bloc</Label>
                      <Select
                        value={newRule.value}
                        onValueChange={v => setNewRule({ ...newRule, value: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="departure_and_arrival">Départ + Arrivée</SelectItem>
                          <SelectItem value="departure_only">Départ seul</SelectItem>
                          <SelectItem value="arrival_only">Arrivée seule</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>Statut de la chambre (optionnel)</Label>
                    <Select
                      value={newRule.status || 'none'}
                      onValueChange={v => setNewRule({ ...newRule, status: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun statut spécifique" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun (ignorer le statut)</SelectItem>
                        <SelectItem value="OCC">OCC - Occupée</SelectItem>
                        <SelectItem value="VAC">VAC - Vacante</SelectItem>
                        <SelectItem value="DEP">DEP - Départ</SelectItem>
                        <SelectItem value="ARR">ARR - Arrivée</SelectItem>
                        <SelectItem value="INS">INS - Inspectée</SelectItem>
                        <SelectItem value="OUT">OUT - Départ confirmé</SelectItem>
                        <SelectItem value="DND">DND - Ne pas déranger</SelectItem>
                        <SelectItem value="OOO">OOO - Hors service</SelectItem>
                        <SelectItem value="OOS">OOS - Hors stock</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      La règle s'applique uniquement si ce statut est détecté
                    </p>
                  </div>

                  <div>
                    <Label>Type de nettoyage résultant</Label>
                    <Select
                      value={newRule.cleaning_type}
                      onValueChange={v => setNewRule({ ...newRule, cleaning_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a_blanc">À Blanc (départ)</SelectItem>
                        <SelectItem value="recouche">Recouche (client reste)</SelectItem>
                        <SelectItem value="none">Aucun nettoyage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Priorité (1-10)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={newRule.priority}
                      onChange={e => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 5 })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Plus élevé = vérifié en premier
                    </p>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newRule.description}
                      onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                      placeholder="Explication de cette règle..."
                      rows={2}
                    />
                  </div>

                  <Button onClick={handleAddRule} className="w-full">
                    Ajouter la Règle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : customRules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune règle personnalisée</p>
                <p className="text-sm text-muted-foreground">
                  Les règles par défaut seront utilisées
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {customRules.map(rule => (
                <Card key={rule.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rule.rule_name}</span>
                          <Badge variant="outline">{rule.rule_type}</Badge>
                          <Badge variant="secondary">P{rule.priority}</Badge>
                        </div>
                        {rule.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {rule.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          → {getCleaningTypeLabel(rule.result.cleaning_type)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={v => handleToggleRule(rule.id, v)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
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

        <TabsContent value="default" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <span className="text-sm text-muted-foreground">
              Ces règles sont appliquées automatiquement (priorité plus basse)
            </span>
          </div>

          <div className="space-y-3">
            {defaultRules.map((rule, index) => (
              <Card key={index} className="bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.rule_name}</span>
                    <Badge variant="outline">{rule.rule_type}</Badge>
                    <Badge variant="secondary">P{rule.priority}</Badge>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {rule.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    → {getCleaningTypeLabel(rule.result.cleaning_type)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tester les Règles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Collez un extrait de votre rapport PMS</Label>
                <Textarea
                  value={testText}
                  onChange={e => setTestText(e.target.value)}
                  placeholder="215   DBL   INS   -   14/05/2025   2 ×   Adultes   Paloma Bueno   , Nuit 2/3   17/05/2025"
                  rows={4}
                />
              </div>
              <Button onClick={handleTestRules}>
                <Play className="h-4 w-4 mr-2" />
                Tester
              </Button>

              {testResults.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="font-medium">Résultats :</h4>
                  {testResults.map((result, index) => (
                    <div key={index} className="p-3 rounded-lg border bg-card">
                      <p className="text-sm font-mono truncate">{result.line}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={result.confidence > 0.7 ? 'default' : 'secondary'}>
                          {result.cleaningType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Confiance: {Math.round(result.confidence * 100)}%
                        </span>
                        {result.matchedRule && (
                          <span className="text-xs text-muted-foreground">
                            | Règle: {result.matchedRule}
                          </span>
                        )}
                        {result.confidence > 0.7 ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
