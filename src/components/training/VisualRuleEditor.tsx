import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Minus, 
  ArrowRight,
  Calendar,
  Clock,
  Moon,
  Tag,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ConditionValue = 'present' | 'absent' | 'any';

interface VisualCondition {
  id: string;
  type: 'arrival_date' | 'departure_date' | 'arrival_time' | 'departure_time' | 'night_info' | 'keyword';
  value: ConditionValue;
  keyword?: string;
}

interface VisualRule {
  id: string;
  name: string;
  conditions: VisualCondition[];
  resultType: 'full' | 'quick' | 'none';
  priority: number;
  isActive: boolean;
}

interface VisualRuleEditorProps {
  rule?: VisualRule;
  onChange: (rule: VisualRule) => void;
  onSave: (rule: VisualRule) => void;
  onCancel: () => void;
}

const CONDITION_TEMPLATES: { type: VisualCondition['type']; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'arrival_date', label: 'Date arrivée', icon: <Calendar className="h-4 w-4" />, description: 'Date d\'arrivée du client' },
  { type: 'departure_date', label: 'Date départ', icon: <Calendar className="h-4 w-4" />, description: 'Date de départ du client' },
  { type: 'arrival_time', label: 'Heure arrivée', icon: <Clock className="h-4 w-4" />, description: 'Heure de check-in' },
  { type: 'departure_time', label: 'Heure départ', icon: <Clock className="h-4 w-4" />, description: 'Heure de check-out' },
  { type: 'night_info', label: 'Info nuit', icon: <Moon className="h-4 w-4" />, description: 'Information Nuit X/Y' },
  { type: 'keyword', label: 'Mot-clé PMS', icon: <Tag className="h-4 w-4" />, description: 'SAL, DIR, INS, DEP, etc.' },
];

const RESULT_OPTIONS = [
  { value: 'full', label: 'À blanc', color: 'bg-orange-500', description: 'Nettoyage complet après départ' },
  { value: 'quick', label: 'Recouche', color: 'bg-blue-500', description: 'Nettoyage rapide, client en place' },
  { value: 'none', label: 'Propre', color: 'bg-green-500', description: 'Pas de nettoyage nécessaire' },
];

const ConditionValueButton = ({ 
  value, 
  onChange 
}: { 
  value: ConditionValue; 
  onChange: (v: ConditionValue) => void 
}) => {
  const cycle = () => {
    const next: ConditionValue = value === 'any' ? 'present' : value === 'present' ? 'absent' : 'any';
    onChange(next);
  };

  const config = {
    present: { icon: <Check className="h-4 w-4" />, label: 'Présent', color: 'bg-green-100 border-green-300 text-green-700' },
    absent: { icon: <X className="h-4 w-4" />, label: 'Absent', color: 'bg-red-100 border-red-300 text-red-700' },
    any: { icon: <Minus className="h-4 w-4" />, label: 'Peu importe', color: 'bg-gray-100 border-gray-300 text-gray-500' },
  };

  const { icon, label, color } = config[value];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={cycle}
            className={`flex items-center gap-1 px-2 py-1 rounded border transition-all ${color}`}
          >
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Cliquez pour changer : Présent → Absent → Peu importe</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const VisualRuleEditor = ({ rule, onChange, onSave, onCancel }: VisualRuleEditorProps) => {
  const [localRule, setLocalRule] = useState<VisualRule>(rule || {
    id: `rule-${Date.now()}`,
    name: '',
    conditions: [],
    resultType: 'full',
    priority: 50,
    isActive: true,
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    onChange(localRule);
  }, [localRule, onChange]);

  const addCondition = (type: VisualCondition['type']) => {
    const newCondition: VisualCondition = {
      id: `cond-${Date.now()}`,
      type,
      value: 'present',
    };
    setLocalRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition],
    }));
  };

  const addKeywordCondition = () => {
    if (!newKeyword.trim()) return;
    const newCondition: VisualCondition = {
      id: `cond-${Date.now()}`,
      type: 'keyword',
      value: 'present',
      keyword: newKeyword.toUpperCase().trim(),
    };
    setLocalRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition],
    }));
    setNewKeyword('');
  };

  const updateCondition = (id: string, updates: Partial<VisualCondition>) => {
    setLocalRule(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => 
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  };

  const removeCondition = (id: string) => {
    setLocalRule(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id),
    }));
  };

  // Générer la description de la règle
  const ruleDescription = useMemo(() => {
    if (localRule.conditions.length === 0) {
      return 'Ajouter des conditions pour définir quand cette règle s\'applique';
    }

    const parts: string[] = [];
    
    for (const cond of localRule.conditions) {
      const template = CONDITION_TEMPLATES.find(t => t.type === cond.type);
      if (!template) continue;

      if (cond.type === 'keyword') {
        if (cond.value === 'present') {
          parts.push(`contient "${cond.keyword}"`);
        } else if (cond.value === 'absent') {
          parts.push(`ne contient pas "${cond.keyword}"`);
        }
      } else {
        if (cond.value === 'present') {
          parts.push(`${template.label} présent`);
        } else if (cond.value === 'absent') {
          parts.push(`${template.label} absent`);
        }
      }
    }

    const result = RESULT_OPTIONS.find(r => r.value === localRule.resultType);
    
    return parts.length > 0 
      ? `Si ${parts.join(' ET ')} → ${result?.label}`
      : 'Configuration incomplète';
  }, [localRule]);

  const getConditionLabel = (type: VisualCondition['type']) => {
    return CONDITION_TEMPLATES.find(t => t.type === type)?.label || type;
  };

  const getConditionIcon = (type: VisualCondition['type']) => {
    return CONDITION_TEMPLATES.find(t => t.type === type)?.icon;
  };

  return (
    <div className="space-y-6">
      {/* Nom de la règle */}
      <div className="space-y-2">
        <Label htmlFor="rule-name">Nom de la règle</Label>
        <Input
          id="rule-name"
          value={localRule.name}
          onChange={(e) => setLocalRule(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Départ avec horaire = À blanc"
        />
      </div>

      <Separator />

      {/* Conditions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base">Conditions (SI...)</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1 text-xs"
          >
            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPreview ? 'Masquer' : 'Aperçu'}
          </Button>
        </div>

        {/* Aperçu en temps réel */}
        {showPreview && (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {ruleDescription}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Liste des conditions ajoutées */}
        <div className="space-y-2">
          {localRule.conditions.map((cond, index) => (
            <div 
              key={cond.id}
              className="flex items-center gap-2 p-2 rounded-md border bg-background"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              
              <div className="flex items-center gap-2 flex-1">
                <Badge variant="outline" className="gap-1">
                  {getConditionIcon(cond.type)}
                  {cond.type === 'keyword' ? cond.keyword : getConditionLabel(cond.type)}
                </Badge>
                
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                
                <ConditionValueButton
                  value={cond.value}
                  onChange={(v) => updateCondition(cond.id, { value: v })}
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeCondition(cond.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Ajouter des conditions */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Ajouter une condition :</p>
          
          {/* Conditions de base */}
          <div className="flex flex-wrap gap-2">
            {CONDITION_TEMPLATES.filter(t => t.type !== 'keyword').map((template) => {
              const isAdded = localRule.conditions.some(c => c.type === template.type);
              return (
                <TooltipProvider key={template.type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isAdded}
                        onClick={() => addCondition(template.type)}
                        className="gap-1 text-xs"
                      >
                        {template.icon}
                        {template.label}
                        {isAdded && <Check className="h-3 w-3 ml-1 text-green-500" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{template.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          {/* Ajouter un mot-clé */}
          <div className="flex gap-2">
            <Input
              placeholder="Mot-clé (SAL, DIR, DEP...)"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && addKeywordCondition()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={addKeywordCondition}
              disabled={!newKeyword.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Suggestions de mots-clés */}
          <div className="flex flex-wrap gap-1">
            {['SAL', 'DIR', 'INS', 'PRO', 'DEP', 'ARR', 'PARTI', 'RECOUCHE'].map(kw => (
              <Button
                key={kw}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setNewKeyword(kw);
                }}
              >
                {kw}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Résultat */}
      <div className="space-y-3">
        <Label className="text-base">Résultat (ALORS...)</Label>
        
        <div className="grid grid-cols-3 gap-2">
          {RESULT_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setLocalRule(prev => ({ ...prev, resultType: option.value as 'full' | 'quick' | 'none' }))}
              className={`p-3 rounded-md border-2 transition-all ${
                localRule.resultType === option.value
                  ? `border-primary ${option.color} text-white`
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <p className="font-medium">{option.label}</p>
              <p className={`text-xs ${localRule.resultType === option.value ? 'text-white/80' : 'text-muted-foreground'}`}>
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Priorité */}
      <div className="flex items-center gap-4">
        <Label htmlFor="priority" className="min-w-fit">Priorité</Label>
        <Input
          id="priority"
          type="number"
          value={localRule.priority}
          onChange={(e) => setLocalRule(prev => ({ ...prev, priority: parseInt(e.target.value) || 50 }))}
          className="w-20"
          min={1}
          max={200}
        />
        <p className="text-xs text-muted-foreground">
          Plus la priorité est haute, plus la règle est évaluée en premier
        </p>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={() => onSave(localRule)} disabled={!localRule.name.trim()}>
          <Check className="h-4 w-4 mr-1" />
          Enregistrer
        </Button>
      </div>
    </div>
  );
};

export default VisualRuleEditor;
