import { Crown, Zap, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SubscriptionBadgeProps {
  plan: 'free' | 'premium' | 'trial';
  subscribed?: boolean;
  subscriptionEnd?: string;
  trialDaysRemaining?: number;
  size?: 'sm' | 'md' | 'lg';
  showExpiration?: boolean;
  className?: string;
}

export function SubscriptionBadge({ 
  plan, 
  subscribed = false, 
  subscriptionEnd,
  trialDaysRemaining,
  size = 'md',
  showExpiration = false,
  className 
}: SubscriptionBadgeProps) {
  const isPremium = plan === 'premium' && subscribed;
  const isTrial = plan === 'trial';
  
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

  if (isPremium) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Badge 
          className={cn(
            'bg-gradient-premium text-premium-foreground font-semibold border-premium/20 shadow-lg',
            sizeClasses[size],
            className
          )}
        >
          <Crown className={cn('mr-1.5', iconSizes[size])} />
          Premium
        </Badge>
        {showExpiration && subscriptionEnd && (
          <span className="text-xs text-muted-foreground">
            Expire le {new Date(subscriptionEnd).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>
    );
  }

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
        {trialDaysRemaining !== undefined && (
          <span className="text-xs text-muted-foreground">
            {trialDaysRemaining} jours restants
          </span>
        )}
      </div>
    );
  }

  return (
    <Badge 
      variant="secondary"
      className={cn(
        'bg-gradient-freemium text-freemium-foreground border-freemium/20',
        sizeClasses[size],
        className
      )}
    >
      <Zap className={cn('mr-1.5', iconSizes[size])} />
      Freemium
    </Badge>
  );
}