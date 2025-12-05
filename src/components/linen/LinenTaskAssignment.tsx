import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LinenTaskAssignmentProps {
  hotelId: string;
}

export const LinenTaskAssignment = ({ hotelId }: LinenTaskAssignmentProps) => {
  const queryClient = useQueryClient();
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>("");
  const [taskDate, setTaskDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  const { data: housekeepers = [] } = useQuery({
    queryKey: ["housekeepers", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housekeepers")
        .select("id, name")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: housekeeperProfiles = [] } = useQuery({
    queryKey: ["housekeeper-profiles-for-tasks", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housekeeper_hotel_history")
        .select("housekeeper_profile_id, housekeeper_profiles(id, name, email)")
        .eq("hotel_id", hotelId)
        .eq("ended_at", null);
      if (error) throw error;
      return data
        .filter((h: any) => h.housekeeper_profiles)
        .map((h: any) => h.housekeeper_profiles);
    },
  });

  const allHousekeepers = [
    ...housekeepers.map((h: any) => ({ id: h.id, name: h.name, source: "local" })),
    ...housekeeperProfiles.map((h: any) => ({ id: h.id, name: h.name, source: "profile" })),
  ];

  const { data: tasks = [] } = useQuery({
    queryKey: ["linen-tasks", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_inventory_tasks")
        .select(`
          *,
          linen_inventory_entries(count)
        `)
        .eq("hotel_id", hotelId)
        .order("task_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHousekeeper) {
        throw new Error("Sélectionnez une femme de chambre");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié - veuillez vous reconnecter");

      console.log('🔄 Création tâche inventaire:', {
        hotelId,
        assignedTo: selectedHousekeeper,
        assignedBy: user.id,
        taskDate
      });

      const { data, error } = await supabase.from("linen_inventory_tasks").insert({
        hotel_id: hotelId,
        assigned_to: selectedHousekeeper,
        assigned_by: user.id,
        task_date: taskDate,
        status: "pending",
        notes: notes || null,
      }).select();

      if (error) {
        console.error('❌ Erreur insertion tâche:', error);
        // Message d'erreur plus explicite selon le type
        if (error.code === '42501') {
          throw new Error("Vous n'avez pas les permissions pour créer cette tâche");
        } else if (error.code === '23503') {
          throw new Error("La femme de chambre sélectionnée n'existe plus");
        } else {
          throw new Error(error.message || "Erreur lors de la création");
        }
      }

      console.log('✅ Tâche créée:', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linen-tasks"] });
      toast.success("Tâche d'inventaire créée avec succès");
      setSelectedHousekeeper("");
      setNotes("");
    },
    onError: (error: any) => {
      console.error('❌ Erreur création tâche:', error);
      toast.error(error.message || "Impossible de créer la tâche");
    },
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
    };
    const labels = {
      pending: "En attente",
      in_progress: "En cours",
      completed: "Terminé",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Attribution de tâches d'inventaire</h3>
        <p className="text-sm text-muted-foreground">
          Créez des tâches de comptage de linge pour les femmes de chambre
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Femme de chambre</Label>
            <Select value={selectedHousekeeper} onValueChange={setSelectedHousekeeper}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {allHousekeepers.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Instructions (optionnel)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instructions spéciales pour l'inventaire..."
          />
        </div>

        <Button onClick={() => createTaskMutation.mutate()}>
          <Plus className="h-4 w-4 mr-2" />
          Créer la tâche
        </Button>
      </Card>

      <div>
        <h4 className="font-semibold mb-3">Tâches récentes</h4>
        <div className="space-y-2">
          {tasks.map((task: any) => {
            const housekeeper = allHousekeepers.find((h) => h.id === task.assigned_to);
            const entriesCount = task.linen_inventory_entries?.length || 0;
            
            return (
              <Card key={task.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{housekeeper?.name || "N/A"}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.task_date), "d MMMM yyyy", { locale: fr })}
                    </div>
                    {task.notes && (
                      <div className="text-sm text-muted-foreground mt-1">{task.notes}</div>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    {getStatusBadge(task.status)}
                    <div className="text-sm text-muted-foreground">
                      {entriesCount} types comptés
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};