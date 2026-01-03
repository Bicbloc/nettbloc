import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, PLAN_CONFIGS, PlanType } from '@/hooks/useSubscription';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Crown, Star, Diamond, Zap, Check, X, ArrowRight, Gift, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const PlanSelection = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const { plan: currentPlan, isPremium, isFree, loading: subscriptionLoading, isInTrial } = useSubscription();
  const [promoCode, setPromoCode] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const { toast } = useToast();

  if (!loading && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    
    setPromoValidating(true);
    try {
      const { data, error } = await supabase.rpc('validate_promo_code', {
        p_code: promoCode.toUpperCase(),
        p_plan: 'premium'
      });

      if (error) throw error;

      const result = data?.[0];
      if (result?.is_valid) {
        setPromoDiscount({ type: result.discount_type, value: result.discount_value });
        toast({
          title: "Code promo valide !",
          description: `Réduction de ${result.discount_type === 'percentage' ? result.discount_value + '%' : result.discount_value + '€'} appliquée.`
        });
      } else {
        toast({
          variant: "destructive",
          title: "Code invalide",
          description: result?.error_message || "Ce code promo n'est pas valide."
        });
        setPromoDiscount(null);
      }
    } catch (error) {
      console.error('Error validating promo:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de valider le code promo."
      });
    } finally {
      setPromoValidating(false);
    }
  };

  const handleSubscribe = async (planType: PlanType) => {
    if (planType === 'freemium') {
      window.location.href = '/';
      return;
    }

    setCheckoutLoading(planType);
    try {
      const planConfig = PLAN_CONFIGS[planType];
      const priceInCents = planConfig.price * 100;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          planType,
          priceAmount: priceInCents,
          promoCode: promoDiscount ? promoCode : undefined
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      const message = (error as any)?.message ? String((error as any).message) : String(error);
      console.error('Error creating checkout:', error);

      const isLiveChargesDisabled = message.includes('Your account cannot currently make live charges');

      toast({
        variant: "destructive",
        title: "Paiement indisponible",
        description: isLiveChargesDisabled
          ? "Stripe n'est pas encore activé pour les paiements en mode live. Activez votre compte Stripe (paiements live) ou utilisez une clé de test (sk_test_...) pendant le développement."
          : "Impossible de créer la session de paiement.",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const plans: { type: PlanType; icon: typeof Crown; popular?: boolean; trial?: boolean }[] = [
    { type: 'freemium', icon: Zap },
    { type: 'basic', icon: Star, trial: true },
    { type: 'basic_plus', icon: Star },
    { type: 'premium', icon: Crown, popular: true, trial: true },
    { type: 'platinum', icon: Diamond }
  ];

  const getFeatureList = (planType: PlanType) => {
    const config = PLAN_CONFIGS[planType];
    const features = [];
    
    features.push({ name: 'Analyse PDF automatique', included: true });
    features.push({ name: 'Distribution automatique', included: true });
    features.push({ name: 'Téléchargement rapports', included: true });
    features.push({ name: `Max ${config.maxRooms || '∞'} chambres`, included: true });
    features.push({ name: 'Gestion incidents', included: config.features.incidents });
    features.push({ name: 'Inventaire linge', included: config.features.linen_inventory });
    features.push({ name: 'Inspection chambres', included: config.features.inspection });
    features.push({ name: 'Accès API', included: config.features.api_access });
    
    return features;
  };

  const getDiscountedPrice = (price: number) => {
    if (!promoDiscount) return price;
    if (promoDiscount.type === 'percentage') {
      return price * (1 - promoDiscount.value / 100);
    }
    return Math.max(0, price - promoDiscount.value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-7xl mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {isInTrial ? 
              `Vous êtes en période d'essai. Choisissez un plan pour continuer après l'essai.` :
              'Basic et Premium: 3 mois offerts sans engagement'}
          </p>
        </div>

        {/* Code promo */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Code promo"
                className="pl-10"
              />
            </div>
            <Button 
              onClick={validatePromoCode} 
              disabled={promoValidating || !promoCode.trim()}
              variant="outline"
            >
              {promoValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
            </Button>
          </div>
          {promoDiscount && (
            <p className="text-sm text-green-600 mt-2">
              ✓ Réduction de {promoDiscount.type === 'percentage' ? `${promoDiscount.value}%` : `${promoDiscount.value}€`} appliquée
            </p>
          )}
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map(({ type, icon: Icon, popular, trial }) => {
            const config = PLAN_CONFIGS[type];
            const isCurrentPlan = currentPlan === type;
            const price = config.price;
            const discountedPrice = getDiscountedPrice(price);

            return (
              <Card 
                key={type} 
                className={`relative transition-all duration-300 ${
                  popular ? 'ring-2 ring-primary shadow-xl scale-105' : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Populaire
                  </Badge>
                )}
                {trial && (
                  <Badge className="absolute -top-3 right-2 bg-amber-500">
                    3 mois offerts
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 p-3 rounded-full bg-muted">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle>{config.displayName}</CardTitle>
                  <div className="mt-2">
                    {price === 0 ? (
                      <span className="text-3xl font-bold">Gratuit</span>
                    ) : (
                      <div className="flex flex-col items-center">
                        {promoDiscount && discountedPrice !== price && (
                          <span className="text-lg line-through text-muted-foreground">
                            {price}€
                          </span>
                        )}
                        <span className="text-3xl font-bold">{discountedPrice.toFixed(0)}€</span>
                        <span className="text-sm text-muted-foreground">HT / mois</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {getFeatureList(type).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={!feature.included ? 'text-muted-foreground' : ''}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full"
                    variant={isCurrentPlan ? 'outline' : popular ? 'default' : 'secondary'}
                    disabled={isCurrentPlan || checkoutLoading === type}
                    onClick={() => handleSubscribe(type)}
                  >
                    {checkoutLoading === type ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      'Plan actuel'
                    ) : type === 'freemium' ? (
                      'Continuer gratuit'
                    ) : (
                      <>
                        Choisir
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => window.location.href = '/'}>
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;
