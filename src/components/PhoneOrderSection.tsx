import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Smartphone, Package, Plus, Minus, ShieldCheck, Truck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHotel } from "@/contexts/HotelContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import phoneImage from "@/assets/phone-product.png";

const UNIT_PRICE = 200;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "En attente de paiement", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmé", color: "bg-blue-100 text-blue-800" },
  preparing: { label: "En préparation", color: "bg-orange-100 text-orange-800" },
  shipped: { label: "Expédié", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Livré", color: "bg-green-100 text-green-800" },
};

const STATUS_STEPS = ["pending_payment", "confirmed", "preparing", "shipped", "delivered"];

export function PhoneOrderSection() {
  const { user } = useAuth();
  const { hotelId } = useHotel();
  const queryClient = useQueryClient();
  const [dailyHousekeepers, setDailyHousekeepers] = useState(1);
  const [shippingAddress, setShippingAddress] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);

  const phoneCount = dailyHousekeepers + 1; // +1 téléphone d'urgence
  const totalPrice = phoneCount * UNIT_PRICE;

  const { data: orders = [] } = useQuery({
    queryKey: ["phone-orders", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      const { data, error } = await supabase
        .from("phone_orders")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });

  // Mise à jour temps réel: refléter immédiatement les changements de statut faits par l'admin
  useEffect(() => {
    if (!hotelId) return;
    const channel = supabase
      .channel(`phone-orders-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "phone_orders", filter: `hotel_id=eq.${hotelId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["phone-orders", hotelId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotelId, queryClient]);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!hotelId || !user) throw new Error("Non authentifié");
      if (!shippingAddress.trim()) throw new Error("Adresse de livraison requise");

      const { error } = await supabase.from("phone_orders").insert({
        hotel_id: hotelId,
        user_id: user.id,
        daily_housekeepers: dailyHousekeepers,
        phone_count: phoneCount,
        unit_price: UNIT_PRICE,
        total_price: totalPrice,
        shipping_address: shippingAddress,
        status: "pending_payment",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-orders"] });
      toast.success("Commande enregistrée ! Elle sera facturée sur votre prochain abonnement.");
      setShowOrderForm(false);
      setShippingAddress("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      {/* Product card */}
      <Card className="overflow-hidden border-primary/20">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center p-8">
            <img
              src={phoneImage}
              alt="Téléphone dédié NettBloc avec coque renforcée"
              className="max-h-64 object-contain drop-shadow-xl"
              loading="lazy"
              width={512}
              height={768}
            />
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div>
              <Badge className="mb-2 bg-primary/10 text-primary border-primary/30">Service installation</Badge>
              <CardTitle className="text-2xl">Smartphone dédié NettBloc</CardTitle>
              <CardDescription className="mt-1">
                Téléphone Android avec coque rigide renforcée, application NettBloc pré-installée. 
                Prêt à l'emploi pour vos femmes de chambre.
              </CardDescription>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{UNIT_PRICE}€</span>
              <span className="text-muted-foreground">HT / téléphone</span>
            </div>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                Coque renforcée anti-choc
              </li>
              <li className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-green-500" />
                Application NettBloc pré-installée
              </li>
              <li className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-500" />
                Livraison par colis
              </li>
              <li className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-500" />
                Facturé une seule fois sur l'abonnement
              </li>
            </ul>

            <Separator />

            {!showOrderForm ? (
              <Button onClick={() => setShowOrderForm(true)} className="w-full" size="lg">
                <Smartphone className="h-4 w-4 mr-2" />
                Commander des téléphones
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Nombre de femmes de chambre actives par jour</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDailyHousekeepers(Math.max(1, dailyHousekeepers - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={dailyHousekeepers}
                      onChange={(e) => setDailyHousekeepers(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDailyHousekeepers(dailyHousekeepers + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Card className="bg-muted/50 p-4">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>{dailyHousekeepers} tél. femmes de chambre</span>
                      <span>{dailyHousekeepers * UNIT_PRICE}€</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        1 tél. d'urgence (recommandé)
                      </span>
                      <span>{UNIT_PRICE}€</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-lg">
                      <span>{phoneCount} téléphone(s)</span>
                      <span className="text-primary">{totalPrice}€ HT</span>
                    </div>
                  </div>
                </Card>

                <div>
                  <Label>Adresse de livraison</Label>
                  <Textarea
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Nom de l'établissement, adresse complète, code postal, ville..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowOrderForm(false)} className="flex-1">
                    Annuler
                  </Button>
                  <Button
                    onClick={() => createOrderMutation.mutate()}
                    disabled={createOrderMutation.isPending || !shippingAddress.trim()}
                    className="flex-1"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Commander ({totalPrice}€ HT)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Existing orders */}
      {orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mes commandes de téléphones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {orders.map((order: any) => {
              const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending_payment;
              const currentStep = STATUS_STEPS.indexOf(order.status);

              return (
                <Card key={order.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-semibold">{order.phone_count} téléphone(s)</span>
                      <span className="text-muted-foreground ml-2">
                        — {Number(order.total_price).toFixed(0)}€ HT
                      </span>
                      <div className="text-xs text-muted-foreground mt-1">
                        Commandé le {new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-1 mb-2">
                    {STATUS_STEPS.map((step, idx) => (
                      <div
                        key={step}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          idx <= currentStep ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Paiement</span>
                    <span>Confirmé</span>
                    <span>Préparation</span>
                    <span>Expédié</span>
                    <span>Livré</span>
                  </div>

                  {order.tracking_number && (
                    <div className="mt-3 text-sm">
                      <span className="text-muted-foreground">N° suivi : </span>
                      <span className="font-mono font-medium">{order.tracking_number}</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
