import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CreditCard } from "lucide-react";
import { usePricingConfig } from "@/hooks/use-pricing-config";

export function PricingPlansPanel() {
  const { toast } = useToast();
  const { plans, loading, refresh, setPlans } = usePricingConfig();

  useEffect(() => {
    // ensure first load happens even if panel is mounted late
    // (hook already loads on mount)
  }, []);

  const toggleActive = async (planName: string, nextActive: boolean) => {
    const prev = plans;
    setPlans((current) =>
      current.map((p) => (p.plan_name === planName ? { ...p, is_active: nextActive } : p))
    );

    try {
      const { error } = await supabase
        .from("pricing_config")
        .update({ is_active: nextActive })
        .eq("plan_name", planName);

      if (error) throw error;

      toast({
        title: nextActive ? "Plan activé" : "Plan désactivé",
        description: `Le plan "${planName}" est maintenant ${nextActive ? "actif" : "inactif"}.`,
      });
    } catch (e) {
      console.error("Error updating pricing_config:", e);
      setPlans(prev);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le statut du plan.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Plans & disponibilité
        </h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="animate-pulse">Chargement des plans...</div>
        ) : plans.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun plan trouvé dans la configuration.
            </CardContent>
          </Card>
        ) : (
          plans.map((p) => (
            <Card key={p.plan_name} className={!p.is_active ? "opacity-70" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base capitalize">{p.plan_name}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {p.price_monthly === 0 ? "Gratuit" : `${p.price_monthly}€ / mois (HT)`} •{" "}
                      {p.max_rooms === null ? "Chambres illimitées" : `Max ${p.max_rooms} chambres`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Actif" : "Désactivé"}
                    </Badge>
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={(checked) => toggleActive(p.plan_name, checked)}
                      aria-label={`Activer/désactiver le plan ${p.plan_name}`}
                    />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Les plans désactivés ne pourront plus être achetés (checkout bloqué côté serveur).
        </CardContent>
      </Card>
    </div>
  );
}
