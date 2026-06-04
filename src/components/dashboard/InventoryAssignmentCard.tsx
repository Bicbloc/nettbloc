/**
 * Carte d'attribution de l'inventaire du linge pour la journée
 * Affichée sur la page Affectation : montre à qui l'inventaire est attribué
 * ou permet de l'attribuer si personne n'est assigné.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, UserCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface InventoryAssignmentCardProps {
  hotelId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  completed: "À valider",
  validated: "Validé ✓",
  rejected: "Rejeté",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  validated: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export function InventoryAssignmentCard({ hotelId }: InventoryAssignmentCardProps) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>("");

  // Femmes de chambre locales + profils liés à l'hôtel
  const { data: housekeepers = [] } = useQuery({
    queryKey: ["inventory-housekeepers", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housekeepers")
        .select("id, name")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: housekeeperProfiles = [] } = useQuery({
    queryKey: ["inventory-housekeeper-profiles", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housekeeper_hotel_history")
        .select("housekeeper_profiles(id, name)")
        .eq("hotel_id", hotelId)
        .is("ended_at", null);
      if (error) throw error;
      return (data || [])
        .filter((h: any) => h.housekeeper_profiles)
        .map((h: any) => h.housekeeper_profiles);
    },
  });

  const allHousekeepers = [
    ...housekeepers.map((h: any) => ({ id: h.id, name: h.name })),
    ...housekeeperProfiles.map((h: any) => ({ id: h.id, name: h.name })),
  ].filter((h, i, arr) => arr.findIndex((x) => x.id === h.id) === i);

  // Tâche d'inventaire du jour
  const { data: tasks = [] } = useQuery({
    queryKey: ["inventory-tasks-today", hotelId, today],
    enabled: !!hotelId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_inventory_tasks")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("task_date", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHousekeeper) throw new Error("Sélectionnez une femme de chambre");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié - veuillez vous reconnecter");

      const { error } = await supabase.from("linen_inventory_tasks").insert({
        hotel_id: hotelId,
        assigned_to: selectedHousekeeper,
        assigned_by: user.id,
        task_date: today,
        status: "pending",
      });
      if (error) throw new Error(error.message || "Erreur lors de l'attribution");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-tasks-today"] });
      queryClient.invalidateQueries({ queryKey: ["linen-tasks"] });
      toast.success("Inventaire attribué avec succès");
      setSelectedHousekeeper("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Impossible d'attribuer l'inventaire");
    },
  });

  if (!hotelId) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Inventaire du linge</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Attribution du comptage pour aujourd'hui
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length > 0 ? (
          <div className="space-y-2">
            {tasks.map((task: any) => {
              const hk = allHousekeepers.find((h) => h.id === task.assigned_to);
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span className="font-medium">{hk?.name || "Femme de chambre"}</span>
                  </div>
                  <Badge
                    className={`${STATUS_STYLES[task.status] || STATUS_STYLES.pending}`}
                  >
                    {STATUS_LABELS[task.status] || task.status}
                  </Badge>
                </div>
              );
            })}
            <div className="flex items-end gap-2 pt-2">
              <div className="flex-1">
                <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
                  <SelectTrigger>
                    <SelectValue placeholder="Attribuer à une autre personne..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allHousekeepers.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={!selectedHousekeeper || assignMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucun inventaire attribué pour aujourd'hui. Attribuez la tâche à une femme de chambre.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une femme de chambre..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allHousekeepers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Aucune femme de chambre disponible
                      </div>
                    ) : (
                      allHousekeepers.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={!selectedHousekeeper || assignMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Attribuer
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
