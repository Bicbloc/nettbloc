import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Eye,
  MapPin,
  Calendar,
  User,
  MessageSquare,
  Clock,
  Search,
} from "lucide-react";

interface LostAndFoundListProps {
  hotelId: string;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente", color: "bg-yellow-500" },
  { value: "in_progress", label: "En cours", color: "bg-blue-500" },
  { value: "guest_contacted", label: "Client contacté", color: "bg-purple-500" },
  { value: "guest_responded", label: "Client répondu", color: "bg-indigo-500" },
  { value: "not_found", label: "Personne non trouvée", color: "bg-gray-500" },
  { value: "recovered_postal_our_charge", label: "Envoi postal (notre charge)", color: "bg-green-500" },
  { value: "recovered_postal_client_charge", label: "Envoi postal (charge client)", color: "bg-green-600" },
  { value: "recovered_in_person", label: "Récupéré en personne", color: "bg-green-700" },
  { value: "closed", label: "Clôturé", color: "bg-gray-700" },
];

const LOCATION_LABELS: Record<string, string> = {
  room: "Chambre",
  corridor: "Couloir",
  lobby: "Lobby",
  restaurant: "Restaurant",
  pool: "Piscine",
  gym: "Salle de sport",
  parking: "Parking",
  other: "Autre",
};

export function LostAndFoundList({ hotelId }: LostAndFoundListProps) {
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestCheckIn, setGuestCheckIn] = useState("");
  const [guestCheckOut, setGuestCheckOut] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["lost-and-found", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lost_and_found")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("reported_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });

  const { data: history } = useQuery({
    queryKey: ["lost-and-found-history", selectedItem?.id],
    queryFn: async () => {
      if (!selectedItem?.id) return [];
      const { data, error } = await supabase
        .from("lost_and_found_history")
        .select("*")
        .eq("lost_item_id", selectedItem.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedItem?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: string }) => {
      const item = items?.find((i) => i.id === itemId);
      
      // Update status
      const { error: updateError } = await supabase
        .from("lost_and_found")
        .update({
          status: newStatus,
          admin_notes: adminNotes || item?.admin_notes,
          tracking_number: trackingNumber || item?.tracking_number,
          shipping_address: shippingAddress || item?.shipping_address,
          guest_first_name: guestFirstName || null,
          guest_name: guestName || null,
          guest_check_in: guestCheckIn || null,
          guest_check_out: guestCheckOut || null,
        })
        .eq("id", itemId);

      if (updateError) throw updateError;

      // Add history entry
      const { error: historyError } = await supabase
        .from("lost_and_found_history")
        .insert({
          lost_item_id: itemId,
          action: "status_change",
          old_status: item?.status,
          new_status: newStatus,
          notes: adminNotes,
          performed_by: "Admin",
          performed_by_type: "admin",
        });

      if (historyError) throw historyError;
    },
    onSuccess: (_, variables) => {
      // Log to activity journal
      const item = items?.find(i => i.id === variables.itemId);
      const statusLabel = STATUS_OPTIONS.find(s => s.value === variables.newStatus)?.label || variables.newStatus;
      supabase.from("daily_action_logs").insert({
        hotel_id: hotelId,
        action_type: "lost_item_status_change",
        description: `Objet trouvé "${item?.object_description || '?'}" → ${statusLabel}`,
        room_number: item?.room_number || null,
        actor_name: 'Admin',
        actor_type: 'admin',
      }).then(() => {});

      toast({
        title: "Statut mis à jour",
        description: "Le statut a été modifié avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["lost-and-found", hotelId] });
      queryClient.invalidateQueries({ queryKey: ["lost-and-found-history"] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    },
  });

  const filteredItems = items?.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.object_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.room_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.guest_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color} text-white`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un objet, chambre, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{items?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total objets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">
              {items?.filter((i) => i.status === "pending").length || 0}
            </div>
            <p className="text-sm text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500">
              {items?.filter((i) => i.status === "in_progress").length || 0}
            </div>
            <p className="text-sm text-muted-foreground">En cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {items?.filter((i) => i.status.startsWith("recovered")).length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Récupérés</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Objet</TableHead>
              <TableHead>Lieu</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucun objet trouvé enregistré
                </TableCell>
              </TableRow>
            ) : (
              filteredItems?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.object_description}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium line-clamp-1">
                          {item.object_description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Par {item.reported_by}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {LOCATION_LABELS[item.location_type]}
                      {item.room_number && ` - ${item.room_number}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.guest_name || item.guest_first_name ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.guest_first_name} {item.guest_name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(item.reported_at), "dd/MM/yyyy", { locale: fr })}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item);
                        setAdminNotes(item.admin_notes || "");
                        setTrackingNumber(item.tracking_number || "");
                        setShippingAddress(item.shipping_address || "");
                        setGuestFirstName(item.guest_first_name || "");
                        setGuestName(item.guest_name || "");
                        setGuestCheckIn(item.guest_check_in || "");
                        setGuestCheckOut(item.guest_check_out || "");
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Détails de l'objet trouvé
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6">
              {/* Image */}
              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.object_description}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}

              {/* Object Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{selectedItem.object_description}</p>
                </CardContent>
              </Card>

              {/* Location & Guest */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Lieu
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{LOCATION_LABELS[selectedItem.location_type]}</p>
                    {selectedItem.room_number && <p>Chambre: {selectedItem.room_number}</p>}
                    {selectedItem.location_details && (
                      <p className="text-sm text-muted-foreground">
                        {selectedItem.location_details}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedItem.guest_name || selectedItem.guest_first_name ? (
                      <>
                        <p>
                          {selectedItem.guest_first_name} {selectedItem.guest_name}
                        </p>
                        {selectedItem.guest_check_in && (
                          <p className="text-sm text-muted-foreground">
                            Séjour: {format(new Date(selectedItem.guest_check_in), "dd/MM/yyyy")}
                            {selectedItem.guest_check_out &&
                              ` - ${format(new Date(selectedItem.guest_check_out), "dd/MM/yyyy")}`}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">Aucune information</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Status Update */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mise à jour du suivi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Statut</label>
                    <Select
                      value={selectedItem.status}
                      onValueChange={(value) =>
                        updateStatusMutation.mutate({
                          itemId: selectedItem.id,
                          newStatus: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes administrateur</label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Notes de suivi..."
                    />
                  </div>

                  {selectedItem.status.includes("postal") && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Numéro de suivi</label>
                        <Input
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          placeholder="Ex: 1Z999AA10123456784"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Adresse d'envoi</label>
                        <Textarea
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Adresse complète..."
                        />
                      </div>
                    </>
                  )}

                  <Button
                    onClick={() =>
                      updateStatusMutation.mutate({
                        itemId: selectedItem.id,
                        newStatus: selectedItem.status,
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                    className="w-full"
                  >
                    Enregistrer les modifications
                  </Button>
                </CardContent>
              </Card>

              {/* History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Historique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {history?.length === 0 ? (
                    <p className="text-muted-foreground">Aucun historique</p>
                  ) : (
                    <div className="space-y-3">
                      {history?.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                        >
                          <MessageSquare className="h-4 w-4 mt-1" />
                          <div className="flex-1">
                            <p className="text-sm">
                              <strong>{entry.performed_by}</strong> a changé le statut de{" "}
                              <em>{STATUS_OPTIONS.find((s) => s.value === entry.old_status)?.label}</em> à{" "}
                              <em>{STATUS_OPTIONS.find((s) => s.value === entry.new_status)?.label}</em>
                            </p>
                            {entry.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
