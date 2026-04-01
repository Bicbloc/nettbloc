import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, PLAN_CONFIGS, PlanType } from '@/hooks/useSubscription';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Crown, Star, Diamond, Zap, Check, X, ArrowRight, Gift, Loader2, Building2, AlertTriangle } from 'lucide-react';
import { PhoneOrderSection } from '@/components/PhoneOrderSection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePricingConfig } from '@/hooks/use-pricing-config';
import { checkoutErrorDescription, detectCheckoutErrorKind, extractErrorMessage } from '@/utils/checkoutErrors';
import { useHotel } from '@/contexts/HotelContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SubAccountGuard } from '@/components/SubAccountGuard';

// Seuil au-dessus duquel le plan Entreprise est obligatoire
const ENTERPRISE_THRESHOLD = 170;

const PlanSelectionContent = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const { plan: currentPlan, isPremium, isFree, loading: subscriptionLoading, isInTrial } = useSubscription();
  const { hotelId } = useHotel();
  const [promoCode, setPromoCode] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [roomCount, setRoomCount] = useState<number>(0);
  const { toast } = useToast();
  const { byPlan: pricingByPlan } = usePricingConfig();

  // Récupérer le nombre de chambres de l'hôtel
  useEffect(() => {
    const fetchRoomCount = async () => {
      if (!hotelId) return;
      
      const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', hotelId);
      
      setRoomCount(count || 0);
    };
    
    fetchRoomCount();
  }, [hotelId]);

  const requiresEnterprise = roomCount > ENTERPRISE_THRESHOLD;

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
    // Vérifier si l'utilisateur doit obligatoirement prendre Entreprise
    if (requiresEnterprise && planType !== 'entreprise') {
      toast({
        variant: 'destructive',
        title: 'Plan insuffisant',
        description: `Votre établissement de ${roomCount} chambres nécessite le plan Entreprise.`,
      });
      return;
    }

    if (planType === 'decouverte') {
      window.location.href = '/';
      return;
    }

    const isPlanActive = pricingByPlan[planType]?.is_active ?? true;
    if (!isPlanActive) {
      toast({
        variant: 'destructive',
        title: 'Plan indisponible',
        description: checkoutErrorDescription('plan_disabled') || 'Ce plan est temporairement indisponible.',
      });
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
          promoCode: promoDiscount ? promoCode : undefined,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      console.error('Error creating checkout:', error);

      const kind = detectCheckoutErrorKind(message);
      const description = checkoutErrorDescription(kind) || 'Impossible de créer la session de paiement.';

      toast({
        variant: 'destructive',
        title: kind === 'plan_disabled' ? 'Plan indisponible' : 'Paiement indisponible',
        description,
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Plans ordonnés par prix croissant avec logique claire
  const plans: { type: PlanType; icon: typeof Crown; popular?: boolean; trial?: boolean; description: string }[] = [
    { 
      type: 'decouverte', 
      icon: Zap,
      description: 'Pour tester la plateforme'
    },
    { 
      type: 'essentiel', 
      icon: Building2, 
      trial: true,
      description: 'Petits établissements'
    },
    { 
      type: 'confort', 
      icon: Star, 
      popular: true, 
      trial: true,
      description: 'Établissements moyens'
    },
    { 
      type: 'business', 
      icon: Crown,
      description: 'Grands établissements'
    },
    { 
      type: 'entreprise', 
      icon: Diamond,
      description: 'Groupes & chaînes hôtelières'
    }
  ];

  const getFeatureList = (planType: PlanType) => {
    const config = PLAN_CONFIGS[planType];
    const features = [];
    
    features.push({ name: 'Analyse PDF automatique', included: true });
    features.push({ name: 'Distribution automatique', included: true });
    features.push({ name: 'Téléchargement rapports', included: true });
    
    if (config.maxRooms) {
      features.push({ name: `Jusqu'à ${config.maxRooms} chambres`, included: true });
    } else {
      features.push({ name: 'Chambres illimitées', included: true });
    }
    
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

  // Vérifie si un plan est accessible (pas bloqué par le seuil)
  const isPlanAccessible = (planType: PlanType) => {
    if (!requiresEnterprise) return true;
    return planType === 'entreprise';
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
              'Essentiel et Confort : 3 mois offerts sans engagement'}
          </p>
          {roomCount > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Votre établissement : <strong>{roomCount} chambres</strong>
            </p>
          )}
        </div>

        {/* Alerte si plan Entreprise obligatoire */}
        {requiresEnterprise && (
          <Alert className="max-w-2xl mx-auto mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Établissement de plus de {ENTERPRISE_THRESHOLD} chambres</strong> : 
              Le plan <strong>Entreprise</strong> est requis pour votre établissement de {roomCount} chambres.
            </AlertDescription>
          </Alert>
        )}

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
          {plans.map(({ type, icon: Icon, popular, trial, description }) => {
            const config = PLAN_CONFIGS[type];
            const isCurrentPlan = currentPlan === type;
            const price = config.price;
            const discountedPrice = getDiscountedPrice(price);
            const isPlanActive = pricingByPlan[type]?.is_active ?? true;
            const isAccessible = isPlanAccessible(type);
            const isDisabled = !isAccessible || !isPlanActive;
            
            return (
              <Card 
                key={type} 
                className={`relative transition-all duration-300 ${
                  popular && !isDisabled ? 'ring-2 ring-primary shadow-xl scale-105' : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''} ${isDisabled ? 'opacity-50 grayscale' : ''}`}
              >
                {popular && !isDisabled && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Populaire
                  </Badge>
                )}
                {trial && !isDisabled && (
                  <Badge className="absolute -top-3 right-2 bg-amber-500">
                    3 mois offerts
                  </Badge>
                )}
                {!isAccessible && requiresEnterprise && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-destructive">
                    Trop petit
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 p-3 rounded-full bg-muted">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle>{config.displayName}</CardTitle>
                  <CardDescription className="text-xs">{description}</CardDescription>
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
                    variant={isCurrentPlan ? 'outline' : (popular && !isDisabled) ? 'default' : 'secondary'}
                    disabled={isCurrentPlan || checkoutLoading === type || isDisabled}
                    onClick={() => handleSubscribe(type)}
                  >
                    {checkoutLoading === type ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      'Plan actuel'
                    ) : !isAccessible ? (
                      'Capacité insuffisante'
                    ) : !isPlanActive ? (
                      'Indisponible'
                    ) : type === 'decouverte' ? (
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

const PlanSelection = () => (
  <SubAccountGuard featureName="la gestion des plans d'abonnement">
    <PlanSelectionContent />
  </SubAccountGuard>
);

export default PlanSelection;
