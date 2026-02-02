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
  Save, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Eye, 
  ClipboardList,
  Calendar,
  User,
  AlertCircle,
  Check,
  ArrowLeft,
  Download,
  Camera,
  Image as ImageIcon
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
import { LinenImageViewer } from "./LinenImageViewer";
import { LinenDailyReport } from "./LinenDailyReport";

interface AdminLinenInventoryProps {
  hotelId: string;
  hotelName?: string;
}

interface DailyInventorySummary {
  date: string;
  tasks: any[];
  totalPieces: number;
  entriesWithPhotos: number;
  overallStatus: string;
}

export const AdminLinenInventory = ({ hotelId, hotelName }: AdminLinenInventoryProps) => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'validate'>('view');
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [validationNotes, setValidationNotes] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTaskDate, setNewTaskDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);

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

  // Récupérer toutes les tâches d'inventaire avec les photos
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["admin-linen-tasks", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linen_inventory_tasks")
        .select(`
          *,
          linen_inventory_entries(
            id,
            linen_type_id,
            quantity_clean,
            quantity_dirty,
            quantity_damaged,
            ai_confidence,
            photo_url,
            counted_at,
            count_method
          )
        `)
        .eq("hotel_id", hotelId)
        .order("task_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
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

  // Regrouper les tâches par date
  const tasksByDate: DailyInventorySummary[] = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    tasks.forEach((task: any) => {
      const date = task.task_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(task);
    });

    return Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, dateTasks]) => {
        const allEntries = dateTasks.flatMap((t: any) => t.linen_inventory_entries || []);
        const totalPieces = allEntries.reduce(
          (sum: number, e: any) =>
            sum + (e.quantity_clean || 0) + (e.quantity_dirty || 0) + (e.quantity_damaged || 0),
          0
        );
        const entriesWithPhotos = allEntries.filter((e: any) => e.photo_url).length;

        // Déterminer le statut global
        const statuses = dateTasks.map((t: any) => t.status);
        let overallStatus = 'pending';
        if (statuses.every((s: string) => s === 'validated')) overallStatus = 'validated';
        else if (statuses.some((s: string) => s === 'completed')) overallStatus = 'completed';
        else if (statuses.some((s: string) => s === 'in_progress')) overallStatus = 'in_progress';

        return { date, tasks: dateTasks, totalPieces, entriesWithPhotos, overallStatus };
      });
  }, [tasks]);

  // Tâches pour la date sélectionnée
  const selectedDateData = useMemo(() => {
    return tasksByDate.find((d) => d.date === selectedDate);
  }, [tasksByDate, selectedDate]);

  // Mutations
  const createAdminTaskMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

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
      setSelectedTask(task);
      setViewMode('edit');
      setEntries({});
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const saveEntriesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask) throw new Error("Aucune tâche sélectionnée");

      await supabase
        .from("linen_inventory_entries")
        .delete()
        .eq("task_id", selectedTask.id);

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
    
    const entriesMap: Record<string, any> = {};
    task.linen_inventory_entries?.forEach((entry: any) => {
      entriesMap[entry.linen_type_id] = {
        clean: entry.quantity_clean || 0,
        dirty: entry.quantity_dirty || 0,
        damaged: entry.quantity_damaged || 0,
        photo_url: entry.photo_url,
        ai_confidence: entry.ai_confidence,
        counted_at: entry.counted_at,
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

  // Vue liste des dates
  if (!selectedDate) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Inventaire Linge par Date
            </h3>
            <p className="text-sm text-muted-foreground">
              Cliquez sur une date pour voir le détail et télécharger le rapport
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Saisie directe
          </Button>
        </div>

        {/* Liste des dates */}
        <div className="space-y-3">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">
              Chargement...
            </Card>
          ) : tasksByDate.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Aucun inventaire trouvé
            </Card>
          ) : (
            tasksByDate.map((dayData) => (
              <Card key={dayData.date} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-lg capitalize">
                        {format(new Date(dayData.date), "EEEE d MMMM yyyy", { locale: fr })}
                      </span>
                      {getStatusBadge(dayData.overallStatus)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground ml-8">
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        {dayData.tasks.length} tâche{dayData.tasks.length > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        📦 {dayData.totalPieces} pièces
                      </span>
                      {dayData.entriesWithPhotos > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <ImageIcon className="h-3 w-3" />
                          {dayData.entriesWithPhotos} photo{dayData.entriesWithPhotos > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(dayData.date)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Voir
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Dialog création */}
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
      </div>
    );
  }

  // Vue détaillée d'une date
  return (
    <div className="space-y-6">
      {/* Header avec retour */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 capitalize">
              📅 {format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: fr })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedDateData?.tasks.length || 0} tâche(s) • {selectedDateData?.totalPieces || 0} pièces
            </p>
          </div>
        </div>
      </div>

      {/* Rapport PDF téléchargeable */}
      {selectedDateData && (
        <LinenDailyReport
          date={selectedDate}
          tasks={selectedDateData.tasks}
          linenTypes={linenTypes}
          hotelName={hotelName}
          getHousekeeperName={getHousekeeperName}
        />
      )}

      {/* Liste des entrées avec images */}
      <div className="space-y-4">
        <h4 className="font-medium">Détail des comptages</h4>
        {selectedDateData?.tasks.map((task: any) => (
          <Card key={task.id} className="overflow-hidden">
            <div className="p-3 bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{getHousekeeperName(task.assigned_to)}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(task.created_at), "HH:mm", { locale: fr })}
                </span>
                {getStatusBadge(task.status)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openTask(task, 'view')}>
                  <Eye className="h-4 w-4 mr-1" />
                  Détail
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
              </div>
            </div>

            {/* Tableau des entrées avec images */}
            <div className="divide-y">
              {task.linen_inventory_entries?.map((entry: any) => {
                const linenType = linenTypes.find((t: any) => t.id === entry.linen_type_id);
                if (!linenType) return null;
                const total = (entry.quantity_clean || 0) + (entry.quantity_dirty || 0) + (entry.quantity_damaged || 0);
                if (total === 0) return null;

                return (
                  <div key={entry.id} className="p-4 flex items-center gap-4">
                    {/* Image miniature */}
                    {entry.photo_url ? (
                      <img
                        src={entry.photo_url}
                        alt={linenType.name}
                        className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border"
                        onClick={() => setViewingImage({ url: entry.photo_url, name: linenType.name })}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}

                    {/* Infos type de linge */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{linenType.icon || "📦"}</span>
                        <span className="font-medium">{linenType.name}</span>
                        {linenType.dimensions && (
                          <span className="text-xs text-muted-foreground">({linenType.dimensions})</span>
                        )}
                      </div>
                      {entry.ai_confidence && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            entry.ai_confidence >= 0.8
                              ? "border-green-300 text-green-700"
                              : entry.ai_confidence >= 0.5
                              ? "border-yellow-300 text-yellow-700"
                              : "border-red-300 text-red-700"
                          }`}
                        >
                          IA: {Math.round(entry.ai_confidence * 100)}%
                        </Badge>
                      )}
                    </div>

                    {/* Comptages */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-green-700">{entry.quantity_clean || 0}</div>
                        <div className="text-xs text-muted-foreground">Propre</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-orange-700">{entry.quantity_dirty || 0}</div>
                        <div className="text-xs text-muted-foreground">Sale</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-red-700">{entry.quantity_damaged || 0}</div>
                        <div className="text-xs text-muted-foreground">Abîmé</div>
                      </div>
                      <Badge variant="secondary" className="text-lg px-3 ml-2">
                        {total}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Visionneuse d'image plein écran */}
      <LinenImageViewer
        imageUrl={viewingImage?.url || null}
        linenTypeName={viewingImage?.name}
        onClose={() => setViewingImage(null)}
      />

      {/* Dialog détail/édition/validation */}
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

              <div className="space-y-3">
                {linenTypes.map((type: any) => {
                  const entry = entries[type.id] || { clean: 0, dirty: 0, damaged: 0 };
                  const total = (entry.clean || 0) + (entry.dirty || 0) + (entry.damaged || 0);
                  const isEditable = viewMode === 'edit';

                  return (
                    <Card key={type.id} className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {/* Image miniature dans le dialog */}
                        {entry.photo_url ? (
                          <img
                            src={entry.photo_url}
                            alt={type.name}
                            className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                            onClick={() => setViewingImage({ url: entry.photo_url, name: type.name })}
                          />
                        ) : (
                          <span className="text-2xl">{type.icon || '📦'}</span>
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{type.name}</div>
                          {type.dimensions && (
                            <div className="text-sm text-muted-foreground">{type.dimensions}</div>
                          )}
                          {entry.ai_confidence && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Confiance IA: {Math.round(entry.ai_confidence * 100)}%
                            </Badge>
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
