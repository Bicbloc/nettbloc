import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle, ChevronDown, ChevronUp, Loader2, ClipboardList,
  Calendar as CalendarIcon, TicketCheck, MapPin, RotateCcw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface StaffTasksListProps {
  hotelId: string;
  staffType: 'housekeeper' | 'governess' | 'technician';
  staffId?: string;
  staffName?: string;
  showCompletedDefault?: boolean;
}

interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  location_type: string;
  location_reference: string | null;
  priority: string;
  is_one_time: boolean;
  one_time_date: string | null;
  days_of_week: number[];
  assigned_to_all: boolean;
  assigned_to_user_id: string | null;
  assigned_user_name: string | null;
}

interface TaskCompletion {
  id: string;
  task_template_id: string;
  completed_by_id: string;
  completed_by_name: string;
  completed_at: string;
  completion_date: string;
}

interface ManualTask {
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

const LOCATION_TYPES: Record<string, { label: string; icon: string }> = {
  room: { label: 'Chambre', icon: '🛏️' },
  corridor: { label: 'Couloir', icon: '🚪' },
  lobby: { label: 'Lobby', icon: '🏨' },
  restaurant: { label: 'Restaurant', icon: '🍽️' },
  spa: { label: 'Spa/Piscine', icon: '🏊' },
  technical: { label: 'Local technique', icon: '🔧' },
  other: { label: 'Autre', icon: '📍' },
};

const PRIORITIES: Record<string, { label: string; color: string }> = {
  low: { label: 'Faible', color: 'bg-gray-100 text-gray-700' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'Élevée', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

const MANUAL_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'À faire', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Envoyé', color: 'bg-amber-100 text-amber-800' },
  validated: { label: 'Validé ✓', color: 'bg-green-100 text-green-800' },
};

export function StaffTasksList({ 
  hotelId, 
  staffType, 
  staffId, 
  staffName,
  showCompletedDefault = false
}: StaffTasksListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCompleted, setShowCompleted] = useState(showCompletedDefault);
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const currentDayOfWeek = new Date().getDay();

  // Fetch template tasks
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["staff-tasks", hotelId, staffType, staffId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .eq("assigned_to_type", staffType);

      if (error) throw error;

      const filteredTasks = (data || []).filter((task: TaskTemplate) => {
        const isForMe = task.assigned_to_all || task.assigned_to_user_id === staffId;
        if (!isForMe) return false;

        if (task.is_one_time) {
          return task.one_time_date === today;
        } else {
          return task.days_of_week?.includes(currentDayOfWeek);
        }
      });

      return filteredTasks as TaskTemplate[];
    },
    enabled: !!hotelId,
  });

  // Fetch manual tasks (tickets from admin)
  const { data: manualTasks, isLoading: loadingManual } = useQuery({
    queryKey: ["staff-manual-tasks", hotelId, staffType, staffName, today],
    queryFn: async () => {
      let query = supabase
        .from("manual_tasks")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("task_date", today)
        .eq("assigned_to_type", staffType);

      const { data, error } = await query.order("priority", { ascending: false });

      if (error) throw error;

      // Filter: show tasks assigned to this person OR unassigned
      return (data || []).filter((t: ManualTask) => {
        if (!t.assigned_to_name) return true; // unassigned = visible to all
        return t.assigned_to_name === staffName;
      }) as ManualTask[];
    },
    enabled: !!hotelId,
  });

  // Fetch today's completions (for templates)
  const { data: completions } = useQuery({
    queryKey: ["task-completions", hotelId, today],
    queryFn: async (): Promise<TaskCompletion[]> => {
      const { data, error } = await (supabase as any)
        .from("task_completions")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("completion_date", today);

      if (error) return [];
      return (data || []) as unknown as TaskCompletion[];
    },
    enabled: !!hotelId,
  });

  // Complete template task mutation
  const completeMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      if (completed) {
        const { error } = await (supabase as any)
          .from("task_completions")
          .insert({
            hotel_id: hotelId,
            task_template_id: taskId,
            completed_by_id: staffId || 'unknown',
            completed_by_name: staffName || 'Staff',
            completed_by_type: staffType,
            completion_date: today,
          });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("task_completions")
          .delete()
          .eq("task_template_id", taskId)
          .eq("completion_date", today)
          .eq("completed_by_id", staffId || 'unknown');
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-completions", hotelId, today] });
      toast({ title: "Tâche mise à jour" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur lors de la mise à jour" });
    },
  });

  // Complete manual task mutation (staff marks as completed)
  const completeManualTask = useMutation({
    mutationFn: async ({ taskId, action }: { taskId: string; action: 'complete' | 'start' }) => {
      if (action === 'complete') {
        const { error } = await supabase
          .from("manual_tasks")
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by_name: staffName || 'Staff',
          })
          .eq("id", taskId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("manual_tasks")
          .update({
            status: 'in_progress',
            started_at: new Date().toISOString(),
          })
          .eq("id", taskId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-manual-tasks", hotelId] });
      toast({ title: "Tâche mise à jour" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erreur" });
    },
  });

  const isTaskCompleted = (taskId: string) => {
    return completions?.some(c => c.task_template_id === taskId);
  };

  const handleToggleComplete = (taskId: string) => {
    const isCompleted = isTaskCompleted(taskId);
    completeMutation.mutate({ taskId, completed: !isCompleted });
  };

  // Combine counts
  const templateCompleted = tasks?.filter(task => isTaskCompleted(task.id)).length || 0;
  const templateTotal = tasks?.length || 0;
  const manualActive = manualTasks?.filter(t => t.status === 'pending' || t.status === 'in_progress').length || 0;
  const manualCompleted = manualTasks?.filter(t => t.status === 'completed' || t.status === 'validated').length || 0;
  const manualTotal = manualTasks?.length || 0;

  const totalTasks = templateTotal + manualTotal;
  const totalCompleted = templateCompleted + manualCompleted;

  // Filter templates based on showCompleted
  const visibleTasks = tasks?.filter(task => {
    const completed = isTaskCompleted(task.id);
    return showCompleted ? true : !completed;
  }) || [];

  // Filter manual tasks
  const visibleManualTasks = manualTasks?.filter(t => {
    if (showCompleted) return true;
    return t.status !== 'validated';
  }) || [];

  const isLoadingAll = isLoading || loadingManual;

  if (isLoadingAll) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (totalTasks === 0) {
    return null;
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Tâches du jour</h3>
                <p className="text-sm text-muted-foreground">
                  {totalCompleted}/{totalTasks} terminées
                  {manualActive > 0 && (
                    <span className="text-orange-600 ml-1">• {manualActive} ticket(s) à traiter</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalCompleted > 0 && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompleted(!showCompleted);
                  }}
                >
                  {showCompleted ? 'Masquer terminées' : 'Voir terminées'}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y">
                {/* Manual tasks (tickets from admin) */}
                {visibleManualTasks.map(task => {
                  const location = LOCATION_TYPES[task.location_type] || LOCATION_TYPES.other;
                  const priority = PRIORITIES[task.priority] || PRIORITIES.normal;
                  const status = MANUAL_STATUS[task.status] || MANUAL_STATUS.pending;
                  const isPending = task.status === 'pending';
                  const isInProgress = task.status === 'in_progress';
                  const isDone = task.status === 'completed' || task.status === 'validated';

                  return (
                    <div 
                      key={`manual-${task.id}`}
                      className={`p-4 flex items-start gap-3 ${
                        isDone ? 'bg-green-50/50' : isPending ? 'bg-orange-50/30' : ''
                      }`}
                    >
                      <div className="bg-amber-100 p-1.5 rounded-full mt-0.5">
                        <TicketCheck className="h-4 w-4 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                          <Badge className={status.color} variant="secondary">
                            {status.label}
                          </Badge>
                          <Badge className={priority.color} variant="secondary">
                            {priority.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {task.location_reference && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {location.icon} {task.location_reference}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        {task.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            📝 {task.notes}
                          </p>
                        )}

                        {/* Action buttons for staff */}
                        {(isPending || isInProgress) && (
                          <div className="flex gap-2 mt-2">
                            {isPending && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => completeManualTask.mutate({ taskId: task.id, action: 'start' })}
                                disabled={completeManualTask.isPending}
                              >
                                Commencer
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => completeManualTask.mutate({ taskId: task.id, action: 'complete' })}
                              disabled={completeManualTask.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Marquer terminé
                            </Button>
                          </div>
                        )}

                        {task.status === 'completed' && (
                          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" />
                            En attente de validation admin
                          </p>
                        )}

                        {task.status === 'validated' && (
                          <p className="text-xs text-green-600 mt-2">
                            ✓ Validé par l'admin
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Template tasks */}
                {visibleTasks.map(task => {
                  const isCompleted = isTaskCompleted(task.id);
                  const location = LOCATION_TYPES[task.location_type] || LOCATION_TYPES.other;
                  const priority = PRIORITIES[task.priority] || PRIORITIES.normal;

                  return (
                    <div 
                      key={task.id} 
                      className={`p-4 flex items-start gap-3 ${isCompleted ? 'bg-green-50/50' : ''}`}
                    >
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => handleToggleComplete(task.id)}
                        disabled={completeMutation.isPending}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                          <Badge className={priority.color} variant="secondary">
                            {priority.label}
                          </Badge>
                          {task.is_one_time && (
                            <Badge variant="outline" className="text-xs">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              Ponctuelle
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span>{location.icon}</span>
                            {location.label}
                            {task.location_reference && ` - ${task.location_reference}`}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                      {isCompleted && (
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
