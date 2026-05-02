import { Crown, Zap, Settings, AlertCircle, CreditCard, ArrowUp, ArrowDown, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SubscriptionBadge } from './SubscriptionBadge';
import { UpgradeButton } from './UpgradeButton';
import { useSubscription, PLAN_CONFIGS, PlanType } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/utils/checkoutErrors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SubscriptionDetails {
  subscription: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    name: string;
    interval: number;
    interval_unit: string;
    upcoming_payments: Array<{ charge_date: string; amount: number }>;
    created_at: string;
  };
  mandate: {
    id: string;
    status: string;
    scheme: string;
    reference: string;
  } | null;
  customer: {
    email: string;
    given_name: string;
    family_name: string;
  } | null;
  recent_payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    charge_date: string;
  }>;
}

export function SubscriptionCard() {
  const { plan, subscribed, subscription_end, isPremium, isFree, isInTrial, trialDaysRemaining, loading, refreshSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [changingPlan, setChangingPlan] = useState<PlanType | null>(null);

  const planOrder: PlanType[] = ['decouverte', 'essentiel', 'confort', 'business', 'entreprise'];
  const currentPlanIndex = planOrder.indexOf(plan);

  const handleChangePlan = async (targetPlan: PlanType) => {
    if (targetPlan === plan) return;
    setChangingPlan(targetPlan);
    try {
      if (targetPlan === 'decouverte') {
        // Downgrade vers gratuit = annulation
        setShowCancelDialog(true);
        return;
      }
      const config = PLAN_CONFIGS[targetPlan];
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          planType: targetPlan,
          priceAmount: config.price * 100,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: 'Plan modifié',
          description: `Votre plan a été changé pour ${config.displayName}.`,
        });
        refreshSubscription();
        setShowDetails(false);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: extractErrorMessage(error) || 'Impossible de changer de plan.',
      });
    } finally {
      setChangingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      // Handle case where no subscription exists
      if (data?.has_subscription === false) {
        toast({
          title: "Pas d'abonnement actif",
          description: "Vous n'avez pas encore d'abonnement. Passez au plan Premium pour bénéficier de toutes les fonctionnalités."
        });
        return;
      }
      
      if (data?.subscription) {
        setSubscriptionDetails(data);
        setShowDetails(true);
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de récupérer les détails de l'abonnement"
        });
      }
    } catch (error: any) {
      console.error('Erreur gestion abonnement:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'accéder à la gestion"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');
      
      if (error) throw error;
      
      toast({
        title: "Abonnement annulé",
        description: "Votre abonnement a été annulé avec succès."
      });
      
      setShowCancelDialog(false);
      setShowDetails(false);
      refreshSubscription();
    } catch (error: any) {
      console.error('Erreur annulation:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'annuler l'abonnement"
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatPaymentStatus = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'confirmed': { label: 'Confirmé', className: 'text-green-600' },
      'pending': { label: 'En attente', className: 'text-yellow-600' },
      'failed': { label: 'Échoué', className: 'text-red-600' },
      'paid_out': { label: 'Payé', className: 'text-green-600' },
    };
    return statusMap[status] || { label: status, className: '' };
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Mon Abonnement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`w-full transition-all duration-300 ${isPremium ? 'ring-2 ring-premium/20 bg-gradient-to-br from-premium-light/5 to-transparent' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Mon Abonnement
            </CardTitle>
            <SubscriptionBadge 
              plan={plan}
              subscribed={subscribed}
              subscriptionEnd={subscription_end}
              trialDaysRemaining={trialDaysRemaining}
              showExpiration={isPremium || isInTrial}
            />
          </div>
          <CardDescription>
            {isPremium ? 
              'Profitez de toutes les fonctionnalités premium' : 
              isInTrial ?
                `Essai gratuit - ${trialDaysRemaining} jours restants` :
                'Découvrez les avantages du plan Premium'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statut actuel */}
          <div className="space-y-2">
            <h4 className="font-medium">Statut actuel</h4>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                {isPremium ? (
                  <Crown className="h-4 w-4 text-premium" />
                ) : (
                  <Zap className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {isPremium ? 'Plan Confort' : 'Plan Découverte'}
                </span>
              </div>
              {subscription_end && isPremium && (
                <span className="text-sm text-muted-foreground">
                  Renouvellement le {new Date(subscription_end).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
          </div>

          {/* Fonctionnalités */}
          <div className="space-y-2">
            <h4 className="font-medium">Fonctionnalités incluses</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Analyse PDF automatique</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Distribution automatique des chambres</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Téléchargement des rapports</span>
              </div>
              {isPremium && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-premium rounded-full"></div>
                    <span className="font-medium">Archivage des données</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-premium rounded-full"></div>
                    <span className="font-medium">Gestion d'équipe avancée</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-premium rounded-full"></div>
                    <span className="font-medium">Support prioritaire</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isFree || isInTrial ? (
              <UpgradeButton 
                variant="default" 
                className="flex-1 bg-gradient-premium hover:bg-gradient-premium/90" 
              />
            ) : isPremium ? (
              <Button 
                onClick={handleManageSubscription}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                <Settings className="mr-2 h-4 w-4" />
                {isLoading ? 'Chargement...' : 'Gérer l\'abonnement'}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de détails de l'abonnement GoCardless */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Détails de l'abonnement
            </DialogTitle>
            <DialogDescription>
              Gérez votre abonnement et vos paiements
            </DialogDescription>
          </DialogHeader>

          {subscriptionDetails && (
            <div className="space-y-4">
              {/* Info abonnement */}
              <div className="p-4 rounded-lg bg-muted/30">
                <h4 className="font-medium mb-2">{subscriptionDetails.subscription.name}</h4>
                <div className="text-2xl font-bold">
                  {subscriptionDetails.subscription.amount}€
                  <span className="text-sm font-normal text-muted-foreground">/mois</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Statut: <span className="capitalize">{subscriptionDetails.subscription.status}</span>
                </p>
              </div>

              {/* Prochains paiements */}
              {subscriptionDetails.subscription.upcoming_payments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Prochains paiements</h4>
                  <div className="space-y-2">
                    {subscriptionDetails.subscription.upcoming_payments.map((payment, index) => (
                      <div key={index} className="flex justify-between text-sm p-2 rounded bg-muted/20">
                        <span>{new Date(payment.charge_date).toLocaleDateString('fr-FR')}</span>
                        <span className="font-medium">{payment.amount / 100}€</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historique des paiements */}
              {subscriptionDetails.recent_payments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Paiements récents</h4>
                  <div className="space-y-2">
                    {subscriptionDetails.recent_payments.map((payment) => {
                      const status = formatPaymentStatus(payment.status);
                      return (
                        <div key={payment.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted/20">
                          <span>{new Date(payment.charge_date).toLocaleDateString('fr-FR')}</span>
                          <span className={status.className}>{status.label}</span>
                          <span className="font-medium">{payment.amount}€</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mandat */}
              {subscriptionDetails.mandate && (
                <div className="text-sm text-muted-foreground p-3 rounded bg-muted/10">
                  <p>Mandat SEPA: {subscriptionDetails.mandate.reference}</p>
                  <p>Schéma: {subscriptionDetails.mandate.scheme.toUpperCase()}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDetails(false)}
                >
                  Fermer
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Annuler l'abonnement
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation d'annulation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Annuler l'abonnement ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler votre abonnement ? Vous perdrez l'accès aux fonctionnalités premium à la fin de la période en cours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? 'Annulation...' : 'Confirmer l\'annulation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
