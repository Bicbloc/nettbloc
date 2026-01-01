import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings2, Plus, Trash2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Room } from "@/services/pdfService";

export interface CleaningRule {
  id: string;
  name: string;
  condition: {
    field: 'status' | 'roomNumber' | 'floor';
    operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan';
    value: string;
    synonyms?: string[]; // Termes synonymes pour les différentes langues
  };
  result: {
    cleaningType: Room['cleaningType'];
    priority?: 'high' | 'medium' | 'low';
  };
  isActive: boolean;
  priority: number;
}

interface CleaningRulesManagerProps {
  rules: CleaningRule[];
  onRulesChange: (rules: CleaningRule[]) => void;
  onApplyRules?: (rooms: Room[]) => Room[];
}

const defaultRules: CleaningRule[] = [
  {
    id: 'default-departure',
    name: 'Départ → À Blanc',
    condition: { field: 'status', operator: 'equals', value: 'DEPARTURE' },
    result: { cleaningType: 'a_blanc', priority: 'high' },
    isActive: true,
    priority: 1,
  },
  {
    id: 'default-stay',
    name: 'Occupée → Recouche',
    condition: { field: 'status', operator: 'equals', value: 'STAY' },
    result: { cleaningType: 'recouche', priority: 'medium' },
    isActive: true,
    priority: 2,
  },
  {
    id: 'default-arrival',
    name: 'Arrivée → À Blanc',
    condition: { field: 'status', operator: 'equals', value: 'ARRIVAL' },
    result: { cleaningType: 'a_blanc', priority: 'high' },
    isActive: true,
    priority: 3,
  },
  {
    id: 'default-dirty',
    name: 'Sale → À Blanc',
    condition: { field: 'status', operator: 'equals', value: 'DIRTY' },
    result: { cleaningType: 'a_blanc', priority: 'medium' },
    isActive: true,
    priority: 4,
  },
];

const STORAGE_KEY = 'cleaning_rules';

export function CleaningRulesManager({ rules: externalRules, onRulesChange }: CleaningRulesManagerProps) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<CleaningRule[]>([]);
  const [editingRule, setEditingRule] = useState<CleaningRule | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Load rules from localStorage or use defaults
  useEffect(() => {
    const savedRules = localStorage.getItem(STORAGE_KEY);
    if (savedRules) {
      try {
        setRules(JSON.parse(savedRules));
      } catch {
        setRules(defaultRules);
      }
    } else if (externalRules.length > 0) {
      setRules(externalRules);
    } else {
      setRules(defaultRules);
    }
  }, [externalRules]);

  const saveRules = (newRules: CleaningRule[]) => {
    setRules(newRules);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRules));
    onRulesChange(newRules);
  };

  const toggleRule = (ruleId: string) => {
    const newRules = rules.map(r => 
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    );
    saveRules(newRules);
  };

  const deleteRule = (ruleId: string) => {
    const newRules = rules.filter(r => r.id !== ruleId);
    saveRules(newRules);
    toast({
      title: "Règle supprimée",
      description: "La règle a été supprimée avec succès",
    });
  };

  const addOrUpdateRule = () => {
    if (!editingRule) return;

    if (!editingRule.name || !editingRule.condition.value) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive",
      });
      return;
    }

    let newRules: CleaningRule[];
    if (isAddingNew) {
      newRules = [...rules, { ...editingRule, id: `rule-${Date.now()}`, priority: rules.length + 1 }];
    } else {
      newRules = rules.map(r => r.id === editingRule.id ? editingRule : r);
    }
    
    saveRules(newRules);
    setEditingRule(null);
    setIsAddingNew(false);
    
    toast({
      title: isAddingNew ? "Règle créée" : "Règle modifiée",
      description: `La règle "${editingRule.name}" a été ${isAddingNew ? 'créée' : 'modifiée'} avec succès`,
    });
  };

  const startNewRule = () => {
    setEditingRule({
      id: '',
      name: '',
      condition: { field: 'status', operator: 'equals', value: '' },
      result: { cleaningType: 'a_blanc' },
      isActive: true,
      priority: rules.length + 1,
    });
    setIsAddingNew(true);
  };

  const getCleaningTypeLabel = (type: string | undefined) => {
    switch (type) {
      case 'a_blanc':
      case 'full': return 'À Blanc';
      case 'recouche':
      case 'quick': return 'Recouche';
      case 'none': return 'Aucun';
      default: return type || 'À Blanc';
    }
  };

  const isFullCleaning = (type: string | undefined) => {
    return type === 'a_blanc' || type === 'full';
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'status': return 'Statut';
      case 'roomNumber': return 'N° Chambre';
      case 'floor': return 'Étage';
      default: return field;
    }
  };

  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case 'equals': return '=';
      case 'contains': return 'contient';
      case 'startsWith': return 'commence par';
      case 'greaterThan': return '>';
      case 'lessThan': return '<';
      default: return operator;
    }
  };

  const resetToDefaults = () => {
    saveRules(defaultRules);
    toast({
      title: "Règles réinitialisées",
      description: "Les règles par défaut ont été restaurées",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Règles automatiques
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Règles de nettoyage automatiques
          </DialogTitle>
          <DialogDescription>
            Configurez les règles pour déterminer automatiquement le type de nettoyage 
            selon le statut ou les caractéristiques des chambres.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Active rules list */}
          {!editingRule && (
            <>
              <div className="space-y-2">
                {rules.map((rule) => (
                  <Card key={rule.id} className={rule.isActive ? '' : 'opacity-50'}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={() => toggleRule(rule.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{rule.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>{getFieldLabel(rule.condition.field)}</span>
                              <span>{getOperatorLabel(rule.condition.operator)}</span>
                              <Badge variant="outline" className="text-xs">{rule.condition.value}</Badge>
                              {rule.condition.synonyms && rule.condition.synonyms.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  (+{rule.condition.synonyms.length} synonymes)
                                </span>
                              )}
                              <ArrowRight className="h-3 w-3" />
                              <Badge variant={rule.result.cleaningType === 'a_blanc' ? 'default' : 'secondary'}>
                                {getCleaningTypeLabel(rule.result.cleaningType)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRule(rule);
                              setIsAddingNew(false);
                            }}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={startNewRule} variant="outline" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle règle
                </Button>
                <Button onClick={resetToDefaults} variant="ghost" size="sm">
                  Réinitialiser
                </Button>
              </div>
            </>
          )}

          {/* Edit/Add rule form */}
          {editingRule && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isAddingNew ? 'Nouvelle règle' : 'Modifier la règle'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom de la règle</Label>
                  <Input
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    placeholder="ex: VIP → Priorité haute"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Condition</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={editingRule.condition.field}
                      onValueChange={(v: 'status' | 'roomNumber' | 'floor') => 
                        setEditingRule({ 
                          ...editingRule, 
                          condition: { ...editingRule.condition, field: v } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status">Statut</SelectItem>
                        <SelectItem value="roomNumber">N° Chambre</SelectItem>
                        <SelectItem value="floor">Étage</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={editingRule.condition.operator}
                      onValueChange={(v: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan') => 
                        setEditingRule({ 
                          ...editingRule, 
                          condition: { ...editingRule.condition, operator: v } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Égal à</SelectItem>
                        <SelectItem value="contains">Contient</SelectItem>
                        <SelectItem value="startsWith">Commence par</SelectItem>
                        <SelectItem value="greaterThan">Supérieur à</SelectItem>
                        <SelectItem value="lessThan">Inférieur à</SelectItem>
                      </SelectContent>
                    </Select>
                    {editingRule.condition.field === 'status' ? (
                      <Select
                        value={editingRule.condition.value}
                        onValueChange={(v) => 
                          setEditingRule({ 
                            ...editingRule, 
                            condition: { ...editingRule.condition, value: v } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Valeur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DEPARTURE">Départ</SelectItem>
                          <SelectItem value="ARRIVAL">Arrivée</SelectItem>
                          <SelectItem value="STAY">Occupée</SelectItem>
                          <SelectItem value="DIRTY">Sale</SelectItem>
                          <SelectItem value="CLEAN">Propre</SelectItem>
                          <SelectItem value="VACANT">Libre</SelectItem>
                          <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                          <SelectItem value="OOO">Hors service</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={editingRule.condition.value}
                        onChange={(e) => 
                          setEditingRule({ 
                            ...editingRule, 
                            condition: { ...editingRule.condition, value: e.target.value } 
                          })
                        }
                        placeholder="Valeur"
                      />
                    )}
                  </div>

                  {/* Synonymes multilingues - seulement pour le champ "status" */}
                  {editingRule.condition.field === 'status' && (
                    <div className="mt-2 space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        Synonymes / termes alternatifs
                        <span className="text-xs opacity-70">(pour autres langues ou sigles)</span>
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {(editingRule.condition.synonyms || []).map((syn, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1 text-xs">
                            {syn}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              onClick={() => {
                                const newSynonyms = [...(editingRule.condition.synonyms || [])];
                                newSynonyms.splice(idx, 1);
                                setEditingRule({
                                  ...editingRule,
                                  condition: { ...editingRule.condition, synonyms: newSynonyms }
                                });
                              }}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="new-synonym"
                          placeholder="Ex: CHECK-OUT, SALIDA, DÉPART..."
                          className="text-xs h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.currentTarget;
                              const value = input.value.trim().toUpperCase();
                              if (value) {
                                const existingSynonyms = editingRule.condition.synonyms || [];
                                if (!existingSynonyms.includes(value)) {
                                  setEditingRule({
                                    ...editingRule,
                                    condition: { 
                                      ...editingRule.condition, 
                                      synonyms: [...existingSynonyms, value] 
                                    }
                                  });
                                }
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            const input = document.getElementById('new-synonym') as HTMLInputElement;
                            const value = input?.value.trim().toUpperCase();
                            if (value) {
                              const existingSynonyms = editingRule.condition.synonyms || [];
                              if (!existingSynonyms.includes(value)) {
                                setEditingRule({
                                  ...editingRule,
                                  condition: { 
                                    ...editingRule.condition, 
                                    synonyms: [...existingSynonyms, value] 
                                  }
                                });
                              }
                              input.value = '';
                            }
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ajoutez des termes équivalents pour détecter ce statut dans d'autres langues 
                        (ex: DEPARTURE, SALIDA, ABREISE pour "Départ")
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Résultat</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={editingRule.result.cleaningType}
                      onValueChange={(v: 'a_blanc' | 'recouche' | 'none') => 
                        setEditingRule({ 
                          ...editingRule, 
                          result: { ...editingRule.result, cleaningType: v } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a_blanc">À Blanc</SelectItem>
                        <SelectItem value="recouche">Recouche</SelectItem>
                        <SelectItem value="none">Aucun</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={editingRule.result.priority || 'medium'}
                      onValueChange={(v: 'high' | 'medium' | 'low') => 
                        setEditingRule({ 
                          ...editingRule, 
                          result: { ...editingRule.result, priority: v } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Priorité haute</SelectItem>
                        <SelectItem value="medium">Priorité moyenne</SelectItem>
                        <SelectItem value="low">Priorité basse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={addOrUpdateRule} className="flex-1">
                    {isAddingNew ? 'Créer la règle' : 'Sauvegarder'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditingRule(null);
                      setIsAddingNew(false);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Utility function to apply rules to rooms
export function applyCleaningRules(rooms: Room[], rules: CleaningRule[]): Room[] {
  const activeRules = rules
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  return rooms.map(room => {
    for (const rule of activeRules) {
      const { field, operator, value, synonyms } = rule.condition;
      let matches = false;

      const roomValue = field === 'status' 
        ? room.status 
        : field === 'roomNumber' 
          ? room.number 
          : room.floor?.toString() || '';

      // Build all values to check against (main value + synonyms)
      const valuesToMatch = [value.toLowerCase()];
      if (synonyms && synonyms.length > 0) {
        valuesToMatch.push(...synonyms.map(s => s.toLowerCase()));
      }

      switch (operator) {
        case 'equals':
          matches = valuesToMatch.some(v => roomValue.toLowerCase() === v);
          break;
        case 'contains':
          matches = valuesToMatch.some(v => roomValue.toLowerCase().includes(v));
          break;
        case 'startsWith':
          matches = valuesToMatch.some(v => roomValue.toLowerCase().startsWith(v));
          break;
        case 'greaterThan':
          matches = parseInt(roomValue) > parseInt(value);
          break;
        case 'lessThan':
          matches = parseInt(roomValue) < parseInt(value);
          break;
      }

      if (matches) {
        return {
          ...room,
          cleaningType: rule.result.cleaningType,
          priority: rule.result.priority || room.priority,
        };
      }
    }
    return room;
  });
}