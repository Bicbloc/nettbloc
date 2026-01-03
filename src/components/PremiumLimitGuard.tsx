import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumFeatureTooltip } from './PremiumFeatureTooltip';
import { UpgradeButton } from './UpgradeButton';

interface PremiumLimitGuardProps {
  children: React.ReactNode;
  feature?: string;
  roomCount?: number;
  maxFreeRooms?: number;
  showUpgrade?: boolean;
  title?: string;
  description?: string;
}

export const PremiumLimitGuard: React.FC<PremiumLimitGuardProps> = ({
  children,
  feature,
  roomCount = 0,
  maxFreeRooms = 50,
  showUpgrade = true,
  title = "Fonctionnalité Premium",
  description
}) => {
  const { isPremium, isFree, loading, isPaidPlan } = useSubscription() as ReturnType<typeof useSubscription> & { isPaidPlan: boolean };

  // Features that require at least a paid plan (basic, basic+, premium, platinum)
  const paidPlanFeatures = ['access_codes', 'invitations'];

  // Features that require premium only (premium, platinum)
  const premiumFeatures = [
    'advanced_mobile_interface',
    'advanced_profile',
    'unlimited_rooms',
    'advanced_reports',
    'incidents',
    'inspection',
    'linen_inventory',
  ];

  const requiresPaidPlan = feature && paidPlanFeatures.includes(feature);
  const requiresPremium = feature && premiumFeatures.includes(feature);
  const exceedsRoomLimit = roomCount > maxFreeRooms && isFree;

  if (loading) {
    return <div>Vérification des permissions...</div>;
  }

  // If user has premium access, show content
  if (isPremium) {
    return <>{children}</>;
  }

  // For paid plan features (access_codes, invitations), check isPaidPlan
  if (requiresPaidPlan && !isPaidPlan) {
    return (
      <Card className="border-premium/20 bg-premium/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-premium" />
            {title}
            <Badge variant="secondary" className="bg-gradient-premium text-premium-foreground">
              <Crown className="h-3 w-3 mr-1" />
              Abonnement requis
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Cette fonctionnalité est disponible à partir du plan Basic.
          </p>
          {showUpgrade && (
            <div className="pt-4">
              <UpgradeButton />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // If feature requires premium or exceeds room limit, show lock
  if (requiresPremium || exceedsRoomLimit) {
    return (
      <Card className="border-premium/20 bg-premium/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-premium" />
            {title}
            <Badge variant="secondary" className="bg-gradient-premium text-premium-foreground">
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {exceedsRoomLimit && (
            <p className="text-muted-foreground">
              Cette action concerne {roomCount} chambres. La limite gratuite est de {maxFreeRooms} chambres.
            </p>
          )}
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
          {showUpgrade && (
            <div className="pt-4">
              <UpgradeButton />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // For paid plan features but user has paid plan - show content
  if (requiresPaidPlan && isPaidPlan) {
    return <>{children}</>;
  }

  // Show content for free users (no premium feature required)
  return <>{children}</>;
};