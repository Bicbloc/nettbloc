import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Save, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Eye, 
  ClipboardList,
  Calendar,
  User,
  AlertCircle,
  Check
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface AdminLinenInventoryProps {
  hotelId: string;
}

export const AdminLinenInventory = ({ hotelId }: AdminLinenInventoryProps) => {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'validate'>('view');
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [validationNotes, setValidationNotes] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTaskDate, setNewTaskDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newTaskNotes, setNewTaskNotes] = useState("");

  // Récupérer les types de linge
  const { data: linenTypes = [] } = useQuery({
    queryKey: ["linen-types", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_types")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Récupérer toutes les tâches d'inventaire
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["admin-linen-tasks", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_inventory_tasks")
        .select(`
          *,
          linen_inventory_entries(*)
        `)
        .eq("hotel_id", hotelId)
        .order("task_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Récupérer les femmes de chambre
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

  // Mutation pour créer une tâche admin (saisie directe)
  const createAdminTaskMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Créer une tâche assignée à l'admin lui-même
      const { data: task, error } = await supabase
        .from("linen_inventory_tasks")
        .insert({
          hotel_id: hotelId,
          assigned_to: user.id,
          assigned_by: user.id,
          task_date: newTaskDate,
          status: "in_progress",
          notes: newTaskNotes || "Saisie directe par l'admin",
        })
        .select()
        .single();

      if (error) throw error;
      return task;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["admin-linen-tasks"] });
      toast.success("Tâche créée - Vous pouvez maintenant saisir les quantités");
      setShowCreateDialog(false);
      setNewTaskNotes("");
      // Ouvrir directement en mode édition
      setSelectedTask(task);
      setViewMode('edit');
      setEntries({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  // Mutation pour sauvegarder les entrées
  const saveEntriesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask) throw new Error("Aucune tâche sélectionnée");

      // Supprimer les anciennes entrées
      await supabase
        .from("linen_inventory_entries")
        .delete()
        .eq("task_id", selectedTask.id);

      // Insérer les nouvelles entrées
      const entriesToSave = Object.entries(entries)
        .filter(([_, values]: [string, any]) => 
          values.clean > 0 || values.dirty > 0 || values.damaged > 0
        )
        .map(([linenTypeId, values]: [string, any]) => ({
          task_id: selectedTask.id,
          linen_type_id: linenTypeId,
          quantity_clean: parseInt(values.clean) || 0,
          quantity_dirty: parseInt(values.dirty) || 0,
          quantity_damaged: parseInt(values.damaged) || 0,
          count_method: "admin_manual",
          counted_at: new Date().toISOString(),
        }));

      if (entriesToSave.length > 0) {
        const { error } = await supabase
          .from("linen_inventory_entries")
          .insert(entriesToSave);
        if (error) throw error;
      }

      // Mettre à jour le statut de la tâche
      await supabase
        .from("linen_inventory_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", selectedTask.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-linen-tasks"] });
      toast.success("Inventaire enregistré avec succès");
      setSelectedTask(null);
      setViewMode('view');
      setEntries({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  // Mutation pour valider une tâche
  const validateTaskMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      if (!selectedTask) throw new Error("Aucune tâche sélectionnée");

      await supabase
        .from("linen_inventory_tasks")
        .update({
          status: approved ? "validated" : "rejected",
          notes: validationNotes 
            ? `${selectedTask.notes || ''}\n[Admin] ${validationNotes}`
            : selectedTask.notes,
        })
        .eq("id", selectedTask.id);
    },
    onSuccess: (_, approved) => {
      queryClient.invalidateQueries({ queryKey: ["admin-linen-tasks"] });
      toast.success(approved ? "Inventaire validé" : "Inventaire rejeté");
      setSelectedTask(null);
      setViewMode('view');
      setValidationNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la validation");
    },
  });

  const openTask = (task: any, mode: 'view' | 'edit' | 'validate') => {
    setSelectedTask(task);
    setViewMode(mode);
    
    // Charger les entrées existantes
    const entriesMap: Record<string, any> = {};
    task.linen_inventory_entries?.forEach((entry: any) => {
      entriesMap[entry.linen_type_id] = {
        clean: entry.quantity_clean || 0,
        dirty: entry.quantity_dirty || 0,
        damaged: entry.quantity_damaged || 0,
      };
    });
    setEntries(entriesMap);
    setValidationNotes("");
  };

  const updateEntry = (linenTypeId: string, field: string, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [linenTypeId]: {
        ...prev[linenTypeId],
        [field]: parseInt(value) || 0,
      },
    }));
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string; icon: any }> = {
      pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente", icon: AlertCircle },
      in_progress: { className: "bg-blue-100 text-blue-800", label: "En cours", icon: Edit },
      completed: { className: "bg-green-100 text-green-800", label: "Terminé", icon: CheckCircle },
      validated: { className: "bg-emerald-100 text-emerald-800", label: "Validé", icon: Check },
      rejected: { className: "bg-red-100 text-red-800", label: "Rejeté", icon: XCircle },
    };
    const { className, label, icon: Icon } = config[status] || config.pending;
    return (
      <Badge className={`${className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getHousekeeperName = (id: string) => {
    const hk = housekeepers.find((h: any) => h.id === id);
    return hk?.name || "Admin";
  };

  const getTotalForTask = (task: any) => {
    return task.linen_inventory_entries?.reduce((total: number, entry: any) => {
      return total + (entry.quantity_clean || 0) + (entry.quantity_dirty || 0) + (entry.quantity_damaged || 0);
    }, 0) || 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Gestion Inventaire Linge (Admin)
          </h3>
          <p className="text-sm text-muted-foreground">
            Saisissez, visualisez et validez les comptages de linge
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Saisie directe
        </Button>
      </div>

      {/* Liste des tâches */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">
            Chargement...
          </Card>
        ) : tasks.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Aucun inventaire trouvé
          </Card>
        ) : (
          tasks.map((task: any) => (
            <Card key={task.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(new Date(task.task_date), "d MMMM yyyy", { locale: fr })}
                    </span>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{getHousekeeperName(task.assigned_to)}</span>
                    <span>•</span>
                    <span>{getTotalForTask(task)} pièces comptées</span>
                  </div>
                  {task.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">
                      {task.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTask(task, 'view')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Voir
                  </Button>
                  {task.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTask(task, 'validate')}
                      className="border-green-300 text-green-700 hover:bg-green-50"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Valider
                    </Button>
                  )}
                  {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'rejected') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTask(task, 'edit')}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Compléter
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Dialog création saisie directe */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle saisie d'inventaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date de l'inventaire</Label>
              <Input
                type="date"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
                placeholder="Notes sur cet inventaire..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={() => createAdminTaskMutation.mutate()}>
              Créer et saisir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog vue/édition/validation */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewMode === 'view' && <Eye className="h-5 w-5" />}
              {viewMode === 'edit' && <Edit className="h-5 w-5" />}
              {viewMode === 'validate' && <CheckCircle className="h-5 w-5" />}
              {viewMode === 'view' ? 'Détails de l\'inventaire' :
               viewMode === 'edit' ? 'Saisie de l\'inventaire' :
               'Validation de l\'inventaire'}
            </DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              {/* Info tâche */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">
                    {format(new Date(selectedTask.task_date), "d MMMM yyyy", { locale: fr })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Par: {getHousekeeperName(selectedTask.assigned_to)}
                  </div>
                </div>
                {getStatusBadge(selectedTask.status)}
              </div>

              {/* Liste des types de linge */}
              <div className="space-y-3">
                {linenTypes.map((type: any) => {
                  const entry = entries[type.id] || { clean: 0, dirty: 0, damaged: 0 };
                  const total = (entry.clean || 0) + (entry.dirty || 0) + (entry.damaged || 0);
                  const isEditable = viewMode === 'edit';

                  return (
                    <Card key={type.id} className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{type.icon || '📦'}</span>
                        <div className="flex-1">
                          <div className="font-medium">{type.name}</div>
                          {type.dimensions && (
                            <div className="text-sm text-muted-foreground">{type.dimensions}</div>
                          )}
                        </div>
                        {total > 0 && (
                          <Badge variant="secondary" className="text-lg px-3">
                            {total}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs text-green-700">Propre</Label>
                          {isEditable ? (
                            <Input
                              type="number"
                              min="0"
                              value={entry.clean || ""}
                              onChange={(e) => updateEntry(type.id, "clean", e.target.value)}
                              placeholder="0"
                              className="border-green-200 focus:border-green-400"
                            />
                          ) : (
                            <div className="p-2 bg-green-50 rounded text-center font-medium text-green-700">
                              {entry.clean || 0}
                            </div>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-orange-700">Sale</Label>
                          {isEditable ? (
                            <Input
                              type="number"
                              min="0"
                              value={entry.dirty || ""}
                              onChange={(e) => updateEntry(type.id, "dirty", e.target.value)}
                              placeholder="0"
                              className="border-orange-200 focus:border-orange-400"
                            />
                          ) : (
                            <div className="p-2 bg-orange-50 rounded text-center font-medium text-orange-700">
                              {entry.dirty || 0}
                            </div>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-red-700">Abîmé</Label>
                          {isEditable ? (
                            <Input
                              type="number"
                              min="0"
                              value={entry.damaged || ""}
                              onChange={(e) => updateEntry(type.id, "damaged", e.target.value)}
                              placeholder="0"
                              className="border-red-200 focus:border-red-400"
                            />
                          ) : (
                            <div className="p-2 bg-red-50 rounded text-center font-medium text-red-700">
                              {entry.damaged || 0}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Zone de validation */}
              {viewMode === 'validate' && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                  <Label>Notes de validation (optionnel)</Label>
                  <Textarea
                    value={validationNotes}
                    onChange={(e) => setValidationNotes(e.target.value)}
                    placeholder="Commentaires sur cet inventaire..."
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedTask(null)}>
              Fermer
            </Button>
            
            {viewMode === 'edit' && (
              <Button 
                onClick={() => saveEntriesMutation.mutate()}
                disabled={saveEntriesMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveEntriesMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            )}
            
            {viewMode === 'validate' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => validateTaskMutation.mutate(false)}
                  disabled={validateTaskMutation.isPending}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeter
                </Button>
                <Button
                  onClick={() => validateTaskMutation.mutate(true)}
                  disabled={validateTaskMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Valider
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
