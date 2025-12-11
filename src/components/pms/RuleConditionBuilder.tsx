/**
 * Constructeur visuel de conditions pour les règles
 * Interface simplifiée sans regex visible
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import {
  CleaningRuleCondition,
  RuleConditionType,
  RuleOperator,
  CONDITION_TYPE_LABELS,
  OPERATOR_LABELS,
  STATUS_OPTIONS,
} from '@/services/pms/types';

interface RuleConditionBuilderProps {
  conditions: CleaningRuleCondition[];
  logic: 'AND' | 'OR';
  onChange: (conditions: CleaningRuleCondition[], logic: 'AND' | 'OR') => void;
}

// Opérateurs disponibles par type de condition
const OPERATORS_BY_TYPE: Record<RuleConditionType, RuleOperator[]> = {
  status: ['equals', 'not_equals'],
  night_info: ['last_night', 'first_night', 'equals'],
  room_pattern: ['starts_with', 'ends_with', 'contains', 'range'],
  floor: ['equals', 'greater_than', 'less_than'],
  rate_code: ['equals', 'contains'],
  room_type: ['equals', 'contains'],
  keyword: ['contains', 'not_contains'],
  date: ['is_today'],
};

// Valeurs prédéfinies par type
const PREDEFINED_VALUES: Record<string, { label: string; value: string }[]> = {
  status: STATUS_OPTIONS,
  night_info_operator: [
    { label: 'Dernière nuit', value: 'last_night' },
    { label: 'Première nuit', value: 'first_night' },
  ],
  rate_code: [
    { label: 'Room Only (RO)', value: 'RO' },
    { label: 'Bed & Breakfast (BB)', value: 'BB' },
    { label: 'Half Board (HB)', value: 'HB' },
    { label: 'Full Board (FB)', value: 'FB' },
    { label: 'All Inclusive (AI)', value: 'AI' },
  ],
  room_type: [
    { label: 'Standard', value: 'standard' },
    { label: 'Double', value: 'double' },
    { label: 'Twin', value: 'twin' },
    { label: 'Suite', value: 'suite' },
    { label: 'Deluxe', value: 'deluxe' },
    { label: 'Superior', value: 'superior' },
  ],
  date_value: [
    { label: 'Date de départ', value: 'departure' },
    { label: 'Date d\'arrivée', value: 'arrival' },
  ],
};

export function RuleConditionBuilder({ conditions, logic, onChange }: RuleConditionBuilderProps) {
  const addCondition = () => {
    const newCondition: CleaningRuleCondition = {
      type: 'status',
      operator: 'equals',
      value: '',
    };
    onChange([...conditions, newCondition], logic);
  };

  const updateCondition = (index: number, updates: Partial<CleaningRuleCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    
    // Réinitialiser l'opérateur si le type change
    if (updates.type && updates.type !== conditions[index].type) {
      const availableOperators = OPERATORS_BY_TYPE[updates.type];
      newConditions[index].operator = availableOperators[0];
      newConditions[index].value = '';
    }
    
    onChange(newConditions, logic);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index), logic);
  };

  const renderValueInput = (condition: CleaningRuleCondition, index: number) => {
    const { type, operator } = condition;

    // Opérateurs sans valeur
    if (operator === 'last_night' || operator === 'first_night') {
      return (
        <Badge variant="secondary" className="h-9 px-3">
          {OPERATOR_LABELS[operator]}
        </Badge>
      );
    }

    // Valeurs prédéfinies pour certains types
    if (type === 'status') {
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(v) => updateCondition(index, { value: v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Choisir..." />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'rate_code') {
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(v) => updateCondition(index, { value: v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Choisir..." />
          </SelectTrigger>
          <SelectContent>
            {PREDEFINED_VALUES.rate_code.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'room_type') {
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(v) => updateCondition(index, { value: v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Choisir..." />
          </SelectTrigger>
          <SelectContent>
            {PREDEFINED_VALUES.room_type.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'date' && operator === 'is_today') {
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(v) => updateCondition(index, { value: v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Choisir..." />
          </SelectTrigger>
          <SelectContent>
            {PREDEFINED_VALUES.date_value.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Plage de numéros
    if (type === 'room_pattern' && operator === 'range') {
      const rangeValue = condition.value as { min: number; max: number } | string;
      const min = typeof rangeValue === 'object' ? rangeValue.min : '';
      const max = typeof rangeValue === 'object' ? rangeValue.max : '';
      
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="w-20"
            placeholder="De"
            value={min}
            onChange={(e) => updateCondition(index, { 
              value: { min: parseInt(e.target.value) || 0, max: max || 0 } 
            })}
          />
          <span className="text-muted-foreground">à</span>
          <Input
            type="number"
            className="w-20"
            placeholder="À"
            value={max}
            onChange={(e) => updateCondition(index, { 
              value: { min: min || 0, max: parseInt(e.target.value) || 0 } 
            })}
          />
        </div>
      );
    }

    // Étage
    if (type === 'floor') {
      return (
        <Input
          type="number"
          className="w-20"
          placeholder="Étage"
          value={String(condition.value)}
          onChange={(e) => updateCondition(index, { value: parseInt(e.target.value) || 0 })}
        />
      );
    }

    // Input texte par défaut
    return (
      <Input
        className="w-[160px]"
        placeholder={getPlaceholder(type, operator)}
        value={String(condition.value)}
        onChange={(e) => updateCondition(index, { value: e.target.value })}
      />
    );
  };

  const getPlaceholder = (type: RuleConditionType, operator: RuleOperator): string => {
    if (type === 'room_pattern') {
      if (operator === 'starts_with') return 'ex: 1 ou A';
      if (operator === 'ends_with') return 'ex: 01';
      if (operator === 'contains') return 'ex: VIP';
    }
    if (type === 'keyword') return 'ex: DÉPART';
    return 'Valeur';
  };

  return (
    <div className="space-y-4">
      {/* Logique ET/OU */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Combiner avec :</span>
          <Select value={logic} onValueChange={(v: 'AND' | 'OR') => onChange(conditions, v)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">ET</SelectItem>
              <SelectItem value="OR">OU</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Liste des conditions */}
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <Card key={index}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Type de condition */}
                <Select
                  value={condition.type}
                  onValueChange={(v: RuleConditionType) => updateCondition(index, { type: v })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Statut</SelectItem>
                    <SelectItem value="night_info">Info nuit</SelectItem>
                    <SelectItem value="room_pattern">N° chambre</SelectItem>
                    <SelectItem value="floor">Étage</SelectItem>
                    <SelectItem value="rate_code">Code tarif</SelectItem>
                    <SelectItem value="room_type">Type chambre</SelectItem>
                    <SelectItem value="keyword">Mot-clé</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                  </SelectContent>
                </Select>

                {/* Opérateur */}
                {condition.type !== 'night_info' || condition.operator === 'equals' ? (
                  <Select
                    value={condition.operator}
                    onValueChange={(v: RuleOperator) => updateCondition(index, { operator: v })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS_BY_TYPE[condition.type].map(op => (
                        <SelectItem key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={condition.operator}
                    onValueChange={(v: RuleOperator) => updateCondition(index, { operator: v })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_night">Dernière nuit</SelectItem>
                      <SelectItem value="first_night">Première nuit</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Valeur */}
                {renderValueInput(condition, index)}

                {/* Supprimer */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(index)}
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Séparateur logique */}
              {index < conditions.length - 1 && (
                <div className="flex items-center justify-center mt-2 -mb-1">
                  <Badge variant="outline" className="text-xs">
                    {logic === 'AND' ? 'ET' : 'OU'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bouton ajouter */}
      <Button variant="outline" onClick={addCondition} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une condition
      </Button>

      {/* Résumé */}
      {conditions.length > 0 && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-1">Résumé de la règle :</p>
          <p className="text-sm text-muted-foreground">
            Si {conditions.map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="font-medium"> {logic === 'AND' ? 'et' : 'ou'} </span>}
                <span className="font-medium">{CONDITION_TYPE_LABELS[c.type]}</span>
                {' '}{OPERATOR_LABELS[c.operator]}{' '}
                {c.operator !== 'last_night' && c.operator !== 'first_night' && (
                  <span className="font-medium">
                    {typeof c.value === 'object' 
                      ? `${(c.value as any).min} à ${(c.value as any).max}`
                      : String(c.value)
                    }
                  </span>
                )}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
