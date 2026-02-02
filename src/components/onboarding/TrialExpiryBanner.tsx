import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, AlertTriangle, Clock, CreditCard, Gift } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';

interface TrialExpiryBannerProps {
  onDismiss?: () => void;
}

export function TrialExpiryBanner({ onDismiss }: TrialExpiryBannerProps) {
  const { isInTrial, trialEndDate, trialDaysRemaining, subscribed, plan } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Niveau d'alerte basé sur les jours restants
  const warningLevel = trialDaysRemaining !== undefined 
    ? trialDaysRemaining <= 0 ? 4
      : trialDaysRemaining <= 3 ? 3
      : trialDaysRemaining <= 7 ? 2
      : trialDaysRemaining <= 14 ? 1
      : 0
    : 0;

  // Ne pas afficher si pas en essai, déjà abonné, ou pas d'avertissement
  if (!isInTrial || subscribed || warningLevel === 0 || dismissed) {
    return null;
  }

  const handleChoosePlan = () => {
    navigate('/plans');
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Styles selon le niveau d'alerte
  const styles = {
    1: {
      variant: 'default' as const,
      bgClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-800 dark:text-blue-200',
      Icon: Clock,
    },
    2: {
      variant: 'default' as const,
      bgClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
      iconColor: 'text-amber-600',
      textColor: 'text-amber-800 dark:text-amber-200',
      Icon: AlertTriangle,
    },
    3: {
      variant: 'destructive' as const,
      bgClass: 'bg-orange-50 border-orange-300 dark:bg-orange-950/20 dark:border-orange-800',
      iconColor: 'text-orange-600',
      textColor: 'text-orange-800 dark:text-orange-200',
      Icon: AlertTriangle,
    },
    4: {
      variant: 'destructive' as const,
      bgClass: 'bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-800',
      iconColor: 'text-red-600',
      textColor: 'text-red-800 dark:text-red-200',
      Icon: AlertTriangle,
    },
  };

  const { bgClass, iconColor, textColor, Icon } = styles[warningLevel as keyof typeof styles];

  const getMessage = () => {
    if (warningLevel === 4) {
      return {
        title: "Votre essai gratuit a expiré",
        description: "Choisissez un plan pour continuer à utiliser NettoBloc avec toutes les fonctionnalités."
      };
    }
    if (warningLevel === 3) {
      return {
        title: `Plus que ${trialDaysRemaining} jour${trialDaysRemaining !== 1 ? 's' : ''} d'essai !`,
        description: "Choisissez votre plan maintenant pour éviter toute interruption de service."
      };
    }
    if (warningLevel === 2) {
      return {
        title: `${trialDaysRemaining} jours restants`,
        description: "Pensez à choisir votre plan et configurer le prélèvement avant la fin de l'essai."
      };
    }
    return {
      title: `${trialDaysRemaining} jours restants dans votre essai`,
      description: "Profitez de toutes les fonctionnalités premium pendant votre période d'essai."
    };
  };

  const { title, description } = getMessage();

  return (
    <Alert className={`relative ${bgClass} border`}>
      <Icon className={`h-5 w-5 ${iconColor}`} />
      <AlertTitle className={`flex items-center gap-2 ${textColor}`}>
        {title}
        {warningLevel <= 2 && (
          <Badge variant="secondary" className="ml-2">
            <Gift className="h-3 w-3 mr-1" />
            Essai gratuit
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className={`flex items-center justify-between mt-2 ${textColor}`}>
        <span>{description}</span>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={handleChoosePlan}
            className={warningLevel >= 3 ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Choisir un plan
          </Button>
          {warningLevel <= 2 && (
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
