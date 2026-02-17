import { Crown, Zap, Clock, Star, Diamond } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PlanType } from '@/hooks/useSubscription';

interface SubscriptionBadgeProps {
  plan: PlanType;
  subscribed?: boolean;
  subscriptionEnd?: string;
  trialDaysRemaining?: number;
  size?: 'sm' | 'md' | 'lg';
  showExpiration?: boolean;
  className?: string;
}

const planConfig: Record<PlanType, { label: string; icon: typeof Crown; gradient: string }> = {
  decouverte: { label: 'Découverte', icon: Zap, gradient: 'bg-gradient-freemium text-freemium-foreground border-freemium/20' },
  essentiel: { label: 'Essentiel', icon: Star, gradient: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400/20' },
  confort: { label: 'Confort', icon: Star, gradient: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-indigo-400/20' },
  business: { label: 'Business', icon: Crown, gradient: 'bg-gradient-premium text-premium-foreground border-premium/20' },
  entreprise: { label: 'Entreprise', icon: Diamond, gradient: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-400/20' }
};

export function SubscriptionBadge({ 
  plan, 
  subscribed = false, 
  subscriptionEnd,
  trialDaysRemaining,
  size = 'md',
  showExpiration = false,
  className 
}: SubscriptionBadgeProps) {
  const isTrial = trialDaysRemaining !== undefined && trialDaysRemaining > 0;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5'
  };

  if (isTrial) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Badge 
          className={cn(
            'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold border-amber-400/20 shadow-lg',
            sizeClasses[size],
            className
          )}
        >
          <Clock className={cn('mr-1.5', iconSizes[size])} />
          Essai Premium
        </Badge>
        <span className="text-xs text-muted-foreground">
          {trialDaysRemaining} jours restants
        </span>
      </div>
    );
  }

  const config = planConfig[plan] || planConfig.decouverte;
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-1">
      <Badge 
        className={cn(
          'font-semibold shadow-lg',
          config.gradient,
          sizeClasses[size],
          className
        )}
      >
        <Icon className={cn('mr-1.5', iconSizes[size])} />
        {config.label}
      </Badge>
      {showExpiration && subscriptionEnd && subscribed && (
        <span className="text-xs text-muted-foreground">
          Expire le {new Date(subscriptionEnd).toLocaleDateString('fr-FR')}
        </span>
      )}
    </div>
  );
}
