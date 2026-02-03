import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  User, 
  MapPin,
  AlertCircle,
  Loader2,
  CheckCheck,
  XCircle,
  FileText,
  Repeat,
  Calendar as CalendarIcon
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ManualTaskManagerProps {
  hotelId: string;
  housekeeperNames: string[];
  governessNames?: string[];
  technicianNames?: string[];
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  location_type: string;
  location_reference: string | null;
  assigned_to_type: string;
  assigned_to_name: string | null;
  task_date: string;
  status: string;
  priority: string;
  started_at: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  validated_at: string | null;
  notes: string | null;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  location_type: string;
  location_reference: string | null;
  assigned_to_type: string;
  assigned_user_name: string | null;
  priority: string;
  is_one_time: boolean;
}

const LOCATION_TYPES = [
  { value: 'room', label: 'Chambre', icon: '🛏️' },
  { value: 'corridor', label: 'Couloir', icon: '🚪' },
  { value: 'lobby', label: 'Lobby', icon: '🏨' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'spa', label: 'Spa/Piscine', icon: '🏊' },
  { value: 'other', label: 'Autre', icon: '📍' },
];

const PRIORITIES = [
  { value: 'low', label: 'Faible', color: 'bg-gray-100 text-gray-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Élevée', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

const STATUS_CONFIG = {
  pending: { label: 'En attente', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'En cours', icon: AlertCircle, color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Terminée', icon: CheckCircle2, color: 'bg-amber-100 text-amber-700' },
  validated: { label: 'Validée', icon: CheckCheck, color: 'bg-green-100 text-green-700' },
};

export function ManualTaskManager({
  hotelId,
  housekeeperNames,
  governessNames = [],
  technicianNames = [],
}: ManualTaskManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatePopover, setShowTemplatePopover] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    location_type: 'room',
    location_reference: '',
    assigned_to_type: 'housekeeper',
    assigned_to_name: '',
    priority: 'normal',
  });

  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's tasks
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["manual-tasks", hotelId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_tasks")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("task_date", today)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
  });

  // Fetch task templates (recurring and one-time)
  const { data: taskTemplates } = useQuery({
    queryKey: ["task-templates", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("is_one_time")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TaskTemplate[];
    },
  });

  const recurringTemplates = taskTemplates?.filter(t => !t.is_one_time) || [];
  const oneTimeTemplates = taskTemplates?.filter(t => t.is_one_time) || [];

  const applyTemplate = (template: TaskTemplate) => {
    setNewTask({
      title: template.title,
      description: template.description || '',
      location_type: template.location_type,
      location_reference: template.location_reference || '',
      assigned_to_type: template.assigned_to_type,
      assigned_to_name: template.assigned_user_name || '',
      priority: template.priority,
    });
    setShowTemplatePopover(false);
    setShowCreateDialog(true);
    toast({ title: "Template appliqué", description: `"${template.title}" chargé` });
  };

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (task: typeof newTask) => {
      const { error } = await supabase
        .from("manual_tasks")
        .insert({
          hotel_id: hotelId,
          ...task,
          task_date: today,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-tasks", hotelId] });
      toast({ title: "Tâche créée" });
      setShowCreateDialog(false);
      setNewTask({
        title: '',
        description: '',
        location_type: 'room',
        location_reference: '',
        assigned_to_type: 'housekeeper',
        assigned_to_name: '',
        priority: 'normal',
      });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur lors de la création" });
    },
  });

  // Validate task mutation
  const validateTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("manual_tasks")
        .update({
          status: 'validated',
          validated_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-tasks", hotelId] });
      toast({ title: "Tâche validée" });
    },
  });

  // Reject task (back to pending)
  const rejectTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("manual_tasks")
        .update({
          status: 'pending',
          completed_at: null,
          completed_by_name: null,
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-tasks", hotelId] });
      toast({ title: "Tâche rejetée, remise en attente" });
    },
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("manual_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-tasks", hotelId] });
      toast({ title: "Tâche supprimée" });
    },
  });

  const getAssigneeList = () => {
    switch (newTask.assigned_to_type) {
      case 'housekeeper':
        return housekeeperNames;
      case 'governess':
        return governessNames;
      case 'technician':
        return technicianNames;
      default:
        return [];
    }
  };

  const pendingTasks = tasks?.filter(t => t.status === 'pending' || t.status === 'in_progress') || [];
  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];
  const validatedTasks = tasks?.filter(t => t.status === 'validated') || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-medium">Tâches manuelles du jour</h3>
        <div className="flex items-center gap-2">
          {/* Template selector popover */}
          <Popover open={showTemplatePopover} onOpenChange={setShowTemplatePopover}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={!taskTemplates || taskTemplates.length === 0}
              >
                <FileText className="h-4 w-4 mr-1" />
                Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Charger depuis un template</h4>
                <p className="text-xs text-muted-foreground">Sélectionnez un template pour pré-remplir</p>
              </div>
              <ScrollArea className="max-h-[300px]">
                {/* Recurring templates */}
                {recurringTemplates.length > 0 && (
                  <div className="p-2">
                    <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2 px-2">
                      <Repeat className="h-3 w-3" />
                      Récurrentes
                    </h5>
                    {recurringTemplates.map(template => (
                      <Button
                        key={template.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => applyTemplate(template)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{template.title}</div>
                          {template.description && (
                            <div className="text-xs text-muted-foreground truncate">{template.description}</div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
                
                {/* One-time templates */}
                {oneTimeTemplates.length > 0 && (
                  <div className="p-2 border-t">
                    <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2 px-2">
                      <CalendarIcon className="h-3 w-3" />
                      Ponctuelles
                    </h5>
                    {oneTimeTemplates.map(template => (
                      <Button
                        key={template.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => applyTemplate(template)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{template.title}</div>
                          {template.description && (
                            <div className="text-xs text-muted-foreground truncate">{template.description}</div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}

                {(!taskTemplates || taskTemplates.length === 0) && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Aucun template disponible
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle tâche
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  En attente ({pendingTasks.length})
                </h4>
                {pendingTasks.map(task => (
                  <TaskCard key={task.id} task={task} onDelete={() => deleteTask.mutate(task.id)} />
                ))}
              </div>
            )}

            {/* Completed - Awaiting Validation */}
            {completedTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-amber-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  À valider ({completedTasks.length})
                </h4>
                {completedTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onValidate={() => validateTask.mutate(task.id)}
                    onReject={() => rejectTask.mutate(task.id)}
                    onDelete={() => deleteTask.mutate(task.id)}
                  />
                ))}
              </div>
            )}

            {/* Validated Tasks */}
            {validatedTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-600 flex items-center gap-2">
                  <CheckCheck className="h-4 w-4" />
                  Validées ({validatedTasks.length})
                </h4>
                {validatedTasks.map(task => (
                  <TaskCard key={task.id} task={task} onDelete={() => deleteTask.mutate(task.id)} />
                ))}
              </div>
            )}

            {tasks?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Aucune tâche manuelle pour aujourd'hui</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle tâche manuelle</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                placeholder="Ex: Nettoyer le couloir 3e étage"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Détails de la tâche..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type de lieu</Label>
                <Select
                  value={newTask.location_type}
                  onValueChange={(v) => setNewTask({ ...newTask, location_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Référence lieu</Label>
                <Input
                  placeholder={newTask.location_type === 'room' ? 'N° chambre' : 'Préciser...'}
                  value={newTask.location_reference}
                  onChange={(e) => setNewTask({ ...newTask, location_reference: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Assigner à</Label>
                <Select
                  value={newTask.assigned_to_type}
                  onValueChange={(v) => setNewTask({ ...newTask, assigned_to_type: v, assigned_to_name: '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="housekeeper">Femme de chambre</SelectItem>
                    <SelectItem value="governess">Gouvernante</SelectItem>
                    <SelectItem value="technician">Technicien</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Personne</Label>
                <Select
                  value={newTask.assigned_to_name}
                  onValueChange={(v) => setNewTask({ ...newTask, assigned_to_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAssigneeList().map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select
                value={newTask.priority}
                onValueChange={(v) => setNewTask({ ...newTask, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => createTask.mutate(newTask)}
              disabled={!newTask.title.trim() || createTask.isPending}
            >
              {createTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Créer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Task Card Component
function TaskCard({ 
  task, 
  onValidate, 
  onReject,
  onDelete 
}: { 
  task: Task; 
  onValidate?: () => void;
  onReject?: () => void;
  onDelete: () => void;
}) {
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const priorityConfig = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[1];
  const locationType = LOCATION_TYPES.find(l => l.value === task.location_type);

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{task.title}</span>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            <Badge variant="outline" className={priorityConfig.color}>{priorityConfig.label}</Badge>
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {task.location_reference && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationType?.icon} {task.location_reference}
              </span>
            )}
            {task.assigned_to_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assigned_to_name}
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {task.description}
            </p>
          )}

          {task.completed_by_name && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Terminée par {task.completed_by_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {task.status === 'completed' && onValidate && (
            <>
              <Button size="icon" variant="ghost" className="text-green-600" onClick={onValidate}>
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-orange-600" onClick={onReject}>
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
