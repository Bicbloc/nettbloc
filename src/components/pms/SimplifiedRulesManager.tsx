/**
 * Gestionnaire simplifié des règles de nettoyage
 * Interface intuitive sans jargon technique
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Play,
  ChevronRight,
  Home,
  UserCheck,
  CalendarCheck,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  Edit2,
  Copy,
  Wand2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SimpleRule {
  id: string;
  name: string;
  description?: string;
  // Situation client
  clientStatus: 'checkout' | 'stayover' | 'checkin' | 'any' | 'custom';
  // État chambre
  roomState: 'dirty' | 'clean' | 'any';
  cleaningType: 'a_blanc' | 'recouche' | 'none';
  priority: number;
  isActive: boolean;
  customKeywords?: string;
  // Synonymes multi-langues pour l'état chambre
  roomStateSynonyms?: string;
}

interface SimplifiedRulesManagerProps {
  hotelId: string;
}

// Templates prédéfinis faciles à comprendre
const RULE_TEMPLATES: Omit<SimpleRule, 'id'>[] = [
  {
    name: 'Départ + Sale → À Blanc',
    description: 'Client parti, chambre sale = nettoyage complet',
    clientStatus: 'checkout',
    roomState: 'dirty',
    cleaningType: 'a_blanc',
    priority: 100,
    isActive: true,
  },
  {
    name: 'Départ → À Blanc',
    description: 'Nettoyage complet après un départ client',
    clientStatus: 'checkout',
    roomState: 'any',
    cleaningType: 'a_blanc',
    priority: 90,
    isActive: true,
  },
  {
    name: 'Client en séjour → Recouche',
    description: 'Nettoyage léger pour les clients qui restent',
    clientStatus: 'stayover',
    roomState: 'any',
    cleaningType: 'recouche',
    priority: 70,
    isActive: true,
  },
  {
    name: 'Arrivée prévue → À Blanc',
    description: 'Préparer la chambre pour une nouvelle arrivée',
    clientStatus: 'checkin',
    roomState: 'any',
    cleaningType: 'a_blanc',
    priority: 85,
    isActive: true,
  },
  {
    name: 'Chambre propre → Aucun',
    description: 'Pas de nettoyage si déjà propre',
    clientStatus: 'any',
    roomState: 'clean',
    cleaningType: 'none',
    priority: 60,
    isActive: true,
  },
];

// Labels pour situation client
const CLIENT_STATUS_OPTIONS = [
  { value: 'checkout', label: 'Départ client', icon: <Home className="h-4 w-4" />, keywords: ['DEPART', 'CHECKOUT', 'C/O', 'C-O', 'CO', 'PARTI', 'DEP', 'DUE OUT'] },
  { value: 'stayover', label: 'Client en séjour', icon: <CalendarCheck className="h-4 w-4" />, keywords: ['RECOUCHE', 'STAYOVER', 'STAY', 'OD', 'OCCUPIED'] },
  { value: 'checkin', label: 'Arrivée prévue', icon: <UserCheck className="h-4 w-4" />, keywords: ['ARRIVEE', 'ARRIVAL', 'CHECK-IN', 'C/I', 'C-I', 'CI', 'ARR', 'DUE IN'] },
  { value: 'any', label: 'Peu importe', icon: <Zap className="h-4 w-4" />, keywords: [] },
  { value: 'custom', label: 'Personnalisé', icon: <Wand2 className="h-4 w-4" />, keywords: [] },
];

// Labels pour état chambre avec synonymes multi-langues
const ROOM_STATE_OPTIONS = [
  { value: 'dirty', label: 'Sale', description: 'SAL, SALE, VD, DIRTY, SUCIO, SPORCO', color: 'bg-orange-100 text-orange-800 border-orange-200', defaultSynonyms: 'SUCIO, SPORCO, SCHMUTZIG' },
  { value: 'clean', label: 'Propre', description: 'INS, PROPRE, CLEAN, LIMPIO', color: 'bg-green-100 text-green-800 border-green-200', defaultSynonyms: 'LIMPIO, PULITO, SAUBER' },
  { value: 'any', label: 'Peu importe', description: 'Quel que soit l\'état', color: 'bg-gray-100 text-gray-800 border-gray-200', defaultSynonyms: '' },
];

const CLEANING_OPTIONS = [
  { value: 'a_blanc', label: 'À Blanc', description: 'Nettoyage complet', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'recouche', label: 'Recouche', description: 'Nettoyage léger', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'none', label: 'Aucun', description: 'Pas de nettoyage', color: 'bg-gray-100 text-gray-800 border-gray-200' },
];

export function SimplifiedRulesManager({ hotelId }: SimplifiedRulesManagerProps) {
  const [rules, setRules] = useState<SimpleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SimpleRule | null>(null);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<{room: string; type: string}[]>([]);
  const [showTest, setShowTest] = useState(false);

  useEffect(() => {
    loadRules();
  }, [hotelId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_cleaning_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('priority', { ascending: false });

      if (error) throw error;

      // Convertir les règles DB vers notre format simplifié
      const loadedRules: SimpleRule[] = (data || []).map(dbRule => {
        let clientStatus: SimpleRule['clientStatus'] = 'any';
        let roomState: SimpleRule['roomState'] = 'any';
        let customKeywords: string | undefined;
        let roomStateSynonyms: string | undefined;

        const conditions = (dbRule.conditions as any[]) || [];
        const synonyms: string[] = [];
        
        for (const cond of conditions) {
          if (cond?.type === 'status') {
            const value = String(cond.value || '').toLowerCase();
            if (value === 'checkout' || value === 'departure') clientStatus = 'checkout';
            else if (value === 'arrival' || value === 'checkin') clientStatus = 'checkin';
            else if (value === 'stayover') clientStatus = 'stayover';
            else if (value === 'dirty') roomState = 'dirty';
            else if (value === 'clean') roomState = 'clean';
          }
          if (cond?.type === 'keyword') {
            if (cond.isSynonym) {
              // C'est un synonyme pour l'état chambre
              synonyms.push(String(cond.value || '').trim());
            } else {
              // C'est un mot-clé personnalisé pour la situation client
              clientStatus = 'custom';
              const kw = conditions
                .filter(c => c?.type === 'keyword' && !c.isSynonym)
                .map(c => String(c.value || '').trim())
                .filter(Boolean)
                .join(', ');
              customKeywords = kw;
            }
          }
        }
        
        if (synonyms.length > 0) {
          roomStateSynonyms = synonyms.join(', ');
        }

        return {
          id: dbRule.id,
          name: dbRule.rule_name,
          description: dbRule.description || undefined,
          clientStatus,
          roomState,
          cleaningType: dbRule.result_cleaning_type as any,
          priority: dbRule.priority,
          isActive: dbRule.is_active,
          customKeywords,
          roomStateSynonyms,
        };
      });

      // Si aucune règle, proposer les templates par défaut
      if (loadedRules.length === 0) {
        setRules(RULE_TEMPLATES.map((t, i) => ({ ...t, id: `template-${i}` })));
      } else {
        setRules(loadedRules);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule: SimpleRule) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Non connecté');
        return;
      }

      // Construire les conditions basées sur clientStatus + roomState
      const conditions: any[] = [];

      // Condition 1: Situation client
      if (rule.clientStatus === 'custom') {
        const keywords = (rule.customKeywords || '')
          .split(',')
          .map(k => k.trim())
          .filter(Boolean);
        for (const kw of keywords) {
          conditions.push({ type: 'keyword', operator: 'contains', value: kw });
        }
      } else if (rule.clientStatus !== 'any') {
        const statusMap: Record<string, string> = {
          checkout: 'checkout',
          stayover: 'stayover',
          checkin: 'arrival',
        };
        conditions.push({ type: 'status', operator: 'equals', value: statusMap[rule.clientStatus] || rule.clientStatus });
      }

      // Condition 2: État chambre + synonymes
      if (rule.roomState !== 'any') {
        conditions.push({ type: 'status', operator: 'equals', value: rule.roomState });
        
        // Ajouter les synonymes comme conditions keyword
        if (rule.roomStateSynonyms) {
          const synonyms = rule.roomStateSynonyms
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          for (const syn of synonyms) {
            conditions.push({ type: 'keyword', operator: 'contains', value: syn, isSynonym: true });
          }
        }
      }

      const dbRule = {
        hotel_id: hotelId,
        rule_name: rule.name,
        description: rule.description || null,
        condition_logic: 'AND',
        conditions: JSON.parse(JSON.stringify(conditions)),
        result_cleaning_type: rule.cleaningType,
        result_status: rule.clientStatus !== 'any' && rule.clientStatus !== 'custom' ? rule.clientStatus : null,
        priority: rule.priority,
        is_active: rule.isActive,
        created_by: user.user.id,
      };

      if (rule.id.startsWith('template-') || !rule.id) {
        const { error } = await supabase
          .from('hotel_cleaning_rules')
          .insert([dbRule as any]);
        if (error) throw error;
        toast.success('Règle créée');
      } else {
        const { error } = await supabase
          .from('hotel_cleaning_rules')
          .update(dbRule as any)
          .eq('id', rule.id);
        if (error) throw error;
        toast.success('Règle mise à jour');
      }

      setIsDialogOpen(false);
      setEditingRule(null);
      loadRules();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de sauvegarde');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (ruleId.startsWith('template-')) {
      setRules(prev => prev.filter(r => r.id !== ruleId));
      return;
    }

    try {
      const { error } = await supabase
        .from('hotel_cleaning_rules')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
      toast.success('Règle supprimée');
      loadRules();
    } catch (error) {
      toast.error('Erreur de suppression');
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    if (ruleId.startsWith('template-')) {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive } : r));
      return;
    }

    try {
      await supabase
        .from('hotel_cleaning_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);
      loadRules();
    } catch (error) {
      console.error('Erreur toggle:', error);
    }
  };

  const handleTest = () => {
    if (!testText.trim()) return;

    const textUpper = testText.toUpperCase();
    const roomMatches = testText.match(/\b([1-9]\d{2,3}[A-Z]?)\b/g) || [];
    const results = roomMatches.slice(0, 10).map(room => {
      const activeRules = rules.filter(r => r.isActive).sort((a, b) => b.priority - a.priority);

      for (const rule of activeRules) {
        // Vérifier clientStatus
        let clientMatch = rule.clientStatus === 'any';
        if (rule.clientStatus === 'checkout') {
          clientMatch = /\bDEPART|CHECKOUT|C\/O|CO\b/.test(textUpper);
        } else if (rule.clientStatus === 'stayover') {
          clientMatch = /\bRECOUCHE|STAYOVER|STAY\b/.test(textUpper);
        } else if (rule.clientStatus === 'checkin') {
          clientMatch = /\bARRIVEE|ARRIVAL|C\/I|CI\b/.test(textUpper);
        } else if (rule.clientStatus === 'custom' && rule.customKeywords) {
          const kws = rule.customKeywords.split(',').map(k => k.trim().toUpperCase());
          clientMatch = kws.some(k => textUpper.includes(k));
        }

        // Vérifier roomState + synonymes
        let roomMatch = rule.roomState === 'any';
        if (rule.roomState === 'dirty') {
          roomMatch = /\bSAL(?:E)?\b|\bDIRTY\b|\bVD\b/.test(textUpper);
          // Vérifier aussi les synonymes
          if (!roomMatch && rule.roomStateSynonyms) {
            const syns = rule.roomStateSynonyms.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            roomMatch = syns.some(syn => textUpper.includes(syn));
          }
        } else if (rule.roomState === 'clean') {
          roomMatch = /\bPROPRE\b|\bCLEAN\b|\bINS\b/.test(textUpper);
          // Vérifier aussi les synonymes
          if (!roomMatch && rule.roomStateSynonyms) {
            const syns = rule.roomStateSynonyms.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            roomMatch = syns.some(syn => textUpper.includes(syn));
          }
        }

        if (clientMatch && roomMatch) {
          return { room, type: rule.cleaningType };
        }
      }
      return { room, type: 'a_blanc' };
    });

    setTestResults(results);
    toast.success(`${results.length} chambre(s) analysée(s)`);
  };

  const startNewRule = () => {
    setEditingRule({
      id: '',
      name: '',
      clientStatus: 'checkout',
      roomState: 'any',
      cleaningType: 'a_blanc',
      priority: 50,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const duplicateRule = (rule: SimpleRule) => {
    setEditingRule({
      ...rule,
      id: '',
      name: `${rule.name} (copie)`,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Règles de nettoyage
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Définissez automatiquement le type de nettoyage selon la situation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTest(!showTest)}>
            <Play className="h-4 w-4 mr-2" />
            Tester
          </Button>
          <Button onClick={startNewRule}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle règle
          </Button>
        </div>
      </div>

      {/* Zone de test */}
      {showTest && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tester les règles</CardTitle>
            <CardDescription>Collez un extrait de votre rapport PMS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Ex: 101 DEPART&#10;102 RECOUCHE&#10;103 ARRIVEE"
              rows={3}
            />
            <div className="flex justify-between items-center">
              <Button onClick={handleTest} size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Analyser
              </Button>
              {testResults.length > 0 && (
                <div className="flex gap-2">
                  {testResults.map((r, i) => (
                    <Badge key={i} variant="outline" className={
                      r.type === 'a_blanc' ? 'bg-purple-50 text-purple-700' :
                      r.type === 'recouche' ? 'bg-blue-50 text-blue-700' : ''
                    }>
                      {r.room} → {r.type === 'a_blanc' ? 'À Blanc' : r.type === 'recouche' ? 'Recouche' : 'Aucun'}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des règles */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => { setEditingRule(rule); setIsDialogOpen(true); }}
              onDelete={() => deleteRule(rule.id)}
              onToggle={(active) => toggleRule(rule.id, active)}
              onDuplicate={() => duplicateRule(rule)}
            />
          ))}

          {rules.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">
                  Aucune règle configurée
                </p>
                <Button onClick={startNewRule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une règle
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dialog d'édition */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule?.id ? 'Modifier la règle' : 'Nouvelle règle'}
            </DialogTitle>
            <DialogDescription>
              Définissez quand et comment nettoyer
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="space-y-6 py-4">
              {/* Nom */}
              <div className="space-y-2">
                <Label>Nom de la règle</Label>
                <Input
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="Ex: Départ → À Blanc"
                />
              </div>

              {/* Situation client */}
              <div className="space-y-3">
                <Label>1. Situation client</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CLIENT_STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditingRule({ ...editingRule, clientStatus: opt.value as any })}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                        editingRule.clientStatus === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-md",
                        editingRule.clientStatus === opt.value ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {opt.icon}
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {editingRule.clientStatus === 'custom' && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Mots-clés (séparés par virgule)</Label>
                    <Input
                      value={editingRule.customKeywords || ''}
                      onChange={(e) => setEditingRule({ ...editingRule, customKeywords: e.target.value })}
                      placeholder="Ex: C/O, CO, VIP, SUITE"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* État chambre */}
              <div className="space-y-3">
                <Label>2. État de la chambre</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROOM_STATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditingRule({ 
                        ...editingRule, 
                        roomState: opt.value as any,
                        roomStateSynonyms: opt.defaultSynonyms || editingRule.roomStateSynonyms
                      })}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all text-center",
                        editingRule.roomState === opt.value
                          ? `border-primary ${opt.color}`
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="text-sm font-medium block">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </button>
                  ))}
                </div>

                {/* Synonymes multi-langues */}
                {editingRule.roomState !== 'any' && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">
                      Synonymes / termes équivalents (multi-langues, séparés par virgule)
                    </Label>
                    <Input
                      value={editingRule.roomStateSynonyms || ''}
                      onChange={(e) => setEditingRule({ ...editingRule, roomStateSynonyms: e.target.value })}
                      placeholder="Ex: SUCIO, SPORCO, SCHMUTZIG, DIRTY"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ajoutez des termes dans d'autres langues (ES, IT, DE, EN) pour détecter ce statut.
                    </p>
                  </div>
                )}
              </div>

              {/* Flèche */}
              <div className="flex justify-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Type de nettoyage */}
              <div className="space-y-3">
                <Label>3. Type de nettoyage</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CLEANING_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEditingRule({ ...editingRule, cleaningType: option.value as any })}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all text-center",
                        editingRule.cleaningType === option.value
                          ? `border-primary ${option.color}`
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="text-sm font-medium block">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priorité simplifiée */}
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select
                  value={String(editingRule.priority)}
                  onValueChange={(v) => setEditingRule({ ...editingRule, priority: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">🔴 Très haute - S'applique en premier</SelectItem>
                    <SelectItem value="80">🟠 Haute</SelectItem>
                    <SelectItem value="50">🟡 Normale</SelectItem>
                    <SelectItem value="30">🟢 Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => editingRule && saveRule(editingRule)}
              disabled={!editingRule?.name}
            >
              {editingRule?.id && !editingRule.id.startsWith('template-') ? 'Sauvegarder' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Composant carte de règle
function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
}: {
  rule: SimpleRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
  onDuplicate: () => void;
}) {
  const clientInfo = CLIENT_STATUS_OPTIONS.find(o => o.value === rule.clientStatus);
  const roomInfo = ROOM_STATE_OPTIONS.find(o => o.value === rule.roomState);
  const cleaningInfo = CLEANING_OPTIONS.find(o => o.value === rule.cleaningType);

  return (
    <Card className={cn(
      "transition-all",
      !rule.isActive && "opacity-60"
    )}>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Icône */}
          <div className="p-2.5 rounded-lg bg-muted shrink-0">
            {clientInfo?.icon || <Zap className="h-4 w-4" />}
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{rule.name}</span>
              {rule.priority >= 80 && (
                <Badge variant="secondary" className="text-xs">Priorité haute</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
              <span>{clientInfo?.label || 'Tout'}</span>
              {rule.roomState !== 'any' && (
                <>
                  <span>+</span>
                  <Badge variant="outline" className={roomInfo?.color}>{roomInfo?.label}</Badge>
                </>
              )}
              <ChevronRight className="h-3 w-3" />
              <Badge variant="outline" className={cleaningInfo?.color}>
                {cleaningInfo?.label}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={onDuplicate} title="Dupliquer">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit} title="Modifier">
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Supprimer">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            <Switch
              checked={rule.isActive}
              onCheckedChange={onToggle}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
