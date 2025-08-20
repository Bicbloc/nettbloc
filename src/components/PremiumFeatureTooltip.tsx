import { Crown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { UpgradeButton } from './UpgradeButton';

interface PremiumFeatureTooltipProps {
  children: React.ReactNode;
  featureName: string;
  description?: string;
  showUpgrade?: boolean;
}

export function PremiumFeatureTooltip({ 
  children, 
  featureName, 
  description,
  showUpgrade = false
}: PremiumFeatureTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex items-center gap-2">
            {children}
            <Badge 
              variant="secondary"
              className="bg-gradient-premium text-premium-foreground text-xs px-2 py-0.5"
            >
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-2">
            <div className="font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-premium" />
              Fonctionnalité Premium
            </div>
            <p className="text-sm">
              <strong>{featureName}</strong> nécessite un abonnement Premium.
            </p>
            {description && (
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
            {showUpgrade && (
              <div className="pt-2">
                <UpgradeButton size="sm" />
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}