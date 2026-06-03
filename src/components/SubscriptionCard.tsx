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
  const { plan, subscribed, subscription_end, isPremium, isFree, isInTrial, isPaused, trialDaysRemaining, loading, refreshSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
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
    setShowDetails(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.subscription) {
        setSubscriptionDetails(data);
      }
    } catch (error: any) {
      console.error('Erreur gestion abonnement:', error);
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

  const handlePauseSubscription = async () => {
    setIsPausing(true);
    try {
      const { error } = await supabase.functions.invoke('pause-subscription');
      if (error) throw error;
      toast({
        title: 'Abonnement suspendu',
        description: 'Votre abonnement est temporairement suspendu. Les prélèvements sont mis en pause.',
      });
      setShowPauseDialog(false);
      setShowDetails(false);
      refreshSubscription();
    } catch (error: any) {
      console.error('Erreur suspension:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || "Impossible de suspendre l'abonnement",
      });
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeSubscription = async () => {
    setIsResuming(true);
    try {
      const { error } = await supabase.functions.invoke('resume-subscription');
      if (error) throw error;
      toast({
        title: 'Abonnement réactivé',
        description: 'Votre abonnement a été réactivé. Les prélèvements reprennent.',
      });
      setShowDetails(false);
      refreshSubscription();
    } catch (error: any) {
      console.error('Erreur réactivation:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || "Impossible de réactiver l'abonnement",
      });
    } finally {
      setIsResuming(false);
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
                  {`Plan ${PLAN_CONFIGS[plan]?.displayName || plan}`}
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

          {/* Bandeau suspension */}
          {isPaused && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Votre abonnement est suspendu temporairement. Réactivez-le pour reprendre les prélèvements.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isFree || isInTrial ? (
              <UpgradeButton 
                variant="default" 
                className="flex-1 bg-gradient-premium hover:bg-gradient-premium/90" 
              />
            ) : isPaused ? (
              <Button
                onClick={handleResumeSubscription}
                disabled={isResuming}
                className="flex-1"
              >
                {isResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />}
                {isResuming ? 'Réactivation...' : "Réactiver l'abonnement"}
              </Button>
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


      {/* Dialog de gestion de l'abonnement */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gérer mon abonnement
            </DialogTitle>
            <DialogDescription>
              Consultez votre abonnement actuel et changez de plan à tout moment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Abonnement actuel */}
            <div className="p-4 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold text-base">Plan actuel : {PLAN_CONFIGS[plan]?.displayName || plan}</h4>
                </div>
                <Badge variant="default">Actif</Badge>
              </div>
              <div className="text-2xl font-bold">
                {subscriptionDetails?.subscription.amount ?? PLAN_CONFIGS[plan]?.price ?? 0}€
                <span className="text-sm font-normal text-muted-foreground">/mois</span>
              </div>
              {subscription_end && (
                <p className="text-sm text-muted-foreground mt-1">
                  Renouvellement le {new Date(subscription_end).toLocaleDateString('fr-FR')}
                </p>
              )}
              {isLoading && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Chargement des détails...
                </p>
              )}
            </div>

            {/* Changer de plan */}
            <div>
              <h4 className="font-semibold mb-3">Changer de plan</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {planOrder.map((p) => {
                  const config = PLAN_CONFIGS[p];
                  const targetIndex = planOrder.indexOf(p);
                  const isCurrent = p === plan;
                  const isUpgrade = targetIndex > currentPlanIndex;
                  const isDowngrade = targetIndex < currentPlanIndex;

                  return (
                    <div
                      key={p}
                      className={`p-4 rounded-lg border transition-all ${
                        isCurrent
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium">{config.displayName}</h5>
                        {isCurrent && <Badge variant="secondary"><Check className="h-3 w-3 mr-1" />Actuel</Badge>}
                      </div>
                      <div className="text-xl font-bold mb-1">
                        {config.price}€<span className="text-xs font-normal text-muted-foreground">/mois</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {config.maxRooms ? `Jusqu'à ${config.maxRooms} chambres` : 'Chambres illimitées'}
                      </p>
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant={isUpgrade ? 'default' : 'outline'}
                          className="w-full"
                          disabled={changingPlan !== null}
                          onClick={() => handleChangePlan(p)}
                        >
                          {changingPlan === p ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isUpgrade ? (
                            <><ArrowUp className="h-3 w-3 mr-1" />Upgrade</>
                          ) : (
                            <><ArrowDown className="h-3 w-3 mr-1" />Downgrade</>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Détails GoCardless si disponibles */}
            {subscriptionDetails && (
              <>
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

                {subscriptionDetails.mandate && (
                  <div className="text-sm text-muted-foreground p-3 rounded bg-muted/10">
                    <p>Mandat SEPA: {subscriptionDetails.mandate.reference}</p>
                    <p>Schéma: {subscriptionDetails.mandate.scheme.toUpperCase()}</p>
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setShowDetails(false)}>
                Fermer
              </Button>
              {isPremium && !isPaused && (
                <Button variant="outline" onClick={() => setShowPauseDialog(true)}>
                  Suspendre temporairement
                </Button>
              )}
              {isPaused && (
                <Button onClick={handleResumeSubscription} disabled={isResuming}>
                  {isResuming ? 'Réactivation...' : 'Réactiver'}
                </Button>
              )}
              {isPremium && (
                <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
                  Résilier l'abonnement
                </Button>
              )}

            </div>
          </div>
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

      {/* Dialog de confirmation de suspension */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Suspendre temporairement ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Votre abonnement sera mis en pause et les prélèvements seront temporairement suspendus. Vous pourrez le réactiver à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPausing}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handlePauseSubscription} disabled={isPausing}>
              {isPausing ? 'Suspension...' : 'Confirmer la suspension'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
