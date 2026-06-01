import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/services/notificationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Smartphone, Package, Truck } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "pending_payment", label: "En attente de paiement" },
  { value: "confirmed", label: "Confirmé" },
  { value: "preparing", label: "En préparation" },
  { value: "shipped", label: "Expédié" },
  { value: "delivered", label: "Livré" },
];

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
};

export function PhoneOrdersPanel() {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-phone-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_orders")
        .select("*, hotels(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, hotelId, status, tracking_number }: { id: string; hotelId?: string; status?: string; tracking_number?: string }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (status) updates.status = status;
      if (tracking_number !== undefined) updates.tracking_number = tracking_number;

      const { error } = await supabase.from("phone_orders").update(updates).eq("id", id);
      if (error) throw error;

      // Notifier l'établissement du changement de statut
      if (hotelId && status) {
        const label = STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
        await createNotification({
          hotelId,
          title: "📦 Commande de téléphones mise à jour",
          description: `Votre commande est maintenant : ${label}.`,
          type: "phone_order",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-phone-orders"] });
      toast.success("Commande mise à jour");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o: any) => o.status === "pending_payment").length,
    inProgress: orders.filter((o: any) => ["confirmed", "preparing", "shipped"].includes(o.status)).length,
    delivered: orders.filter((o: any) => o.status === "delivered").length,
    totalRevenue: orders.reduce((sum: number, o: any) => sum + Number(o.total_price), 0),
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Commandes totales</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">En attente</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          <div className="text-xs text-muted-foreground">En cours</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">{stats.totalRevenue.toFixed(0)}€</div>
          <div className="text-xs text-muted-foreground">CA total</div>
        </Card>
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Commandes de téléphones ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-2 opacity-30" />
              Aucune commande de téléphone
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hôtel</TableHead>
                  <TableHead>Téléphones</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>N° suivi</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onUpdate={(data) => updateMutation.mutate({ id: order.id, hotelId: order.hotel_id, ...data })}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderRow({ order, onUpdate }: { order: any; onUpdate: (data: any) => void }) {
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");
  const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.pending_payment;

  return (
    <TableRow>
      <TableCell className="font-medium">{order.hotels?.name || "—"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          {order.phone_count}
          <span className="text-xs text-muted-foreground">({order.daily_housekeepers} FdC + 1 urgence)</span>
        </div>
      </TableCell>
      <TableCell className="font-semibold">{Number(order.total_price).toFixed(0)}€</TableCell>
      <TableCell className="max-w-[200px] truncate text-xs">{order.shipping_address || "—"}</TableCell>
      <TableCell>
        <Select value={order.status} onValueChange={(value) => onUpdate({ status: value })}>
          <SelectTrigger className="w-[180px] h-8">
            <Badge className={statusColor + " text-xs"}>
              {STATUS_OPTIONS.find((s) => s.value === order.status)?.label}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="N° suivi"
            className="h-8 w-32 text-xs"
          />
          {trackingNumber !== (order.tracking_number || "") && (
            <Button size="sm" variant="ghost" onClick={() => onUpdate({ tracking_number: trackingNumber })}>
              <Truck className="h-3 w-3" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(order.created_at).toLocaleDateString("fr-FR")}
      </TableCell>
    </TableRow>
  );
}
