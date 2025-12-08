import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Sparkles, Zap } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeButton } from '@/components/UpgradeButton';

interface FeatureGuardProps {
  children: ReactNode;
  feature: 'incidents' | 'linen' | 'access_codes' | 'ai_learning' | 'api_access' | 'unlimited_rooms';
  fallback?: ReactNode;
  showUpgradeCard?: boolean;
  roomCount?: number;
  maxFreeRooms?: number;
}

const featureLabels: Record<string, { title: string; description: string; icon: ReactNode }> = {
  incidents: {
    title: "Gestion des incidents",
    description: "Signalez et suivez les incidents de maintenance",
    icon: <Sparkles className="h-5 w-5" />
  },
  linen: {
    title: "Inventaire linge",
    description: "Gérez l'inventaire du linge avec comptage IA",
    icon: <Sparkles className="h-5 w-5" />
  },
  access_codes: {
    title: "Codes d'accès équipe",
    description: "Générez des codes uniques pour votre équipe",
    icon: <Lock className="h-5 w-5" />
  },
  ai_learning: {
    title: "Apprentissage IA avancé",
    description: "Analyse PDF plus précise grâce à l'IA",
    icon: <Zap className="h-5 w-5" />
  },
  api_access: {
    title: "Accès API",
    description: "Connectez NettoBloc à vos outils existants",
    icon: <Sparkles className="h-5 w-5" />
  },
  unlimited_rooms: {
    title: "Chambres illimitées",
    description: "Gérez autant de chambres que nécessaire",
    icon: <Crown className="h-5 w-5" />
  }
};

export function FeatureGuard({ 
  children, 
  feature, 
  fallback, 
  showUpgradeCard = true,
  roomCount,
  maxFreeRooms = 15
}: FeatureGuardProps) {
  const { isPremium, isInTrial, loading, trialDaysRemaining } = useSubscription();

  // Loading state
  if (loading) {
    return <div className="animate-pulse bg-muted rounded-lg h-32" />;
  }

  // Premium or in trial: show content
  if (isPremium || isInTrial) {
    return <>{children}</>;
  }

  // Room limit check for free users
  if (feature === 'unlimited_rooms' && roomCount !== undefined) {
    if (roomCount <= maxFreeRooms) {
      return <>{children}</>;
    }
  }

  // Free user trying to access premium feature
  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradeCard) {
    return null;
  }

  const featureInfo = featureLabels[feature] || {
    title: "Fonctionnalité Premium",
    description: "Cette fonctionnalité est réservée aux abonnés Premium",
    icon: <Crown className="h-5 w-5" />
  };

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <Badge variant="secondary" className="w-fit mx-auto mb-2">
          <Crown className="h-3 w-3 mr-1" />
          Premium
        </Badge>
        <CardTitle className="text-lg">{featureInfo.title}</CardTitle>
        <CardDescription>{featureInfo.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Passez au Premium pour débloquer cette fonctionnalité et profiter de tous les avantages :
          </p>
          <ul className="text-sm text-left mt-3 space-y-2">
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Chambres illimitées
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Codes d'accès pour l'équipe
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Gestion des incidents
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Inventaire linge IA
            </li>
          </ul>
        </div>
        
        <div className="space-y-2">
          <UpgradeButton className="w-full" />
          <p className="text-xs text-muted-foreground">
            Essai gratuit de 3 mois pour les nouveaux utilisateurs
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Room limit warning component
export function RoomLimitWarning({ currentCount, maxFree = 15 }: { currentCount: number; maxFree?: number }) {
  const { isPremium, isInTrial } = useSubscription();
  
  if (isPremium || isInTrial || currentCount <= maxFree) {
    return null;
  }

  const overLimit = currentCount - maxFree;

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-destructive/10">
            <Lock className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-destructive">
              Limite de chambres atteinte
            </p>
            <p className="text-sm text-muted-foreground">
              Vous avez {currentCount} chambres ({overLimit} de plus que la limite gratuite de {maxFree}).
            </p>
          </div>
          <UpgradeButton size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
