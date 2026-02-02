import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Zap, Building2 } from 'lucide-react';
import { useSubscription, PLAN_CONFIGS, PlanType } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';

interface PlanRestrictionGuardProps {
  children: ReactNode;
  feature?: 'incidents' | 'linen' | 'inspection' | 'api_access';
  requiredPlan?: PlanType;
  roomCount?: number;
  showBlocker?: boolean;
}

export function PlanRestrictionGuard({ 
  children, 
  feature,
  requiredPlan,
  roomCount,
  showBlocker = true
}: PlanRestrictionGuardProps) {
  const { 
    plan, 
    isInTrial, 
    trialDaysRemaining, 
    loading, 
    maxRooms,
    featuresEnabled,
    subscribed
  } = useSubscription();
  const navigate = useNavigate();

  // Loading
  if (loading) {
    return <div className="animate-pulse bg-muted rounded-lg h-32" />;
  }

  // Vérifier si l'essai est expiré
  const isTrialExpired = !isInTrial && !subscribed && plan === 'freemium';
  
  // Vérifier si on est après la période d'essai sans abonnement
  if (isTrialExpired && trialDaysRemaining !== undefined && trialDaysRemaining <= 0) {
    if (showBlocker) {
      return <TrialExpiredBlocker />;
    }
    return null;
  }

  // Pendant l'essai, tout est accessible
  if (isInTrial) {
    return <>{children}</>;
  }

  // Vérification des features
  if (feature && !featuresEnabled[feature]) {
    return (
      <LockedFeatureCard 
        feature={feature} 
        currentPlan={plan}
        onUpgrade={() => navigate('/plans')}
      />
    );
  }

  // Vérification du nombre de chambres
  if (roomCount !== undefined && maxRooms && roomCount > maxRooms) {
    return (
      <RoomLimitCard 
        currentCount={roomCount}
        maxAllowed={maxRooms}
        currentPlan={plan}
        onUpgrade={() => navigate('/plans')}
      />
    );
  }

  // Vérification du plan requis
  if (requiredPlan) {
    const planOrder: PlanType[] = ['freemium', 'basic', 'basic_plus', 'premium', 'platinum'];
    const currentPlanIndex = planOrder.indexOf(plan);
    const requiredPlanIndex = planOrder.indexOf(requiredPlan);
    
    if (currentPlanIndex < requiredPlanIndex) {
      return (
        <LockedFeatureCard 
          requiredPlan={requiredPlan}
          currentPlan={plan}
          onUpgrade={() => navigate('/plans')}
        />
      );
    }
  }

  return <>{children}</>;
}

// Composant pour feature bloquée
function LockedFeatureCard({ 
  feature, 
  requiredPlan,
  currentPlan,
  onUpgrade 
}: { 
  feature?: string;
  requiredPlan?: PlanType;
  currentPlan: PlanType;
  onUpgrade: () => void;
}) {
  const featureLabels: Record<string, { title: string; description: string }> = {
    incidents: {
      title: "Gestion des incidents",
      description: "Signalez et suivez les incidents de maintenance"
    },
    linen: {
      title: "Inventaire linge",
      description: "Gérez l'inventaire du linge avec comptage IA"
    },
    inspection: {
      title: "Inspections gouvernante",
      description: "Module d'inspection des chambres"
    },
    api_access: {
      title: "Accès API",
      description: "Connectez NettoBloc à vos systèmes"
    }
  };

  const info = feature ? featureLabels[feature] : {
    title: requiredPlan ? `Plan ${PLAN_CONFIGS[requiredPlan].displayName} requis` : "Fonctionnalité Premium",
    description: "Cette fonctionnalité nécessite un plan supérieur"
  };

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <Badge variant="secondary" className="w-fit mx-auto mb-2">
          <Crown className="h-3 w-3 mr-1" />
          {requiredPlan ? PLAN_CONFIGS[requiredPlan].displayName : 'Premium'}
        </Badge>
        <CardTitle className="text-lg">{info.title}</CardTitle>
        <CardDescription>{info.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Votre plan actuel: <Badge variant="outline">{PLAN_CONFIGS[currentPlan].displayName}</Badge>
        </p>
        <Button onClick={onUpgrade}>
          <Zap className="h-4 w-4 mr-1" />
          Passer au plan supérieur
        </Button>
      </CardContent>
    </Card>
  );
}

// Composant pour limite de chambres
function RoomLimitCard({ 
  currentCount, 
  maxAllowed, 
  currentPlan,
  onUpgrade 
}: { 
  currentCount: number; 
  maxAllowed: number; 
  currentPlan: PlanType;
  onUpgrade: () => void;
}) {
  const overLimit = currentCount - maxAllowed;

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="py-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-destructive/10">
            <Building2 className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-destructive">
              Limite de chambres dépassée
            </p>
            <p className="text-sm text-muted-foreground">
              Vous avez {currentCount} chambres ({overLimit} de plus que la limite de {maxAllowed} pour le plan {PLAN_CONFIGS[currentPlan].displayName}).
            </p>
          </div>
          <Button onClick={onUpgrade} variant="destructive">
            <Zap className="h-4 w-4 mr-1" />
            Augmenter ma limite
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
