import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, CreditCard, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_CONFIGS, PlanType } from '@/hooks/useSubscription';

interface TrialExpiredBlockerProps {
  onSelectPlan?: () => void;
}

export function TrialExpiredBlocker({ onSelectPlan }: TrialExpiredBlockerProps) {
  const navigate = useNavigate();

  const handleChoosePlan = () => {
    if (onSelectPlan) {
      onSelectPlan();
    } else {
      navigate('/plans');
    }
  };

  const plans = Object.entries(PLAN_CONFIGS)
    .filter(([key]) => key !== 'freemium')
    .map(([key, config]) => ({
      id: key as PlanType,
      ...config
    }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <Badge variant="secondary" className="mx-auto mb-2">
            Essai terminé
          </Badge>
          <CardTitle className="text-2xl">Votre période d'essai est terminée</CardTitle>
          <CardDescription className="text-base">
            Pour continuer à utiliser NettoBloc, choisissez un plan adapté à votre établissement.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Résumé des plans */}
          <div className="grid gap-3">
            {plans.slice(0, 3).map((plan) => (
              <div 
                key={plan.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{plan.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      Jusqu'à {plan.maxRooms || '∞'} chambres
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{plan.price}€<span className="text-xs text-muted-foreground">/mois</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* Fonctionnalités incluses */}
          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
            <p className="font-medium text-green-800 dark:text-green-200 mb-2">
              Tous les plans incluent :
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm text-green-700 dark:text-green-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Import PDF automatique</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Distribution équitable</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Rapports journaliers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Codes d'accès équipe</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={handleChoosePlan} className="w-full">
              <CreditCard className="h-5 w-5 mr-2" />
              Choisir mon plan
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Paiement par prélèvement SEPA via GoCardless • Sans engagement
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
