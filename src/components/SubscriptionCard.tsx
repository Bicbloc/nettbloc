import { Crown, Zap, ArrowUp, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubscriptionBadge } from './SubscriptionBadge';
import { UpgradeButton } from './UpgradeButton';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export function SubscriptionCard() {
  const { plan, subscribed, subscription_end, isPremium, isFree, loading } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Redirection vers la gestion",
          description: "Une nouvelle fenêtre s'est ouverte pour gérer votre abonnement."
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
            showExpiration={isPremium}
          />
        </div>
        <CardDescription>
          {isPremium ? 
            'Profitez de toutes les fonctionnalités premium' : 
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
                {isPremium ? 'Plan Premium' : 'Plan Freemium'}
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
          {isFree ? (
            <UpgradeButton 
              variant="default" 
              className="flex-1 bg-gradient-premium hover:bg-gradient-premium/90" 
            />
          ) : (
            <Button 
              onClick={handleManageSubscription}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              <Settings className="mr-2 h-4 w-4" />
              {isLoading ? 'Chargement...' : 'Gérer l\'abonnement'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}