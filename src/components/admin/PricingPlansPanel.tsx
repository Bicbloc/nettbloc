import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CreditCard, Edit2, Save, X, Check, Infinity, Crown, Star, Zap, Sparkles, Building } from "lucide-react";
import { usePricingConfig, type PricingConfigRow } from "@/hooks/use-pricing-config";

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  decouverte: "Découverte",
  essentiel: "Essentiel",
  confort: "Confort",
  business: "Business",
  entreprise: "Entreprise"
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  decouverte: Sparkles,
  essentiel: Zap,
  confort: Star,
  business: Crown,
  entreprise: Building
};

export function PricingPlansPanel() {
  const { toast } = useToast();
  const { plans, loading, refresh, setPlans } = usePricingConfig();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    price_monthly: string;
    max_rooms: string;
    display_name: string;
  }>({ price_monthly: "", max_rooms: "", display_name: "" });
  const [saving, setSaving] = useState(false);

  const startEdit = (plan: PricingConfigRow) => {
    setEditingPlan(plan.plan_name);
    setEditForm({
      price_monthly: plan.price_monthly.toString(),
      max_rooms: plan.max_rooms === null ? "" : plan.max_rooms.toString(),
      display_name: PLAN_DISPLAY_NAMES[plan.plan_name] || plan.plan_name
    });
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setEditForm({ price_monthly: "", max_rooms: "", display_name: "" });
  };

  const saveEdit = async (planName: string) => {
    setSaving(true);
    const prev = plans;
    
    const newPrice = parseFloat(editForm.price_monthly);
    const newMaxRooms = editForm.max_rooms === "" ? null : parseInt(editForm.max_rooms);
    
    if (isNaN(newPrice) || newPrice < 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le prix doit être un nombre positif."
      });
      setSaving(false);
      return;
    }

    if (editForm.max_rooms !== "" && (isNaN(newMaxRooms!) || newMaxRooms! < 0)) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le nombre de chambres doit être un nombre positif ou vide pour illimité."
      });
      setSaving(false);
      return;
    }

    // Optimistic update
    setPlans(current =>
      current.map(p =>
        p.plan_name === planName
          ? { ...p, price_monthly: newPrice, max_rooms: newMaxRooms }
          : p
      )
    );

    try {
      const { error } = await supabase
        .from("pricing_config")
        .update({ 
          price_monthly: newPrice,
          max_rooms: newMaxRooms
        })
        .eq("plan_name", planName);

      if (error) throw error;

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action: 'update_pricing_plan',
        p_details: { 
          plan_name: planName, 
          new_price: newPrice, 
          new_max_rooms: newMaxRooms 
        }
      });

      toast({
        title: "Plan mis à jour",
        description: `Le plan "${PLAN_DISPLAY_NAMES[planName] || planName}" a été modifié.`
      });
      
      setEditingPlan(null);
    } catch (e) {
      console.error("Error updating pricing_config:", e);
      setPlans(prev);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le plan."
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (planName: string, nextActive: boolean) => {
    const prev = plans;
    setPlans(current =>
      current.map(p => (p.plan_name === planName ? { ...p, is_active: nextActive } : p))
    );

    try {
      const { error } = await supabase
        .from("pricing_config")
        .update({ is_active: nextActive })
        .eq("plan_name", planName);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action: nextActive ? 'activate_plan' : 'deactivate_plan',
        p_details: { plan_name: planName }
      });

      toast({
        title: nextActive ? "Plan activé" : "Plan désactivé",
        description: `Le plan "${PLAN_DISPLAY_NAMES[planName] || planName}" est maintenant ${nextActive ? "actif" : "inactif"}.`
      });
    } catch (e) {
      console.error("Error updating pricing_config:", e);
      setPlans(prev);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le statut du plan."
      });
    }
  };

  const getPlanIcon = (planName: string) => {
    const Icon = PLAN_ICONS[planName] || CreditCard;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Plans & Tarification
          </h2>
          <p className="text-sm text-muted-foreground">
            Gérez les plans, prix et limites de chambres
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration des plans</CardTitle>
          <CardDescription>
            Modifiez les prix et limites de chaque plan. Les changements sont appliqués immédiatement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun plan trouvé dans la configuration.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Prix mensuel (HT)</TableHead>
                  <TableHead>Limite chambres</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(plan => {
                  const isEditing = editingPlan === plan.plan_name;
                  const displayName = PLAN_DISPLAY_NAMES[plan.plan_name] || plan.plan_name;
                  
                  return (
                    <TableRow key={plan.plan_name} className={!plan.is_active ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {getPlanIcon(plan.plan_name)}
                          </div>
                          <div>
                            <div className="font-medium">{displayName}</div>
                            <div className="text-xs text-muted-foreground">{plan.plan_name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editForm.price_monthly}
                              onChange={e => setEditForm(f => ({ ...f, price_monthly: e.target.value }))}
                              className="w-24 h-8"
                              min="0"
                              step="0.01"
                            />
                            <span className="text-sm text-muted-foreground">€</span>
                          </div>
                        ) : (
                          <span className="font-mono">
                            {plan.price_monthly === 0 ? (
                              <Badge variant="secondary">Gratuit</Badge>
                            ) : (
                              `${plan.price_monthly.toFixed(2)} €`
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editForm.max_rooms}
                              onChange={e => setEditForm(f => ({ ...f, max_rooms: e.target.value }))}
                              placeholder="∞"
                              className="w-24 h-8"
                              min="0"
                            />
                          </div>
                        ) : (
                          <span className="flex items-center gap-1">
                            {plan.max_rooms === null ? (
                              <Badge variant="outline" className="gap-1">
                                <Infinity className="h-3 w-3" />
                                Illimité
                              </Badge>
                            ) : (
                              `${plan.max_rooms} chambres`
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={plan.is_active}
                            onCheckedChange={checked => toggleActive(plan.plan_name, checked)}
                            aria-label={`Activer/désactiver ${displayName}`}
                          />
                          <Badge variant={plan.is_active ? "default" : "secondary"}>
                            {plan.is_active ? "Actif" : "Désactivé"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveEdit(plan.plan_name)}
                              disabled={saving}
                            >
                              {saving ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(plan)}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Modifier
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <CreditCard className="h-4 w-4 text-amber-700" />
            </div>
            <div className="text-sm text-amber-800">
              <p className="font-medium">Information importante</p>
              <p className="mt-1 text-amber-700">
                Les modifications de prix s'appliquent aux nouveaux abonnements. 
                Les plans désactivés ne peuvent plus être achetés (checkout bloqué côté serveur).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
