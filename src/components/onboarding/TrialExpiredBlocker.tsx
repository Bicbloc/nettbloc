import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, AlertTriangle, Loader2, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminRole } from '@/hooks/use-admin-role';
import { PlanSimulator } from '@/components/subscription/PlanSimulator';

interface TrialExpiredBlockerProps {
  onSelectPlan?: () => void;
}

export function TrialExpiredBlocker({ onSelectPlan }: TrialExpiredBlockerProps) {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: adminLoading } = useAdminRole();

  const handleChoosePlan = () => {
    if (onSelectPlan) {
      onSelectPlan();
    } else {
      navigate('/plans');
    }
  };

  // Don't show blocker for super admin
  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Super admin bypass
  if (isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="max-w-3xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <Badge variant="secondary" className="mx-auto mb-2">
            Essai terminé
          </Badge>
          <CardTitle className="text-2xl">Choisissez le plan adapté à vos besoins</CardTitle>
          <CardDescription className="text-base">
            Répondez à quelques questions pour trouver le plan idéal pour votre établissement.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          <PlanSimulator />

          {/* CTA */}
          <div className="flex flex-col gap-3 pt-4">
            <Button size="lg" onClick={handleChoosePlan} className="w-full">
              <CreditCard className="h-5 w-5 mr-2" />
              Souscrire maintenant
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Paiement par prélèvement SEPA via GoCardless • Sans engagement • Résiliable à tout moment
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
