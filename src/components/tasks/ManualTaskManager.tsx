import { useMemo, useState } from "react";
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
import { TaskDetailDialog } from "./TaskDetailDialog";
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
  Calendar as CalendarIcon,
  Search,
  ChevronsUpDown,
  Check,
  Eye
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

// Removed LOCATION_TYPES - now using registered rooms from hotel_rooms_registry

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

const OTHER_LOCATION_VALUE = "__other_location__";

const DEFAULT_NEW_TASK = {
  title: '',
  description: '',
  location_type: 'room',
  location_reference: '',
  assigned_to_type: 'housekeeper',
  assigned_to_name: '',
  priority: 'normal',
};

export function ManualTaskManager({
  hotelId,
  housekeeperNames,
  governessNames = [],
  technicianNames = [],
}: ManualTaskManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatePopover, setShowTemplatePopover] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [newTask, setNewTask] = useState({ ...DEFAULT_NEW_TASK });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Fetch registered rooms/spaces for location selector
  const { data: registeredRooms } = useQuery({
    queryKey: ["registered-rooms-for-tasks", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_rooms_registry")
        .select("room_number, space_category")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("room_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!hotelId,
  });

  const [showCustomLocation, setShowCustomLocation] = useState(false);

  const registeredLocationOptions = useMemo(() => {
    const uniqueRooms = new Map<string, { room_number: string; space_category: string | null }>();

    (registeredRooms || []).forEach((room) => {
      const roomNumber = room.room_number?.trim();

      if (!roomNumber || uniqueRooms.has(roomNumber)) {
        return;
      }

      uniqueRooms.set(roomNumber, {
        room_number: roomNumber,
        space_category: room.space_category,
      });
    });

    return Array.from(uniqueRooms.values())
      .sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true, sensitivity: 'base' }))
      .map((room) => ({
        value: room.room_number,
        label: room.space_category && room.space_category !== 'room'
          ? `${room.room_number} — ${room.space_category}`
          : room.room_number,
      }));
  }, [registeredRooms]);

  const hasSelectedRegisteredLocation = registeredLocationOptions.some(
    (option) => option.value === newTask.location_reference
  );

  const isCustomLocationSelected =
    showCustomLocation ||
    newTask.location_type === 'other' ||
    (!!newTask.location_reference && !hasSelectedRegisteredLocation);

  // Fetch technicians from DB
  const { data: dbTechnicians } = useQuery({
    queryKey: ["technician-profiles-for-hotel", hotelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("technician_access_requests")
        .select("technician_profile_id, technician_profiles(name)")
        .eq("hotel_id", hotelId)
        .eq("status", "approved");
      return (data || []).map((r: any) => r.technician_profiles?.name).filter(Boolean) as string[];
    },
    enabled: !!hotelId,
  });

  // Fetch governesses from DB
  const { data: dbGovernesses } = useQuery({
    queryKey: ["governess-profiles-for-hotel", hotelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("governess_access_requests")
        .select("governess_profile_id, governess_profiles(name)")
        .eq("hotel_id", hotelId)
        .eq("status", "approved");
      return (data || []).map((r: any) => r.governess_profiles?.name).filter(Boolean) as string[];
    },
    enabled: !!hotelId,
  });

  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const resetCreateTaskForm = () => {
    setStaffSearch('');
    setShowCustomLocation(false);
    setNewTask({ ...DEFAULT_NEW_TASK });
  };

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
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData: any = {
        hotel_id: hotelId,
        title: task.title,
        description: task.description || null,
        location_type: task.location_type,
        location_reference: task.location_reference || null,
        assigned_to_type: task.assigned_to_type,
        assigned_to_name: task.assigned_to_name || null,
        priority: task.priority || 'normal',
        task_date: today,
        created_by: user?.id || null,
      };

      const { error } = await supabase
        .from("manual_tasks")
        .insert(insertData);

      if (error) {
        throw error;
      }

      // Send notification to assigned staff
      if (task.assigned_to_name) {
        try {
          await supabase.from("notifications").insert({
            hotel_id: hotelId,
            title: `📋 Nouveau ticket : ${task.title}`,
            description: `Assigné à ${task.assigned_to_name}${task.location_reference ? ` — ${task.location_reference}` : ''}`,
            type: 'task_assigned',
            user_type: task.assigned_to_type,
            housekeeper_name: task.assigned_to_name,
            room_number: task.location_reference || null,
          });
        } catch (notifError) {
          console.warn('Notification non envoyée:', notifError);
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-tasks", hotelId, today] });
      toast({ title: "Tâche créée" });
      setShowCreateDialog(false);
      resetCreateTaskForm();
    },
    onError: (error: any) => {
      console.error('Task creation failed:', error);
      toast({ 
        variant: "destructive", 
        title: "Erreur lors de la création",
        description: error?.message || "Vérifiez vos permissions."
      });
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
        return [...new Set([...governessNames, ...(dbGovernesses || [])])];
      case 'technician':
        return [...new Set([...technicianNames, ...(dbTechnicians || [])])];
      default:
        return [];
    }
  };

  const filteredAssignees = getAssigneeList().filter(name =>
    name.toLowerCase().includes(staffSearch.toLowerCase())
  );

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

            <div className="space-y-2">
              <Label>Espace *</Label>
              {registeredLocationOptions.length > 0 ? (
                <>
                  <SpaceSearchSelector
                    options={registeredLocationOptions}
                    value={newTask.location_reference}
                    isOther={isCustomLocationSelected}
                    onSelect={(value) => {
                      setShowCustomLocation(false);
                      setNewTask((prev) => ({ ...prev, location_type: 'room', location_reference: value }));
                    }}
                    onSelectOther={() => {
                      setShowCustomLocation(true);
                      setNewTask((prev) => ({
                        ...prev,
                        location_type: 'other',
                        location_reference: prev.location_type === 'other' ? prev.location_reference : '',
                      }));
                    }}
                  />
                  {isCustomLocationSelected && (
                    <Input
                      placeholder="Préciser le lieu..."
                      value={newTask.location_reference}
                      onChange={(e) => setNewTask({ ...newTask, location_reference: e.target.value })}
                      className="mt-2"
                      autoFocus
                    />
                  )}
                </>
              ) : (
                <Input
                  placeholder="Chambre ou lieu..."
                  value={newTask.location_reference}
                  onChange={(e) => setNewTask({ ...newTask, location_type: 'other', location_reference: e.target.value })}
                />
              )}
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
                <Input
                  placeholder="Rechercher un nom..."
                  value={newTask.assigned_to_name || staffSearch}
                  onChange={(e) => {
                    setStaffSearch(e.target.value);
                    setNewTask({ ...newTask, assigned_to_name: '' });
                  }}
                />
                {staffSearch && !newTask.assigned_to_name && (
                  <ScrollArea className="max-h-[120px] border rounded-md">
                    {filteredAssignees.length > 0 ? (
                      filteredAssignees.map(name => (
                        <Button
                          key={name}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => {
                            setNewTask({ ...newTask, assigned_to_name: name });
                            setStaffSearch('');
                          }}
                        >
                          {name}
                        </Button>
                      ))
                    ) : (
                      <p className="p-2 text-sm text-muted-foreground">Aucun résultat</p>
                    )}
                  </ScrollArea>
                )}
                {newTask.assigned_to_name && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{newTask.assigned_to_name}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setNewTask({ ...newTask, assigned_to_name: '' })}
                    >
                      ✕
                    </Button>
                  </div>
                )}
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
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetCreateTaskForm();
            }}>
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
  const locationLabel = task.location_type === 'room' ? '🛏️' : '📍';

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
                {locationLabel} {task.location_reference}
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

// Space Search Selector Component with search bar and highlighted "Autre"
function SpaceSearchSelector({
  options,
  value,
  isOther,
  onSelect,
  onSelectOther,
}: {
  options: { value: string; label: string }[];
  value: string;
  isOther: boolean;
  onSelect: (value: string) => void;
  onSelectOther: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter((o) =>
    o.value.toLowerCase().includes(search.toLowerCase()) ||
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const displayLabel = isOther
    ? '📍 Autre'
    : options.find((o) => o.value === value)?.label || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {displayLabel || 'Sélectionner un espace…'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Rechercher une chambre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[200px]">
          <div className="p-1">
            {filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Aucun résultat</p>
            )}
            {filtered.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 font-normal"
                onClick={() => {
                  onSelect(option.value);
                  setSearch('');
                  setOpen(false);
                }}
              >
                <Check className={`h-4 w-4 ${value === option.value && !isOther ? 'opacity-100' : 'opacity-0'}`} />
                {option.label}
              </Button>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t p-1">
          <Button
            variant={isOther ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start gap-2 font-medium text-primary"
            onClick={() => {
              onSelectOther();
              setSearch('');
              setOpen(false);
            }}
          >
            <MapPin className="h-4 w-4" />
            📍 Autre lieu…
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
