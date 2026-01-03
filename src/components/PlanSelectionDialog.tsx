import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Crown, Gift, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PLAN_CONFIGS } from '@/hooks/useSubscription';
import { usePricingConfig } from '@/hooks/use-pricing-config';
import { checkoutErrorDescription, detectCheckoutErrorKind, extractErrorMessage } from '@/utils/checkoutErrors';

interface PlanSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanSelected: (plan: 'free' | 'premium') => void;
}

export function PlanSelectionDialog({ isOpen, onClose, onPlanSelected }: PlanSelectionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'premium' | null>(null);
  const { byPlan: pricingByPlan } = usePricingConfig();
  const premiumActive = pricingByPlan.premium?.is_active ?? true;
  const premiumPrice = PLAN_CONFIGS.premium.price;

  const handlePlanSelect = async (plan: 'free' | 'premium') => {
    setSelectedPlan(plan);
    setIsLoading(true);

    try {
      if (plan === 'premium') {
        if (!premiumActive) {
          toast({
            variant: 'destructive',
            title: 'Plan indisponible',
            description: checkoutErrorDescription('plan_disabled') || 'Ce plan est temporairement indisponible.',
          });
          return;
        }

        // Redirect to Stripe checkout
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { planType: 'premium' },
        });

        if (error) throw error;

        if (data?.url) {
          // Open Stripe checkout in new tab
          window.open(data.url, '_blank');
        }
      } else {
        // Free plan - update profile and create hotel if needed
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Update profile
          await supabase
            .from('profiles')
            .update({ plan: 'free' })
            .eq('id', user.id);
          
          // Check if profile has company_name to create hotel
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_name, email')
            .eq('id', user.id)
            .single();
          
          // Create hotel if it doesn't exist
          const { data: existingHotel } = await supabase
            .from('hotels')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (!existingHotel && profile) {
            const hotelName = profile.company_name || `Établissement de ${profile.email}`;
            await supabase
              .from('hotels')
              .insert({
                name: hotelName,
                email: profile.email || user.email,
                user_id: user.id
              });
            
            console.log('✅ Hôtel créé automatiquement:', hotelName);
          }
        }
        
        toast({
          title: "Plan gratuit activé",
          description: "Votre établissement est maintenant configuré !"
        });
        
        onPlanSelected(plan);
        onClose();
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      console.error('Erreur sélection plan:', error);

      const kind = detectCheckoutErrorKind(message);
      toast({
        variant: 'destructive',
        title: kind === 'plan_disabled' ? 'Plan indisponible' : 'Paiement indisponible',
        description: checkoutErrorDescription(kind) || 'Impossible de sélectionner le plan',
      });
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Choisissez votre plan</DialogTitle>
          <DialogDescription className="text-center">
            Sélectionnez le plan qui correspond le mieux à vos besoins
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Plan Gratuit */}
          <Card className="relative">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <Gift className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-center">Plan Gratuit</CardTitle>
              <div className="text-center">
                <span className="text-3xl font-bold">0€</span>
                <span className="text-muted-foreground">/mois HT</span>
              </div>
              <CardDescription className="text-center">
                Fonctionnalités de base pour commencer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Analyse de rapports PDF</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Distribution automatique des chambres</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Téléchargement de rapports</span>
                </div>
                <div className="flex items-center gap-3 opacity-50">
                  <span className="h-4 w-4 border-2 border-muted-foreground rounded-sm" />
                  <span className="text-sm line-through">Archivage des données</span>
                </div>
                <div className="flex items-center gap-3 opacity-50">
                  <span className="h-4 w-4 border-2 border-muted-foreground rounded-sm" />
                  <span className="text-sm line-through">Gestion avancée des équipes</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => handlePlanSelect('free')}
                disabled={isLoading}
              >
                {selectedPlan === 'free' && isLoading ? 'Activation...' : 'Commencer gratuitement'}
              </Button>
            </CardContent>
          </Card>

          {/* Plan Premium */}
          <Card className="relative border-primary">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                Recommandé
              </div>
            </div>
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-center">Plan Premium</CardTitle>
              <div className="text-center">
                <span className="text-3xl font-bold">{premiumPrice}€</span>
                <span className="text-muted-foreground">/mois HT</span>
              </div>
              <CardDescription className="text-center">
                Toutes les fonctionnalités pour une gestion complète
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Tout du plan gratuit</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Archivage illimité des données</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Gestion avancée des équipes</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Support prioritaire</span>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Toutes les fonctionnalités futures</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => handlePlanSelect('premium')}
                disabled={isLoading || !premiumActive}
              >
                {!premiumActive
                  ? 'Indisponible'
                  : selectedPlan === 'premium' && isLoading
                    ? 'Redirection...'
                    : 'Passer au Premium'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-muted-foreground mt-4">
          Vous pouvez changer de plan à tout moment depuis votre tableau de bord
        </div>
      </DialogContent>
    </Dialog>
  );
}