/**
 * Templates de règles de nettoyage par type d'hôtel
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Star, Briefcase, Bed, Sparkles, Check } from 'lucide-react';
import { CleaningRuleCondition, NormalizedCleaningType } from '@/services/pms/types';

interface RuleTemplate {
  name: string;
  description: string;
  conditions: CleaningRuleCondition[];
  conditionLogic: 'AND' | 'OR';
  resultCleaningType: NormalizedCleaningType;
  resultStatus?: string;
  priority: number;
}

interface HotelTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  rules: RuleTemplate[];
}

const HOTEL_TEMPLATES: HotelTemplate[] = [
  {
    id: 'standard',
    name: 'Hôtel Standard',
    description: 'Règles classiques pour hôtels traditionnels',
    icon: <Building2 className="h-6 w-6" />,
    color: 'bg-blue-500',
    rules: [
      {
        name: 'Départ → À Blanc',
        description: 'Nettoyage complet après chaque départ',
        conditions: [{ type: 'status', operator: 'equals', value: 'checkout' }],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        resultStatus: 'checkout',
        priority: 100,
      },
      {
        name: 'Client en séjour → Recouche',
        description: 'Nettoyage léger pour les clients qui restent',
        conditions: [{ type: 'status', operator: 'equals', value: 'stayover' }],
        conditionLogic: 'AND',
        resultCleaningType: 'recouche',
        resultStatus: 'stayover',
        priority: 90,
      },
      {
        name: 'Arrivée → À Blanc',
        description: 'Chambre impeccable pour les nouvelles arrivées',
        conditions: [{ type: 'status', operator: 'equals', value: 'arrival' }],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        resultStatus: 'arrival',
        priority: 95,
      },
    ],
  },
  {
    id: 'luxury',
    name: 'Hôtel de Luxe',
    description: 'Nettoyage complet systématique, standards élevés',
    icon: <Star className="h-6 w-6" />,
    color: 'bg-amber-500',
    rules: [
      {
        name: 'Tout nettoyage → À Blanc',
        description: 'Nettoyage complet pour toutes les chambres occupées',
        conditions: [
          { type: 'status', operator: 'equals', value: 'checkout' },
        ],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        priority: 100,
      },
      {
        name: 'Client en séjour → À Blanc',
        description: 'Même les recouches sont complètes en luxe',
        conditions: [{ type: 'status', operator: 'equals', value: 'stayover' }],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        resultStatus: 'stayover',
        priority: 95,
      },
      {
        name: 'Arrivée VIP → À Blanc prioritaire',
        description: 'Les VIP ont la priorité absolue',
        conditions: [
          { type: 'status', operator: 'equals', value: 'arrival' },
          { type: 'rate_code', operator: 'contains', value: 'VIP' },
        ],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        priority: 110,
      },
    ],
  },
  {
    id: 'residence',
    name: 'Résidence / Appart\'hôtel',
    description: 'Optimisé pour les séjours longs',
    icon: <Bed className="h-6 w-6" />,
    color: 'bg-green-500',
    rules: [
      {
        name: 'Départ → À Blanc',
        description: 'Nettoyage complet après le départ',
        conditions: [{ type: 'status', operator: 'equals', value: 'checkout' }],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        priority: 100,
      },
      {
        name: 'Séjour long → Recouche hebdo',
        description: 'Recouche pour les clients en séjour long',
        conditions: [{ type: 'status', operator: 'equals', value: 'stayover' }],
        conditionLogic: 'AND',
        resultCleaningType: 'recouche',
        resultStatus: 'stayover',
        priority: 70,
      },
      {
        name: 'Dernière nuit → À Blanc',
        description: 'Préparer le départ',
        conditions: [{ type: 'night_info', operator: 'last_night', value: '' }],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        priority: 90,
      },
    ],
  },
  {
    id: 'budget',
    name: 'Hôtel Économique',
    description: 'Optimisation des ressources',
    icon: <Briefcase className="h-6 w-6" />,
    color: 'bg-purple-500',
    rules: [
      {
        name: 'Départ → À Blanc',
        description: 'Nettoyage complet obligatoire après départ',
        conditions: [{ type: 'status', operator: 'equals', value: 'checkout' }],
        conditionLogic: 'AND',
        resultCleaningType: 'a_blanc',
        priority: 100,
      },
      {
        name: 'Séjour court → Recouche optimisée',
        description: 'Recouche rapide pour les séjours courts',
        conditions: [{ type: 'status', operator: 'equals', value: 'stayover' }],
        conditionLogic: 'AND',
        resultCleaningType: 'recouche',
        priority: 80,
      },
      {
        name: 'Chambre propre → Pas de nettoyage',
        description: 'Éviter les nettoyages inutiles',
        conditions: [{ type: 'status', operator: 'equals', value: 'clean' }],
        conditionLogic: 'AND',
        resultCleaningType: 'none',
        priority: 60,
      },
    ],
  },
];

interface RuleTemplatesProps {
  hotelId: string;
  onTemplateApplied: () => void;
}

export function RuleTemplates({ hotelId, onTemplateApplied }: RuleTemplatesProps) {
  const [applying, setApplying] = useState<string | null>(null);
  const [appliedTemplates, setAppliedTemplates] = useState<string[]>([]);

  const applyTemplate = async (template: HotelTemplate) => {
    setApplying(template.id);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Utilisateur non connecté');
        return;
      }

      // Supprimer les anciennes règles de ce template (basé sur les noms)
      const ruleNames = template.rules.map(r => r.name);
      await supabase
        .from('hotel_cleaning_rules')
        .delete()
        .eq('hotel_id', hotelId)
        .in('rule_name', ruleNames);

      // Insérer les nouvelles règles
      const rulesToInsert = template.rules.map(rule => ({
        hotel_id: hotelId,
        rule_name: rule.name,
        description: rule.description,
        conditions: JSON.parse(JSON.stringify(rule.conditions)),
        result_cleaning_type: rule.resultCleaningType,
        result_status: rule.resultStatus || null,
        priority: rule.priority,
        is_active: true,
        created_by: user.user.id,
      }));

      const { error } = await supabase
        .from('hotel_cleaning_rules')
        .insert(rulesToInsert as any);

      if (error) throw error;

      setAppliedTemplates(prev => [...prev, template.id]);
      toast.success(`Template "${template.name}" appliqué avec ${template.rules.length} règles`);
      onTemplateApplied();
    } catch (error) {
      console.error('Erreur application template:', error);
      toast.error('Erreur lors de l\'application du template');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Templates de règles</h3>
          <p className="text-sm text-muted-foreground">
            Appliquez un ensemble de règles prédéfinies selon votre type d'établissement
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {HOTEL_TEMPLATES.map(template => {
          const isApplied = appliedTemplates.includes(template.id);
          const isApplying = applying === template.id;

          return (
            <Card 
              key={template.id} 
              className={`relative overflow-hidden transition-all ${isApplied ? 'ring-2 ring-green-500' : ''}`}
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${template.color}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${template.color} text-white`}>
                      {template.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {template.rules.length} règles
                      </CardDescription>
                    </div>
                  </div>
                  {isApplied && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Appliqué
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.rules.slice(0, 3).map((rule, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {rule.name.split(' → ')[0]}
                    </Badge>
                  ))}
                </div>
                <Button
                  onClick={() => applyTemplate(template)}
                  disabled={isApplying}
                  variant={isApplied ? 'outline' : 'default'}
                  className="w-full"
                  size="sm"
                >
                  {isApplying ? 'Application...' : isApplied ? 'Réappliquer' : 'Appliquer ce template'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
