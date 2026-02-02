import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Truck,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Eye,
  ArrowLeft,
  Save,
  X,
  Package,
  ClipboardCheck,
  Trash2,
  Edit,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LinenDeliveryManagerProps {
  hotelId: string;
}

interface LinenType {
  id: string;
  name: string;
  icon: string;
  category: string;
}

interface DeliveryItem {
  id?: string;
  linen_type_id: string;
  quantity_delivered: number;
  quantity_counted: number | null;
  difference?: number;
  notes: string;
}

export const LinenDeliveryManager = ({ hotelId }: LinenDeliveryManagerProps) => {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail" | "reconcile">("list");
  
  // Form state
  const [formData, setFormData] = useState({
    delivery_date: format(new Date(), "yyyy-MM-dd"),
    supplier_name: "",
    delivery_reference: "",
    notes: "",
  });
  const [items, setItems] = useState<DeliveryItem[]>([]);

  // Fetch linen types
  const { data: linenTypes = [] } = useQuery({
    queryKey: ["linen-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_types")
        .select("id, name, icon, category")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as LinenType[];
    },
  });

  // Fetch deliveries
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["linen-deliveries", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_deliveries")
        .select(`
          *,
          linen_delivery_items(
            id,
            linen_type_id,
            quantity_delivered,
            quantity_counted,
            difference,
            notes,
            counted_at
          )
        `)
        .eq("hotel_id", hotelId)
        .order("delivery_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create delivery mutation
  const createDeliveryMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Non authentifié");

      // Create delivery
      const { data: delivery, error: deliveryError } = await supabase
        .from("linen_deliveries")
        .insert({
          hotel_id: hotelId,
          delivery_date: formData.delivery_date,
          supplier_name: formData.supplier_name || null,
          delivery_reference: formData.delivery_reference || null,
          notes: formData.notes || null,
          created_by: user.user.id,
          status: "pending",
        })
        .select()
        .single();

      if (deliveryError) throw deliveryError;

      // Create items
      const itemsToInsert = items
        .filter((item) => item.quantity_delivered > 0)
        .map((item) => ({
          delivery_id: delivery.id,
          linen_type_id: item.linen_type_id,
          quantity_delivered: item.quantity_delivered,
          notes: item.notes || null,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("linen_delivery_items")
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      return delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-deliveries"] });
      toast.success("Livraison enregistrée");
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  // Update item counts (reconciliation)
  const updateCountsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDelivery) throw new Error("Aucune livraison sélectionnée");

      // Update each item with counted quantity
      for (const item of items) {
        if (item.id && item.quantity_counted !== null) {
          await supabase
            .from("linen_delivery_items")
            .update({
              quantity_counted: item.quantity_counted,
              counted_at: new Date().toISOString(),
              notes: item.notes || null,
            })
            .eq("id", item.id);
        }
      }

      // Update delivery status
      await supabase
        .from("linen_deliveries")
        .update({ status: "reconciled" })
        .eq("id", selectedDelivery.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-deliveries"] });
      toast.success("Rapprochement effectué");
      setViewMode("list");
      setSelectedDelivery(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors du rapprochement");
    },
  });

  // Delete delivery
  const deleteDeliveryMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase
        .from("linen_deliveries")
        .delete()
        .eq("id", deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-deliveries"] });
      toast.success("Livraison supprimée");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const resetForm = () => {
    setFormData({
      delivery_date: format(new Date(), "yyyy-MM-dd"),
      supplier_name: "",
      delivery_reference: "",
      notes: "",
    });
    setItems([]);
  };

  const initializeItems = () => {
    setItems(
      linenTypes.map((type) => ({
        linen_type_id: type.id,
        quantity_delivered: 0,
        quantity_counted: null,
        notes: "",
      }))
    );
  };

  const openCreateDialog = () => {
    resetForm();
    initializeItems();
    setShowCreateDialog(true);
  };

  const openDeliveryDetail = (delivery: any) => {
    setSelectedDelivery(delivery);
    setViewMode("detail");
  };

  const openReconciliation = (delivery: any) => {
    setSelectedDelivery(delivery);
    setItems(
      delivery.linen_delivery_items.map((item: any) => ({
        id: item.id,
        linen_type_id: item.linen_type_id,
        quantity_delivered: item.quantity_delivered,
        quantity_counted: item.quantity_counted,
        notes: item.notes || "",
      }))
    );
    setViewMode("reconcile");
  };

  const updateItemQuantity = (linenTypeId: string, field: "quantity_delivered" | "quantity_counted", value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.linen_type_id === linenTypeId
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const getLinenTypeName = (id: string) => {
    const type = linenTypes.find((t) => t.id === id);
    return type ? `${type.icon} ${type.name}` : "Inconnu";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string; icon: any }> = {
      pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente", icon: AlertTriangle },
      validated: { className: "bg-blue-100 text-blue-800", label: "Validé", icon: CheckCircle },
      reconciled: { className: "bg-green-100 text-green-800", label: "Rapproché", icon: ClipboardCheck },
    };
    const { className, label, icon: Icon } = config[status] || config.pending;
    return (
      <Badge className={`${className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getTotalDelivered = (delivery: any) => {
    return delivery.linen_delivery_items?.reduce(
      (sum: number, item: any) => sum + (item.quantity_delivered || 0),
      0
    ) || 0;
  };

  const getTotalDifference = (delivery: any) => {
    return delivery.linen_delivery_items?.reduce(
      (sum: number, item: any) => sum + (item.difference || 0),
      0
    ) || 0;
  };

  // List view
  if (viewMode === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Livraisons de linge
            </h3>
            <p className="text-sm text-muted-foreground">
              Enregistrer les livraisons et effectuer le rapprochement
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle livraison
          </Button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">
              Chargement...
            </Card>
          ) : deliveries.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Aucune livraison enregistrée
            </Card>
          ) : (
            deliveries.map((delivery: any) => (
              <Card key={delivery.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <span className="font-semibold">
                        {format(new Date(delivery.delivery_date), "EEEE d MMMM yyyy", { locale: fr })}
                      </span>
                      {getStatusBadge(delivery.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground ml-8">
                      {delivery.supplier_name && (
                        <span>🏭 {delivery.supplier_name}</span>
                      )}
                      {delivery.delivery_reference && (
                        <span>📋 Réf: {delivery.delivery_reference}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {getTotalDelivered(delivery)} pièces livrées
                      </span>
                      {delivery.status === "reconciled" && (
                        <span
                          className={`flex items-center gap-1 ${
                            getTotalDifference(delivery) === 0
                              ? "text-green-600"
                              : getTotalDifference(delivery) > 0
                              ? "text-blue-600"
                              : "text-red-600"
                          }`}
                        >
                          {getTotalDifference(delivery) > 0 ? "+" : ""}
                          {getTotalDifference(delivery)} écart
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeliveryDetail(delivery)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Détail
                    </Button>
                    {delivery.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => openReconciliation(delivery)}
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Rapprocher
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Supprimer cette livraison ?")) {
                          deleteDeliveryMutation.mutate(delivery.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Nouvelle livraison de linge
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date de livraison *</Label>
                  <Input
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Fournisseur</Label>
                  <Input
                    value={formData.supplier_name}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier_name: e.target.value })
                    }
                    placeholder="Nom du fournisseur"
                  />
                </div>
                <div>
                  <Label>Référence bon de livraison</Label>
                  <Input
                    value={formData.delivery_reference}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_reference: e.target.value })
                    }
                    placeholder="Ex: BL-2024-001"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Notes optionnelles"
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">Quantités livrées par type</Label>
                <div className="mt-2 space-y-2">
                  {items.map((item) => {
                    const type = linenTypes.find((t) => t.id === item.linen_type_id);
                    if (!type) return null;
                    return (
                      <div
                        key={item.linen_type_id}
                        className="flex items-center gap-4 p-2 rounded bg-muted/50"
                      >
                        <span className="text-xl">{type.icon}</span>
                        <span className="flex-1 font-medium">{type.name}</span>
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={item.quantity_delivered || ""}
                          onChange={(e) =>
                            updateItemQuantity(
                              item.linen_type_id,
                              "quantity_delivered",
                              parseInt(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                        />
                        <span className="text-sm text-muted-foreground">pièces</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => createDeliveryMutation.mutate()}
                disabled={createDeliveryMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer la livraison
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Detail view
  if (viewMode === "detail" && selectedDelivery) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              📅 Livraison du{" "}
              {format(new Date(selectedDelivery.delivery_date), "d MMMM yyyy", { locale: fr })}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {selectedDelivery.supplier_name && (
                <span>🏭 {selectedDelivery.supplier_name}</span>
              )}
              {selectedDelivery.delivery_reference && (
                <span>• Réf: {selectedDelivery.delivery_reference}</span>
              )}
              {getStatusBadge(selectedDelivery.status)}
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type de linge</TableHead>
                <TableHead className="text-center">Livré</TableHead>
                <TableHead className="text-center">Compté</TableHead>
                <TableHead className="text-center">Écart</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedDelivery.linen_delivery_items?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {getLinenTypeName(item.linen_type_id)}
                  </TableCell>
                  <TableCell className="text-center">{item.quantity_delivered}</TableCell>
                  <TableCell className="text-center">
                    {item.quantity_counted !== null ? item.quantity_counted : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.difference !== null ? (
                      <span
                        className={
                          item.difference === 0
                            ? "text-green-600"
                            : item.difference > 0
                            ? "text-blue-600"
                            : "text-red-600 font-semibold"
                        }
                      >
                        {item.difference > 0 ? "+" : ""}
                        {item.difference}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {selectedDelivery.status === "pending" && (
          <div className="flex justify-end">
            <Button onClick={() => openReconciliation(selectedDelivery)}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Effectuer le rapprochement
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Reconciliation view
  if (viewMode === "reconcile" && selectedDelivery) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Rapprochement - Livraison du{" "}
              {format(new Date(selectedDelivery.delivery_date), "d MMMM yyyy", { locale: fr })}
            </h3>
            <p className="text-sm text-muted-foreground">
              Saisissez les quantités réellement comptées pour chaque type de linge
            </p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type de linge</TableHead>
                <TableHead className="text-center">Livré (bon)</TableHead>
                <TableHead className="text-center">Compté (réel)</TableHead>
                <TableHead className="text-center">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const diff =
                  item.quantity_counted !== null
                    ? item.quantity_counted - item.quantity_delivered
                    : null;
                return (
                  <TableRow key={item.linen_type_id}>
                    <TableCell className="font-medium">
                      {getLinenTypeName(item.linen_type_id)}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {item.quantity_delivered}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        className="w-24 mx-auto"
                        value={item.quantity_counted ?? ""}
                        onChange={(e) =>
                          updateItemQuantity(
                            item.linen_type_id,
                            "quantity_counted",
                            parseInt(e.target.value) || 0
                          )
                        }
                        placeholder={String(item.quantity_delivered)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {diff !== null ? (
                        <Badge
                          className={
                            diff === 0
                              ? "bg-green-100 text-green-800"
                              : diff > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {diff > 0 ? "+" : ""}
                          {diff}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setViewMode("list")}>
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
          <Button
            onClick={() => updateCountsMutation.mutate()}
            disabled={updateCountsMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Valider le rapprochement
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
