import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Check, X, Minus, Copy, Sparkles, FileText, ChevronDown, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { 
  CleaningType, 
  CLEANING_TYPE_LABELS, 
  getCleaningTypeColors,
  normalizeCleaningType 
} from '@/constants/cleaningTypes';

type ConditionValue = 'present' | 'absent' | 'any';

interface CombinationRule {
  id: string;
  rule_name: string;
  description?: string;
  priority: number;
  is_active: boolean;
  status_keywords: string[];
  arrival_date: ConditionValue;
  departure_date: ConditionValue;
  arrival_time: ConditionValue;
  departure_time: ConditionValue;
  night_info: ConditionValue;
  result_cleaning_type: CleaningType;
  result_status?: string;
  pms_template?: string;
}

interface CleaningCombinationMapperProps {
  hotelId: string;
}

const PMS_TEMPLATES: Record<string, CombinationRule[]> = {
  mews: [
    {
      id: 'mews-1',
      rule_name: 'Séjour sans horaires',
      description: 'SAL/DIR avec dates mais sans horaire = Recouche',
      priority: 100,
      is_active: true,
      status_keywords: ['SAL', 'DIR', 'DIRTY', 'OCC'],
      arrival_date: 'present',
      departure_date: 'present',
      arrival_time: 'absent',
      departure_time: 'absent',
      night_info: 'any',
      result_cleaning_type: 'quick',
      result_status: 'stayover',
      pms_template: 'mews'
    },
    {
      id: 'mews-2',
      rule_name: 'Départ avec horaire',
      description: 'SAL/DIR avec horaire de départ = À blanc',
      priority: 90,
      is_active: true,
      status_keywords: ['SAL', 'DIR', 'DIRTY'],
      arrival_date: 'any',
      departure_date: 'present',
      arrival_time: 'any',
      departure_time: 'present',
      night_info: 'any',
      result_cleaning_type: 'full',
      result_status: 'checkout',
      pms_template: 'mews'
    },
    {
      id: 'mews-3',
      rule_name: 'Départ explicite',
      description: 'DEP/PARTI = Toujours à blanc',
      priority: 110,
      is_active: true,
      status_keywords: ['DEP', 'PARTI', 'CHECKOUT', 'C/O'],
      arrival_date: 'any',
      departure_date: 'any',
      arrival_time: 'any',
      departure_time: 'any',
      night_info: 'any',
      result_cleaning_type: 'full',
      result_status: 'checkout',
      pms_template: 'mews'
    }
  ],
  apaleo: [
    {
      id: 'apaleo-1',
      rule_name: 'Occupé sans départ',
      description: 'OCC/DIR sans horaire de départ = Recouche',
      priority: 100,
      is_active: true,
      status_keywords: ['OCC', 'DIR', 'OCCUPIED'],
      arrival_date: 'any',
      departure_date: 'any',
      arrival_time: 'any',
      departure_time: 'absent',
      night_info: 'any',
      result_cleaning_type: 'quick',
      result_status: 'stayover',
      pms_template: 'apaleo'
    },
    {
      id: 'apaleo-2',
      rule_name: 'Arrivée',
      description: 'ARR = À blanc',
      priority: 90,
      is_active: true,
      status_keywords: ['ARR', 'ARRIVAL', 'C/I'],
      arrival_date: 'any',
      departure_date: 'any',
      arrival_time: 'any',
      departure_time: 'any',
      night_info: 'any',
      result_cleaning_type: 'full',
      result_status: 'arrival',
      pms_template: 'apaleo'
    }
  ],
  medialog: [
    {
      id: 'medialog-1',
      rule_name: 'Client présent',
      description: 'Nuit en cours = Recouche',
      priority: 100,
      is_active: true,
      status_keywords: [],
      arrival_date: 'present',
      departure_date: 'present',
      arrival_time: 'any',
      departure_time: 'absent',
      night_info: 'present',
      result_cleaning_type: 'quick',
      result_status: 'stayover',
      pms_template: 'medialog'
    },
    {
      id: 'medialog-2',
      rule_name: 'Dernière nuit',
      description: 'Dernière nuit du séjour = À blanc',
      priority: 110,
      is_active: true,
      status_keywords: ['DEPART', 'DEP'],
      arrival_date: 'any',
      departure_date: 'present',
      arrival_time: 'any',
      departure_time: 'any',
      night_info: 'any',
      result_cleaning_type: 'full',
      result_status: 'checkout',
      pms_template: 'medialog'
    }
  ]
};

const ConditionIcon = ({ value }: { value: ConditionValue }) => {
  switch (value) {
    case 'present':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'absent':
      return <X className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
};

const ConditionBadge = ({ value, onChange }: { value: ConditionValue; onChange: (v: ConditionValue) => void }) => {
  const cycle = () => {
    const next: ConditionValue = value === 'any' ? 'present' : value === 'present' ? 'absent' : 'any';
    onChange(next);
  };

  return (
    <button
      onClick={cycle}
      className="flex items-center justify-center w-8 h-8 rounded border hover:bg-accent transition-colors"
      title={value === 'present' ? 'Présent' : value === 'absent' ? 'Absent' : 'Peu importe'}
    >
      <ConditionIcon value={value} />
    </button>
  );
};

export const CleaningCombinationMapper = ({ hotelId }: CleaningCombinationMapperProps) => {
  const [rules, setRules] = useState<CombinationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CombinationRule | null>(null);
  
  // Training report lines state
  const [trainingLines, setTrainingLines] = useState<string[]>([]);
  const [linesOpen, setLinesOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [loadingLines, setLoadingLines] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_combination_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('priority', { ascending: false });

      if (error) throw error;
      setRules((data || []) as CombinationRule[]);
    } catch (error) {
      console.error('Erreur chargement règles:', error);
      toast.error('Erreur lors du chargement des règles');
    } finally {
      setLoading(false);
    }
  };

  const loadTrainingLines = async () => {
    setLoadingLines(true);
    try {
      const { data, error } = await supabase
        .from('report_training_patterns')
        .select('raw_text')
        .eq('hotel_id', hotelId)
        .eq('validated', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.raw_text) {
        const lines = data.raw_text.split('\n').filter((l: string) => l.trim());
        setTrainingLines(lines);
      }
    } catch (error) {
      console.error('Erreur chargement lignes:', error);
    } finally {
      setLoadingLines(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [hotelId]);
  
  useEffect(() => {
    if (linesOpen && trainingLines.length === 0) {
      loadTrainingLines();
    }
  }, [linesOpen]);

  const saveRule = async (rule: Partial<CombinationRule>) => {
    try {
      const payload = {
        hotel_id: hotelId,
        rule_name: rule.rule_name,
        description: rule.description,
        priority: rule.priority || 50,
        is_active: rule.is_active ?? true,
        status_keywords: rule.status_keywords || [],
        arrival_date: rule.arrival_date || 'any',
        departure_date: rule.departure_date || 'any',
        arrival_time: rule.arrival_time || 'any',
        departure_time: rule.departure_time || 'any',
        night_info: rule.night_info || 'any',
        result_cleaning_type: rule.result_cleaning_type || 'a_blanc',
        result_status: rule.result_status,
        pms_template: rule.pms_template
      };

      if (rule.id && !rule.id.startsWith('mews-') && !rule.id.startsWith('apaleo-') && !rule.id.startsWith('medialog-')) {
        const { error } = await supabase
          .from('hotel_combination_rules')
          .update(payload)
          .eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('hotel_combination_rules')
          .insert(payload);
        if (error) throw error;
      }

      toast.success('Règle enregistrée');
      loadRules();
      setDialogOpen(false);
      setEditingRule(null);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('hotel_combination_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Règle supprimée');
      loadRules();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('hotel_combination_rules')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
      loadRules();
    } catch (error) {
      console.error('Erreur toggle:', error);
    }
  };

  const importTemplate = async (templateKey: string) => {
    const template = PMS_TEMPLATES[templateKey];
    if (!template) return;

    try {
      for (const rule of template) {
        await saveRule(rule);
      }
      toast.success(`Template ${templateKey.toUpperCase()} importé`);
    } catch (error) {
      toast.error('Erreur lors de l\'import');
    }
  };

  const RuleDialog = () => {
    const [form, setForm] = useState<Partial<CombinationRule>>(
      editingRule || {
        rule_name: '',
        description: '',
        priority: 50,
        is_active: true,
        status_keywords: [],
        arrival_date: 'any',
        departure_date: 'any',
        arrival_time: 'any',
        departure_time: 'any',
        night_info: 'any',
        result_cleaning_type: 'full'
      }
    );

    return (
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingRule ? 'Modifier la règle' : 'Nouvelle règle'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom de la règle</Label>
            <Input
              value={form.rule_name || ''}
              onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
              placeholder="Ex: Séjour sans horaires"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Client en séjour = Recouche"
            />
          </div>
          <div>
            <Label>Mots-clés de statut (séparés par des virgules)</Label>
            <Input
              value={(form.status_keywords || []).join(', ')}
              onChange={(e) => setForm({ ...form, status_keywords: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) })}
              placeholder="SAL, DIR, OCC"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priorité</Label>
              <Input
                type="number"
                value={form.priority || 50}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 50 })}
              />
            </div>
            <div>
              <Label>Résultat nettoyage</Label>
              <Select
                value={form.result_cleaning_type}
                onValueChange={(v) => setForm({ ...form, result_cleaning_type: v as CleaningType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{CLEANING_TYPE_LABELS.full.fr}</SelectItem>
                  <SelectItem value="quick">{CLEANING_TYPE_LABELS.quick.fr}</SelectItem>
                  <SelectItem value="none">{CLEANING_TYPE_LABELS.none.fr}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-medium">Conditions (cliquez pour changer)</Label>
            <div className="grid grid-cols-5 gap-2 text-xs text-center">
              <div>Date Arr.</div>
              <div>Date Dép.</div>
              <div>H. Arr.</div>
              <div>H. Dép.</div>
              <div>Nuit</div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <ConditionBadge
                value={form.arrival_date || 'any'}
                onChange={(v) => setForm({ ...form, arrival_date: v })}
              />
              <ConditionBadge
                value={form.departure_date || 'any'}
                onChange={(v) => setForm({ ...form, departure_date: v })}
              />
              <ConditionBadge
                value={form.arrival_time || 'any'}
                onChange={(v) => setForm({ ...form, arrival_time: v })}
              />
              <ConditionBadge
                value={form.departure_time || 'any'}
                onChange={(v) => setForm({ ...form, departure_time: v })}
              />
              <ConditionBadge
                value={form.night_info || 'any'}
                onChange={(v) => setForm({ ...form, night_info: v })}
              />
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-4">
              <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Présent</span>
              <span className="flex items-center gap-1"><X className="h-3 w-3 text-red-500" /> Absent</span>
              <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> Peu importe</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingRule(null); }}>
              Annuler
            </Button>
            <Button onClick={() => saveRule({ ...form, id: editingRule?.id })}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Mapping par combinaison</CardTitle>
            <CardDescription className="text-xs">
              Définissez le type de nettoyage selon la combinaison de critères
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingRule(null)}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </DialogTrigger>
            <RuleDialog />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Templates PMS */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Importer un template :</span>
          {Object.keys(PMS_TEMPLATES).map((key) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => importTemplate(key)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {key.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* Tableau des règles */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">Aucune règle configurée</p>
            <p className="text-xs">Importez un template ou créez vos propres règles</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Priorité</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-center font-medium" title="Date Arrivée">Arr.</th>
                    <th className="px-3 py-2 text-center font-medium" title="Date Départ">Dép.</th>
                    <th className="px-3 py-2 text-center font-medium" title="Horaire Arrivée">H.A</th>
                    <th className="px-3 py-2 text-center font-medium" title="Horaire Départ">H.D</th>
                    <th className="px-3 py-2 text-center font-medium">Nuit</th>
                    <th className="px-3 py-2 text-left font-medium">→ Nettoyage</th>
                    <th className="px-3 py-2 text-center font-medium">Actif</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rules.map((rule) => (
                    <tr key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {rule.priority}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(rule.status_keywords || []).length > 0 ? (
                            rule.status_keywords.slice(0, 3).map((kw) => (
                              <Badge key={kw} variant="secondary" className="text-xs">
                                {kw}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                          {(rule.status_keywords || []).length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{rule.status_keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center"><ConditionIcon value={rule.arrival_date} /></td>
                      <td className="px-3 py-2 text-center"><ConditionIcon value={rule.departure_date} /></td>
                      <td className="px-3 py-2 text-center"><ConditionIcon value={rule.arrival_time} /></td>
                      <td className="px-3 py-2 text-center"><ConditionIcon value={rule.departure_time} /></td>
                      <td className="px-3 py-2 text-center"><ConditionIcon value={rule.night_info} /></td>
                      <td className="px-3 py-2">
                        {(() => {
                          const normalizedType = normalizeCleaningType(rule.result_cleaning_type);
                          const colors = getCleaningTypeColors(normalizedType);
                          return (
                            <Badge className={`${colors.bg} text-white`}>
                              {CLEANING_TYPE_LABELS[normalizedType].fr}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => toggleActive(rule.id, checked)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingRule(rule); setDialogOpen(true); }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Training Report Lines Panel */}
        <Collapsible open={linesOpen} onOpenChange={setLinesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Lignes du rapport d'entraînement
                {trainingLines.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{trainingLines.length}</Badge>
                )}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${linesOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                {loadingLines ? (
                  <div className="text-center py-4 text-muted-foreground">Chargement...</div>
                ) : trainingLines.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground flex flex-col items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <p>Aucun rapport d'entraînement trouvé</p>
                    <p className="text-xs">Entraînez d'abord l'IA avec un rapport PDF</p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher dans les lignes..."
                        className="pl-9"
                        value={lineSearch}
                        onChange={(e) => setLineSearch(e.target.value)}
                      />
                    </div>
                    <ScrollArea className="h-64 border rounded-md">
                      <div className="p-2 space-y-1">
                        {trainingLines
                          .filter(line => !lineSearch || line.toLowerCase().includes(lineSearch.toLowerCase()))
                          .map((line, i) => {
                            // Detect if line has a valid room number (3 digits at start, not a year)
                            // Room numbers: 101, 211, etc. NOT: 2025, dates, etc.
                            const roomMatch = line.match(/^\s*(\d{2,4})\s+(?:TWN|DBL|SGL|SUI|TRP|FAM|STU)/i) ||
                                              line.match(/^(\d{2,4})\s+[A-Z]{2,4}\s+(?:SAL|DIR|PRO|INS|OCC|DEP)/i);
                            const hasRoom = !!roomMatch;
                            const roomNumber = roomMatch ? roomMatch[1] : null;
                            const isSelected = selectedLine === line;
                            
                            return (
                              <button
                                key={i}
                                onClick={() => setSelectedLine(isSelected ? null : line)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono hover:bg-accent transition-colors ${
                                  isSelected ? 'bg-primary/10 border border-primary/30' : ''
                                } ${hasRoom ? 'text-foreground' : 'text-muted-foreground'}`}
                              >
                                {hasRoom && roomNumber && (
                                  <Badge variant="outline" className="mr-2 text-[10px] py-0 px-1">{roomNumber}</Badge>
                                )}
                                <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                {line.length > 90 ? line.substring(0, 90) + '...' : line}
                              </button>
                            );
                          })}
                      </div>
                    </ScrollArea>
                    <div className="text-xs text-muted-foreground">
                      {trainingLines.filter(l => 
                        /^\s*\d{2,4}\s+(?:TWN|DBL|SGL|SUI|TRP|FAM|STU)/i.test(l) ||
                        /^\d{2,4}\s+[A-Z]{2,4}\s+(?:SAL|DIR|PRO|INS|OCC|DEP)/i.test(l)
                      ).length} lignes avec chambres détectées sur {trainingLines.length} total
                    </div>
                    {selectedLine && (
                      <div className="p-3 bg-muted rounded-md space-y-2">
                        <p className="text-xs font-medium">Ligne sélectionnée:</p>
                        <p className="text-xs font-mono break-all">{selectedLine}</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={() => {
                            // Pre-fill rule based on selected line
                            const dateMatches = selectedLine.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g) || [];
                            const timeMatches = selectedLine.match(/\d{1,2}:\d{2}/g) || [];
                            const hasNightPattern = /(?:nuit|night)\s*\d+\s*[\/\\]\s*\d+/i.test(selectedLine);
                            const upper = selectedLine.toUpperCase();
                            
                            const keywords: string[] = [];
                            if (/\bSAL\b/.test(upper)) keywords.push('SAL');
                            if (/\bDIR\b/.test(upper)) keywords.push('DIR');
                            if (/\bDEP\b/.test(upper)) keywords.push('DEP');
                            if (/\bOCC\b/.test(upper)) keywords.push('OCC');
                            if (/\bPRO\b/.test(upper)) keywords.push('PRO');
                            if (/\bINS\b/.test(upper)) keywords.push('INS');
                            
                            // Determine cleaning type based on context
                            const hasTwoTimes = timeMatches.length >= 2;
                            const hasOneTime = timeMatches.length === 1;
                            const hasNight = hasNightPattern;
                            
                            // If has departure time (2 times) → full, else quick
                            const suggestedCleaningType: CleaningType = hasTwoTimes ? 'full' : 'quick';
                            
                            setEditingRule({
                              id: '',
                              rule_name: `Règle ${keywords.join('+')}`,
                              description: selectedLine.substring(0, 50),
                              priority: 50,
                              is_active: true,
                              status_keywords: keywords,
                              arrival_date: dateMatches.length >= 1 ? 'present' : 'any',
                              departure_date: dateMatches.length >= 2 ? 'present' : 'any',
                              arrival_time: hasTwoTimes ? 'present' : (hasOneTime ? 'any' : 'absent'),
                              departure_time: hasTwoTimes ? 'present' : 'absent',
                              night_info: hasNight ? 'present' : 'any',
                              result_cleaning_type: suggestedCleaningType,
                            });
                            setDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Créer une règle depuis cette ligne
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Légende */}
        <div className="text-xs text-muted-foreground flex items-center justify-center gap-6 pt-2">
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Présent obligatoire</span>
          <span className="flex items-center gap-1"><X className="h-3 w-3 text-red-500" /> Absent obligatoire</span>
          <span className="flex items-center gap-1"><Minus className="h-3 w-3" /> Peu importe</span>
        </div>
      </CardContent>
    </Card>
  );
};
