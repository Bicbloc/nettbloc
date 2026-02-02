import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Sparkles, Zap, AlertTriangle } from 'lucide-react';
import { useSubscription, PLAN_CONFIGS } from '@/hooks/useSubscription';
import { UpgradeButton } from '@/components/UpgradeButton';
import { useNavigate } from 'react-router-dom';

interface FeatureGuardProps {
  children: ReactNode;
  feature: 'incidents' | 'linen' | 'access_codes' | 'ai_learning' | 'api_access' | 'unlimited_rooms' | 'inspection';
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
  },
  inspection: {
    title: "Inspections gouvernante",
    description: "Module d'inspection des chambres avec notation",
    icon: <Sparkles className="h-5 w-5" />
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
  const { isPremium, isInTrial, isTrialExpired, loading, trialDaysRemaining, plan, maxRooms, subscribed } = useSubscription();
  const navigate = useNavigate();

  // Loading state
  if (loading) {
    return <div className="animate-pulse bg-muted rounded-lg h-32" />;
  }

  // Trial expired - redirect to plan selection
  if (isTrialExpired && !subscribed) {
    if (fallback) return <>{fallback}</>;
    return (
      <TrialExpiredCard onChoosePlan={() => navigate('/plans')} />
    );
  }

  // Premium or in trial: show content
  if (isPremium || isInTrial) {
    return <>{children}</>;
  }

  // Room limit check for free users
  if (feature === 'unlimited_rooms' && roomCount !== undefined) {
    if (roomCount <= maxRooms) {
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
            Votre plan actuel: <Badge variant="outline">{PLAN_CONFIGS[plan].displayName}</Badge>
          </p>
        </div>
        
        <div className="space-y-2">
          <UpgradeButton className="w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// Trial expired card
function TrialExpiredCard({ onChoosePlan }: { onChoosePlan: () => void }) {
  return (
    <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/20">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 w-fit mb-2">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <CardTitle className="text-lg">Période d'essai terminée</CardTitle>
        <CardDescription>
          Choisissez un plan pour continuer à accéder à cette fonctionnalité
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button onClick={onChoosePlan} className="bg-amber-600 hover:bg-amber-700">
          <Crown className="h-4 w-4 mr-2" />
          Choisir un plan
        </Button>
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
