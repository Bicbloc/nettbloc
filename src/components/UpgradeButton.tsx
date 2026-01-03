import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePricingConfig } from '@/hooks/use-pricing-config';
import { checkoutErrorDescription, detectCheckoutErrorKind, extractErrorMessage } from '@/utils/checkoutErrors';

interface UpgradeButtonProps {
  variant?: 'default' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function UpgradeButton({ variant = 'default', size = 'default', className }: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { byPlan: pricingByPlan } = usePricingConfig();
  const premiumActive = pricingByPlan.premium?.is_active ?? true;

  const handleUpgrade = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Connexion requise",
        description: "Veuillez vous connecter pour passer au Premium"
      });
      return;
    }

    if (!premiumActive) {
      toast({
        variant: 'destructive',
        title: 'Plan indisponible',
        description: checkoutErrorDescription('plan_disabled') || 'Ce plan est temporairement indisponible.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) throw error;
      
      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        
        toast({
          title: "Redirection vers le paiement",
          description: "Une nouvelle fenêtre s'est ouverte pour finaliser votre abonnement."
        });
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      console.error('Erreur upgrade:', error);

      const kind = detectCheckoutErrorKind(message);
      toast({
        variant: 'destructive',
        title: kind === 'plan_disabled' ? 'Plan indisponible' : 'Paiement indisponible',
        description: checkoutErrorDescription(kind) || "Impossible d'accéder au paiement",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant={variant}
      size={size}
      className={className}
      onClick={handleUpgrade}
      disabled={isLoading || !premiumActive}
    >
      {isLoading ? (
        <>
          <Crown className="mr-2 h-4 w-4 animate-pulse" />
          Redirection...
        </>
      ) : !premiumActive ? (
        <>
          <Zap className="mr-2 h-4 w-4" />
          Indisponible
        </>
      ) : (
        <>
          <Zap className="mr-2 h-4 w-4" />
          Passer au Premium
        </>
      )}
    </Button>
  );
}