/**
 * Éditeur visuel des règles de nettoyage
 * Interface simplifiée pour gérer les règles sans regex visible
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Sparkles, 
  TestTube,
  ChevronDown,
  ChevronUp,
  Settings2,
  Lightbulb,
  Shield
} from 'lucide-react';
import {
  CleaningRule,
  CleaningRuleCondition,
  NormalizedCleaningType,
  CLEANING_TYPE_LABELS,
  DEFAULT_SYSTEM_RULES,
} from '@/services/pms/types';
import { RuleConditionBuilder } from './RuleConditionBuilder';
import { RulePreview } from './RulePreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { validateRule } from '@/services/cleaningRulesEngine';

interface CleaningRulesEditorProps {
  hotelId: string;
  onRulesChange?: (rules: CleaningRule[]) => void;
}

export function CleaningRulesEditor({ hotelId, onRulesChange }: CleaningRulesEditorProps) {
  const [rules, setRules] = useState<CleaningRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<CleaningRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showSystemRules, setShowSystemRules] = useState(false);
  const [previewRule, setPreviewRule] = useState<CleaningRule | null>(null);

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

      // Convertir les données de la DB vers notre format
      const loadedRules: CleaningRule[] = (data || []).map(dbRule => ({
        id: dbRule.id,
        hotelId: dbRule.hotel_id,
        name: dbRule.rule_name,
        description: dbRule.description || undefined,
        conditions: Array.isArray(dbRule.conditions) 
          ? (dbRule.conditions as unknown as CleaningRuleCondition[]) 
          : [],
        conditionLogic: 'AND' as const,
        resultCleaningType: dbRule.result_cleaning_type as NormalizedCleaningType,
        resultStatus: dbRule.result_status || undefined,
        priority: dbRule.priority,
        isActive: dbRule.is_active,
        isSystem: false,
        createdAt: dbRule.created_at,
        updatedAt: dbRule.updated_at,
      }));

      // Ajouter les règles système par défaut si aucune règle n'existe
      if (loadedRules.length === 0) {
        const systemRules = DEFAULT_SYSTEM_RULES.map((r, i) => ({
          ...r,
          id: `system-${i}`,
          hotelId,
        })) as CleaningRule[];
        setRules(systemRules as CleaningRule[]);
      } else {
        setRules(loadedRules);
      }

      onRulesChange?.(loadedRules);
    } catch (error) {
      console.error('Erreur chargement règles:', error);
      toast.error('Erreur lors du chargement des règles');
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule: CleaningRule) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Utilisateur non connecté');
        return;
      }

      const validation = validateRule(rule);
      if (!validation.isValid) {
        toast.error(validation.errors.join(', '));
        return;
      }

      const dbRule = {
        hotel_id: hotelId,
        rule_name: rule.name,
        description: rule.description || null,
        conditions: JSON.parse(JSON.stringify(rule.conditions)),
        result_cleaning_type: rule.resultCleaningType,
        result_status: rule.resultStatus || null,
        priority: rule.priority,
        is_active: rule.isActive,
        created_by: user.user.id,
      };

      if (isAddingNew || rule.id.startsWith('system-')) {
        // Créer une nouvelle règle
        const { error } = await supabase
          .from('hotel_cleaning_rules')
          .insert([dbRule as any]);

        if (error) throw error;
        toast.success('Règle créée avec succès');
      } else {
        // Mettre à jour une règle existante
        const { error } = await supabase
          .from('hotel_cleaning_rules')
          .update(dbRule as any)
          .eq('id', rule.id);

        if (error) throw error;
        toast.success('Règle mise à jour');
      }

      setIsDialogOpen(false);
      setEditingRule(null);
      setIsAddingNew(false);
      loadRules();
    } catch (error) {
      console.error('Erreur sauvegarde règle:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (ruleId.startsWith('system-')) {
      toast.error('Impossible de supprimer une règle système');
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
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    if (ruleId.startsWith('system-')) {
      // Pour les règles système, mettre à jour localement
      setRules(prev => prev.map(r => 
        r.id === ruleId ? { ...r, isActive } : r
      ));
      return;
    }

    try {
      const { error } = await supabase
        .from('hotel_cleaning_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;
      loadRules();
    } catch (error) {
      console.error('Erreur toggle:', error);
    }
  };

  const startNewRule = () => {
    setEditingRule({
      id: '',
      hotelId,
      name: '',
      conditions: [],
      conditionLogic: 'AND' as const,
      resultCleaningType: 'a_blanc' as NormalizedCleaningType,
      priority: 50,
      isActive: true,
      isSystem: false,
    });
    setIsAddingNew(true);
    setIsDialogOpen(true);
  };

  const editRule = (rule: CleaningRule) => {
    setEditingRule({ ...rule });
    setIsAddingNew(false);
    setIsDialogOpen(true);
  };

  const customRules = rules.filter(r => !r.isSystem && !r.id.startsWith('system-'));
  const systemRules = rules.filter(r => r.isSystem || r.id.startsWith('system-'));

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Règles de nettoyage</h2>
            <p className="text-sm text-muted-foreground">
              Configurez comment le type de nettoyage est déterminé automatiquement
            </p>
          </div>
        </div>
        <Button onClick={startNewRule} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle règle
        </Button>
      </div>

      {/* Info box */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Comment ça fonctionne ?</p>
              <p className="text-muted-foreground mt-1">
                Les règles sont appliquées par ordre de priorité (la plus haute en premier). 
                Dès qu'une règle correspond, le type de nettoyage est déterminé et les règles suivantes sont ignorées.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Règles personnalisées */}
      <div className="space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Vos règles personnalisées
        </h3>
        
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Chargement...
            </CardContent>
          </Card>
        ) : customRules.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                Aucune règle personnalisée. Les règles système seront utilisées.
              </p>
              <Button variant="outline" onClick={startNewRule}>
                <Plus className="h-4 w-4 mr-2" />
                Créer ma première règle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {customRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => editRule(rule)}
                onDelete={() => deleteRule(rule.id)}
                onToggle={(active) => toggleRule(rule.id, active)}
                onPreview={() => setPreviewRule(rule)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Règles système */}
      <Collapsible open={showSystemRules} onOpenChange={setShowSystemRules}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Règles système ({systemRules.length})
            </span>
            {showSystemRules ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          {systemRules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => editRule(rule)}
              onToggle={(active) => toggleRule(rule.id, active)}
              onPreview={() => setPreviewRule(rule)}
              isSystem
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Dialog d'édition */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isAddingNew ? 'Nouvelle règle' : 'Modifier la règle'}
            </DialogTitle>
            <DialogDescription>
              Définissez les conditions et le résultat de cette règle de nettoyage.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="space-y-6">
              {/* Nom et description */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Nom de la règle</Label>
                  <Input
                    id="rule-name"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    placeholder="ex: VIP → Nettoyage complet"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-desc">Description (optionnel)</Label>
                  <Textarea
                    id="rule-desc"
                    value={editingRule.description || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                    placeholder="Expliquez quand cette règle s'applique..."
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Conditions */}
              <div className="space-y-4">
                <Label>Si...</Label>
                <RuleConditionBuilder
                  conditions={editingRule.conditions}
                  logic={editingRule.conditionLogic}
                  onChange={(conditions, logic) => 
                    setEditingRule({ ...editingRule, conditions, conditionLogic: logic })
                  }
                />
              </div>

              <Separator />

              {/* Résultat */}
              <div className="space-y-4">
                <Label>Alors...</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type de nettoyage</Label>
                    <Select
                      value={editingRule.resultCleaningType}
                      onValueChange={(v: NormalizedCleaningType) => 
                        setEditingRule({ ...editingRule, resultCleaningType: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a_blanc">À Blanc (complet)</SelectItem>
                        <SelectItem value="recouche">Recouche (léger)</SelectItem>
                        <SelectItem value="none">Aucun nettoyage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <Select
                      value={String(editingRule.priority)}
                      onValueChange={(v) => 
                        setEditingRule({ ...editingRule, priority: parseInt(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">Très haute (100)</SelectItem>
                        <SelectItem value="80">Haute (80)</SelectItem>
                        <SelectItem value="50">Normale (50)</SelectItem>
                        <SelectItem value="30">Basse (30)</SelectItem>
                        <SelectItem value="10">Très basse (10)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => editingRule && saveRule(editingRule)}>
              {isAddingNew ? 'Créer' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de preview */}
      {previewRule && (
        <RulePreview
          rule={previewRule}
          hotelId={hotelId}
          onClose={() => setPreviewRule(null)}
        />
      )}
    </div>
  );
}

// Composant pour afficher une règle
function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  onPreview,
  isSystem = false,
}: {
  rule: CleaningRule;
  onEdit: () => void;
  onDelete?: () => void;
  onToggle: (active: boolean) => void;
  onPreview: () => void;
  isSystem?: boolean;
}) {
  const getCleaningBadgeVariant = (type: string) => {
    switch (type) {
      case 'a_blanc': return 'default';
      case 'recouche': return 'secondary';
      case 'none': return 'outline';
      default: return 'default';
    }
  };

  return (
    <Card className={`${!rule.isActive ? 'opacity-50' : ''} ${isSystem ? 'bg-muted/30' : ''}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="cursor-grab text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
          
          <Switch
            checked={rule.isActive}
            onCheckedChange={onToggle}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{rule.name}</span>
              {isSystem && (
                <Badge variant="outline" className="text-xs">Système</Badge>
              )}
              <Badge variant="secondary" className="text-xs">P{rule.priority}</Badge>
            </div>
            {rule.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {rule.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">→</span>
              <Badge variant={getCleaningBadgeVariant(rule.resultCleaningType)}>
                {CLEANING_TYPE_LABELS[rule.resultCleaningType]}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onPreview}>
              <TestTube className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Modifier
            </Button>
            {onDelete && !isSystem && (
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
