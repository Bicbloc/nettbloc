import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  CreditCard, AlertTriangle, CheckCircle2, Building2, 
  Sparkles, Zap, Star, Crown, Loader2, ArrowRight,
  BedDouble, Wrench, ClipboardCheck, Shirt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/use-admin-role';
import { useAuth } from '@/contexts/AuthContext';

interface PricingPlan {
  plan_name: string;
  price_monthly: number;
  max_rooms: number | null;
  is_active: boolean;
  display_name: string;
  features: {
    incidents: boolean;
    linen_inventory: boolean;
    inspection: boolean;
  };
}

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  freemium: "Découverte",
  basic: "Essentiel",
  basic_plus: "Confort",
  premium: "Business",
  platinum: "Entreprise"
};

const PLAN_FEATURES: Record<string, { incidents: boolean; linen_inventory: boolean; inspection: boolean }> = {
  freemium: { incidents: false, linen_inventory: false, inspection: false },
  basic: { incidents: false, linen_inventory: false, inspection: false },
  basic_plus: { incidents: true, linen_inventory: true, inspection: false },
  premium: { incidents: true, linen_inventory: true, inspection: true },
  platinum: { incidents: true, linen_inventory: true, inspection: true }
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  freemium: Sparkles,
  basic: Zap,
  basic_plus: Star,
  premium: Crown,
  platinum: Building2
};

interface TrialExpiredBlockerProps {
  onSelectPlan?: () => void;
}

export function TrialExpiredBlocker({ onSelectPlan }: TrialExpiredBlockerProps) {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: adminLoading } = useAdminRole();
  const { user } = useAuth();
  
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Simulator state
  const [roomCount, setRoomCount] = useState(50);
  const [needIncidents, setNeedIncidents] = useState(false);
  const [needLinen, setNeedLinen] = useState(false);
  const [needInspection, setNeedInspection] = useState(false);
  
  const [recommendedPlan, setRecommendedPlan] = useState<PricingPlan | null>(null);

  // Load plans from database
  useEffect(() => {
    const loadPlans = async () => {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('plan_name, price_monthly, max_rooms, is_active')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (!error && data) {
        const enrichedPlans = data.map(plan => ({
          ...plan,
          display_name: PLAN_DISPLAY_NAMES[plan.plan_name] || plan.plan_name,
          features: PLAN_FEATURES[plan.plan_name] || { incidents: false, linen_inventory: false, inspection: false }
        }));
        setPlans(enrichedPlans);
      }
      setLoading(false);
    };

    loadPlans();
  }, []);

  // Calculate recommended plan based on criteria
  useEffect(() => {
    if (plans.length === 0) return;

    // Find best matching plan
    const matchingPlans = plans.filter(plan => {
      // Check room capacity
      if (plan.max_rooms !== null && plan.max_rooms < roomCount) {
        return false;
      }
      
      // Check feature requirements
      if (needIncidents && !plan.features.incidents) return false;
      if (needLinen && !plan.features.linen_inventory) return false;
      if (needInspection && !plan.features.inspection) return false;
      
      return true;
    });

    // Get cheapest matching plan
    const bestPlan = matchingPlans.sort((a, b) => a.price_monthly - b.price_monthly)[0];
    setRecommendedPlan(bestPlan || null);
  }, [plans, roomCount, needIncidents, needLinen, needInspection]);

  const handleChoosePlan = () => {
    if (onSelectPlan) {
      onSelectPlan();
    } else {
      navigate('/plans');
    }
  };

  // Don't show blocker for super admin
  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Super admin bypass
  if (isSuperAdmin) {
    return null;
  }

  const getPlanIcon = (planName: string) => {
    const Icon = PLAN_ICONS[planName] || CreditCard;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="max-w-3xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <Badge variant="secondary" className="mx-auto mb-2">
            Essai terminé
          </Badge>
          <CardTitle className="text-2xl">Choisissez le plan adapté à vos besoins</CardTitle>
          <CardDescription className="text-base">
            Répondez à quelques questions pour trouver le plan idéal pour votre établissement.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Simulator */}
              <div className="space-y-6 p-6 bg-muted/50 rounded-xl">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Simulateur de plan
                </h3>

                {/* Room count */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      Nombre de chambres
                    </Label>
                    <Badge variant="outline" className="text-lg font-mono">
                      {roomCount}
                    </Badge>
                  </div>
                  <Slider
                    value={[roomCount]}
                    onValueChange={([value]) => setRoomCount(value)}
                    min={10}
                    max={300}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10</span>
                    <span>100</span>
                    <span>200</span>
                    <span>300+</span>
                  </div>
                </div>

                {/* Features needed */}
                <div className="space-y-3">
                  <Label>Fonctionnalités souhaitées</Label>
                  
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Wrench className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="font-medium text-sm">Module incidents</p>
                          <p className="text-xs text-muted-foreground">Signalement et suivi des problèmes</p>
                        </div>
                      </div>
                      <Switch
                        checked={needIncidents}
                        onCheckedChange={setNeedIncidents}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Shirt className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">Gestion du linge</p>
                          <p className="text-xs text-muted-foreground">Inventaire et suivi du linge</p>
                        </div>
                      </div>
                      <Switch
                        checked={needLinen}
                        onCheckedChange={setNeedLinen}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <div className="flex items-center gap-3">
                        <ClipboardCheck className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium text-sm">Inspections gouvernante</p>
                          <p className="text-xs text-muted-foreground">Contrôle qualité des chambres</p>
                        </div>
                      </div>
                      <Switch
                        checked={needInspection}
                        onCheckedChange={setNeedInspection}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommended plan */}
              {recommendedPlan && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-center">Notre recommandation</h3>
                  
                  <div className="relative p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border-2 border-primary">
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                      Recommandé pour vous
                    </Badge>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-primary/20 text-primary">
                          {getPlanIcon(recommendedPlan.plan_name)}
                        </div>
                        <div>
                          <h4 className="text-xl font-bold">{recommendedPlan.display_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {recommendedPlan.max_rooms 
                              ? `Jusqu'à ${recommendedPlan.max_rooms} chambres` 
                              : 'Chambres illimitées'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">
                          {recommendedPlan.price_monthly}€
                          <span className="text-sm font-normal text-muted-foreground">/mois HT</span>
                        </p>
                      </div>
                    </div>

                    {/* Features included */}
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Import PDF</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Distribution auto</span>
                      </div>
                      {recommendedPlan.features.incidents && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Incidents</span>
                        </div>
                      )}
                      {recommendedPlan.features.linen_inventory && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Gestion linge</span>
                        </div>
                      )}
                      {recommendedPlan.features.inspection && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Inspections</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* All plans summary */}
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground">Tous les plans disponibles</p>
                <div className="grid gap-2">
                  {plans.map((plan) => {
                    const isRecommended = recommendedPlan?.plan_name === plan.plan_name;
                    const tooSmall = plan.max_rooms !== null && plan.max_rooms < roomCount;
                    const missingFeatures = 
                      (needIncidents && !plan.features.incidents) ||
                      (needLinen && !plan.features.linen_inventory) ||
                      (needInspection && !plan.features.inspection);
                    const isDisabled = tooSmall || missingFeatures;
                    
                    return (
                      <div 
                        key={plan.plan_name}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          isRecommended 
                            ? 'bg-primary/5 border-primary' 
                            : isDisabled 
                              ? 'opacity-50 bg-muted/30'
                              : 'bg-card hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isRecommended ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {getPlanIcon(plan.plan_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{plan.display_name}</p>
                              {isRecommended && (
                                <Badge variant="default" className="text-xs">Recommandé</Badge>
                              )}
                              {tooSmall && (
                                <Badge variant="destructive" className="text-xs">Capacité insuffisante</Badge>
                              )}
                              {!tooSmall && missingFeatures && (
                                <Badge variant="secondary" className="text-xs">Fonctionnalités manquantes</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {plan.max_rooms ? `≤ ${plan.max_rooms} chambres` : 'Illimité'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {plan.price_monthly === 0 ? 'Gratuit' : `${plan.price_monthly}€/mois`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col gap-3 pt-4">
                <Button size="lg" onClick={handleChoosePlan} className="w-full">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Souscrire maintenant
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Paiement par prélèvement SEPA via GoCardless • Sans engagement • Résiliable à tout moment
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
